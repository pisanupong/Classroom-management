const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const { protect: authenticate, restrictTo } = require('../middleware/authMiddleware');
const { COSTUMES } = require('../utils/petLoot');
const { stageKey } = require('../utils/petStage');
const { checkWord } = require('../utils/wordCheck');

/* ══════════════════════════════════════════════════════════
   CONFIG (ต้องตรงกับ frontend/src/pages/Pet.jsx)
══════════════════════════════════════════════════════════ */
const ELEMENTS = ['FIRE', 'WATER', 'GRASS', 'LIGHT', 'DARK'];

const STAMINA_MAX = 5;
const STAMINA_REGEN_MS = 4 * 60 * 1000;   // ฟื้น 1 หน่วยทุก 4 นาที
const ATK_LV_MAX = 20;
const atkXpNeeded = (lv) => 40 + (lv - 1) * 28;   // EXP ที่ต้องใช้เพื่อขึ้นเลเวลถัดไป

/* ทักษะที่ฝึกได้ — แต่ละอย่างมีโจทย์คนละแบบฝั่ง client
   atk = สูตรคูณ · def = การหาร · eva = สมการง่าย ๆ */
const SKILLS = {
  atk: { key: 'atk', lv: 'atk_lv', xp: 'atk_xp', label: 'โจมตี' },
  def: { key: 'def', lv: 'def_lv', xp: 'def_xp', label: 'ป้องกัน' },
  eva: { key: 'eva', lv: 'eva_lv', xp: 'eva_xp', label: 'หลบหลีก' },
};

/* EXP จากการป้อนคำ — เพิ่มให้มากขึ้นกว่าเดิมมาก
   เดิม: xp = ความยาว, อิ่ม = ความยาว×3
   ใหม่: xp = ความยาว×4 + โบนัสคำยาว, อิ่ม = ความยาว×4 */
function feedRewards(len) {
  let xp = len * 4;
  if (len >= 5)  xp += 6;
  if (len >= 8)  xp += 14;
  if (len >= 12) xp += 25;
  return { xp, pts: len * 4 };
}

/* รอบการป่วย: ป่วยได้ครั้งเดียวทุก 2 วัน (ไม่เกี่ยวกับความหิวอีกแล้ว)
   อาการบาดเจ็บมาจากการแพ้ในสนามประลองเท่านั้น (ดู server.js) */
const SICK_CYCLE_MS = 2 * 24 * 60 * 60 * 1000;

/* คำนวณ stamina ที่ฟื้นตามเวลาจริง */
function regenStamina(state) {
  const now = Date.now();
  const cur = state?.stamina ?? STAMINA_MAX;
  const last = state?.stamina_at ? new Date(state.stamina_at).getTime() : now;
  if (cur >= STAMINA_MAX) return { stamina: STAMINA_MAX, stamina_at: new Date(now) };
  const gained = Math.floor((now - last) / STAMINA_REGEN_MS);
  if (gained <= 0) return { stamina: cur, stamina_at: new Date(last) };
  const next = Math.min(STAMINA_MAX, cur + gained);
  return {
    stamina: next,
    stamina_at: next >= STAMINA_MAX ? new Date(now) : new Date(last + gained * STAMINA_REGEN_MS),
  };
}

/* ══════════════════════════════════════════════════════════
   FEED — จำกัดครั้งละ 1 คำ ห้ามเว้นวรรค
══════════════════════════════════════════════════════════ */
router.post('/feed', authenticate, async (req, res) => {
  try {
    const { word } = req.body;
    if (!word || typeof word !== 'string') return res.status(400).json({ message: 'กรุณาส่งคำศัพท์' });

    const raw = word.trim();
    // ต้องเป็นคำเดียว: ห้ามมีช่องว่างใด ๆ (space, tab, newline, ช่องว่างไทย)
    if (/\s/.test(raw)) {
      return res.status(400).json({ ok: false, status: 'multiword', message: 'ป้อนได้ครั้งละ 1 คำเท่านั้น ห้ามเว้นวรรค' });
    }
    const trimmed = raw.toLowerCase();
    if (trimmed.length < 2) return res.status(400).json({ message: 'คำต้องยาวอย่างน้อย 2 ตัวอักษร' });
    if (trimmed.length > 40) return res.status(400).json({ message: 'คำยาวเกินไป' });
    if (!/^[a-zA-Zก-๙฀-๿-]+$/.test(trimmed)) {
      return res.status(400).json({ message: 'กรุณาพิมพ์ตัวอักษรเท่านั้น' });
    }

    // ต้องเป็นคำที่มีความหมายจริง (เทียบกับพจนานุกรม Wiktionary)
    const dict = await checkWord(raw);
    if (!dict.valid) {
      return res.json({
        ok: false, status: 'not_a_word',
        message: `ไม่พบ "${raw}" ในพจนานุกรม — ต้องเป็นคำที่มีความหมายจริงนะ`,
      });
    }

    const existing = await prisma.petWord.findUnique({
      where: { word: trimmed },
      include: { user: { select: { name: true } } },
    });
    if (existing) {
      const isSelf = existing.used_by === req.user.id;
      return res.json({ ok: false, status: 'duplicate', usedBy: isSelf ? 'คุณเอง' : existing.user.name });
    }

    await prisma.petWord.create({ data: { word: trimmed, used_by: req.user.id } });

    const { xp: xpGain, pts } = feedRewards(trimmed.length);

    const current = await prisma.petState.findUnique({ where: { user_id: req.user.id } });
    const newHunger = Math.min(100, (current?.hunger ?? 60) + pts);
    const newXp = (current?.xp ?? 0) + xpGain;

    await prisma.petState.upsert({
      where: { user_id: req.user.id },
      create: { user_id: req.user.id, hunger: newHunger, xp: newXp, total_words: 1, stage: stageKey(newXp) },
      update: { hunger: newHunger, xp: newXp, total_words: { increment: 1 }, stage: stageKey(newXp) },
    });

    res.json({ ok: true, status: 'fed', pts, xpGain, newXp, stage: stageKey(newXp) });
  } catch (err) {
    console.error('pet/feed error:', err.message);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

/* ══════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════ */
router.get('/state', authenticate, async (req, res) => {
  try {
    const [state, words] = await Promise.all([
      prisma.petState.findUnique({ where: { user_id: req.user.id } }),
      prisma.petWord.findMany({
        where: { used_by: req.user.id },
        orderBy: { used_at: 'desc' },
        take: 50,
        select: { word: true, used_at: true },
      }),
    ]);

    let out = state;
    if (state) {
      const patch = {};
      const st = regenStamina(state);
      if (st.stamina !== state.stamina) Object.assign(patch, st);
      // ซ่อม stage ให้ตรงกับ xp เสมอ (คอลัมน์นี้เคยค้างเพราะไม่มีใครเขียน)
      const sk = stageKey(state.xp);
      if (state.stage !== sk) patch.stage = sk;

      // รอบป่วยทุก 2 วัน — เริ่มนับตั้งแต่ครั้งแรกที่เห็นสถานะนี้
      if (state.pet_type && state.stage !== 'EGG') {
        const now = Date.now();
        const last = state.last_sick_at ? new Date(state.last_sick_at).getTime() : null;
        if (last === null) {
          patch.last_sick_at = new Date(now);
        } else if (state.health === 'healthy' && now - last >= SICK_CYCLE_MS) {
          patch.health = 'sick';
          patch.last_sick_at = new Date(now);
        }
      }
      if (Object.keys(patch).length) {
        await prisma.petState.update({ where: { user_id: req.user.id }, data: patch }).catch(() => {});
        out = { ...state, ...patch };
      }
    }
    res.json({ state: out, words, staminaMax: STAMINA_MAX, staminaRegenMs: STAMINA_REGEN_MS });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

router.put('/state', authenticate, async (req, res) => {
  try {
    const { hunger, pet_name, pet_type, health, item_herb, item_kit, rest_until, element, costume } = req.body;
    const data = {};
    if (typeof hunger === 'number') data.hunger = Math.max(0, Math.min(100, hunger));
    if (pet_name) data.pet_name = pet_name;
    if (pet_type !== undefined) data.pet_type = pet_type;
    if (['healthy', 'sick', 'injured'].includes(health)) data.health = health;
    if (typeof item_herb === 'number') data.item_herb = Math.max(0, Math.min(99, Math.floor(item_herb)));
    if (typeof item_kit === 'number') data.item_kit = Math.max(0, Math.min(99, Math.floor(item_kit)));
    if (rest_until !== undefined) {
      const d = rest_until ? new Date(rest_until) : null;
      data.rest_until = d && !isNaN(d.getTime()) ? d : null;
    }

    // ธาตุ: เลือกได้ครั้งเดียว เปลี่ยนไม่ได้
    if (element && ELEMENTS.includes(element)) {
      const cur = await prisma.petState.findUnique({ where: { user_id: req.user.id }, select: { element: true } });
      if (cur?.element) return res.status(400).json({ message: 'เลือกธาตุไปแล้ว เปลี่ยนไม่ได้' });
      data.element = element;
    }

    // ชุดแต่ง: ใส่ได้เฉพาะที่มีในตู้เสื้อผ้า ('' = ถอด)
    if (costume !== undefined) {
      if (costume === '') {
        data.costume = '';
      } else if (COSTUMES[costume]) {
        const cur = await prisma.petState.findUnique({ where: { user_id: req.user.id }, select: { wardrobe: true } });
        const owned = Array.isArray(cur?.wardrobe) ? cur.wardrobe : [];
        if (!owned.includes(costume)) return res.status(400).json({ message: 'ยังไม่มีชุดนี้ในตู้เสื้อผ้า' });
        data.costume = costume;
      } else {
        return res.status(400).json({ message: 'ไม่พบชุดนี้' });
      }
    }

    if (!Object.keys(data).length) return res.json({ ok: true });
    await prisma.petState.upsert({
      where: { user_id: req.user.id },
      create: { user_id: req.user.id, ...data },
      update: data,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

/* ══════════════════════════════════════════════════════════
   TRAIN — ฝึกทักษะ โจมตี/ป้องกัน/หลบหลีก (ใช้ stamina 1 ต่อรอบ)
   body: { score, skill } — score 0-100 จากมินิเกมฝั่ง client, skill = atk|def|eva
══════════════════════════════════════════════════════════ */
router.post('/train', authenticate, async (req, res) => {
  try {
    const score = Math.max(0, Math.min(100, Math.floor(Number(req.body?.score) || 0)));
    const skill = SKILLS[req.body?.skill] || SKILLS.atk;

    const state = await prisma.petState.findUnique({ where: { user_id: req.user.id } });
    if (!state) return res.status(400).json({ message: 'ยังไม่มีสัตว์เลี้ยง' });
    if (!state.pet_type) return res.status(400).json({ message: 'ยังไม่ได้เลือกสัตว์เลี้ยง' });
    if (state.health !== 'healthy') return res.status(400).json({ ok: false, message: 'น้องยังไม่แข็งแรงพอจะฝึก' });

    const st = regenStamina(state);
    if (st.stamina <= 0) {
      const last = st.stamina_at ? new Date(st.stamina_at).getTime() : Date.now();
      return res.status(400).json({
        ok: false, status: 'no_stamina',
        message: 'พลังฝึกซ้อมหมด รอสักครู่นะ',
        nextInMs: Math.max(0, last + STAMINA_REGEN_MS - Date.now()),
      });
    }

    // รางวัล: คะแนนสูง = atk xp เยอะ + EXP เติบโตด้วย
    const atkGain = Math.max(4, Math.round(score * 0.55));
    const xpGain = Math.max(3, Math.round(score * 0.35));
    const hungerCost = 6;

    let lv = state[skill.lv] ?? 1;
    let sxp = (state[skill.xp] ?? 0) + atkGain;
    let leveled = 0;
    while (lv < ATK_LV_MAX && sxp >= atkXpNeeded(lv)) {
      sxp -= atkXpNeeded(lv);
      lv += 1;
      leveled += 1;
    }
    if (lv >= ATK_LV_MAX) sxp = 0;

    const updated = await prisma.petState.update({
      where: { user_id: req.user.id },
      data: {
        [skill.lv]: lv, [skill.xp]: sxp,
        xp: { increment: xpGain },
        stage: stageKey(state.xp + xpGain),
        hunger: Math.max(0, state.hunger - hungerCost),
        stamina: st.stamina - 1,
        stamina_at: st.stamina >= STAMINA_MAX ? new Date() : st.stamina_at,
      },
    });

    res.json({
      ok: true, score, atkGain, xpGain, leveled,
      skill: skill.key, skillLabel: skill.label,
      lv: updated[skill.lv], skillXp: updated[skill.xp],
      lvXpNeeded: atkXpNeeded(updated[skill.lv]),
      // เก็บชื่อเดิมไว้เพื่อความเข้ากันได้กับ client รุ่นก่อน
      atk_lv: updated.atk_lv, atk_xp: updated.atk_xp,
      atkXpNeeded: atkXpNeeded(updated.atk_lv),
      def_lv: updated.def_lv, def_xp: updated.def_xp,
      eva_lv: updated.eva_lv, eva_xp: updated.eva_xp,
      stamina: updated.stamina, xp: updated.xp, hunger: updated.hunger,
    });
  } catch (err) {
    console.error('pet/train error:', err.message);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

/* ══════════════════════════════════════════════════════════
   SNACK — ใช้ขนมพิเศษ (ได้จากแบบฝึกหัด) แลก EXP + ความอิ่ม
══════════════════════════════════════════════════════════ */
const SNACK_XP = 35;
const SNACK_HUNGER = 12;

router.post('/snack', authenticate, async (req, res) => {
  try {
    const state = await prisma.petState.findUnique({ where: { user_id: req.user.id } });
    if (!state || !state.pet_type) return res.status(400).json({ message: 'ยังไม่มีสัตว์เลี้ยง' });
    if ((state.item_snack || 0) <= 0) return res.status(400).json({ ok: false, message: 'ไม่มีขนมพิเศษเหลือแล้ว' });

    const updated = await prisma.petState.update({
      where: { user_id: req.user.id },
      data: {
        item_snack: state.item_snack - 1,
        xp: { increment: SNACK_XP },
        hunger: Math.min(100, state.hunger + SNACK_HUNGER),
        stage: stageKey(state.xp + SNACK_XP),
      },
    });

    res.json({
      ok: true, xpGain: SNACK_XP, hungerGain: SNACK_HUNGER,
      xp: updated.xp, hunger: updated.hunger, item_snack: updated.item_snack, stage: updated.stage,
    });
  } catch (err) {
    console.error('pet/snack error:', err.message);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

/* ══════════════════════════════════════════════════════════
   ARENA — ตารางอันดับ PvP
══════════════════════════════════════════════════════════ */
router.get('/arena/leaderboard', authenticate, async (req, res) => {
  try {
    const states = await prisma.petState.findMany({
      where: { pet_type: { not: '' } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ pvp_wins: 'desc' }, { pvp_losses: 'asc' }],
      take: 50,
    });

    const rows = states
      .filter(s => s.user && (s.pvp_wins + s.pvp_losses) > 0)
      .map(s => {
        const played = s.pvp_wins + s.pvp_losses;
        return {
          userId: s.user_id,
          owner: s.user.name,
          petName: s.pet_name,
          petType: s.pet_type,
          element: s.element || '',
          atkLv: s.atk_lv,
          xp: s.xp,
          wins: s.pvp_wins,
          losses: s.pvp_losses,
          played,
          winRate: Math.round((s.pvp_wins / played) * 100),
        };
      })
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.losses - b.losses)
      .map((r, i) => ({ rank: i + 1, ...r }));

    const me = rows.find(r => r.userId === req.user.id) || null;
    res.json({ rows, me });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

/* ══════════════════════════════════════════════════════════
   ADMIN — ดูสัตว์เลี้ยงของทุกคน และรีเซ็ตค่าได้
══════════════════════════════════════════════════════════ */
router.get('/admin/list', authenticate, restrictTo('ADMIN'), async (req, res) => {
  try {
    const states = await prisma.petState.findMany({
      include: { user: { select: { id: true, name: true, username: true, role: true } } },
      orderBy: { xp: 'desc' },
    });
    const rows = states.filter(s => s.user).map(s => ({
      userId: s.user_id,
      owner: s.user.name,
      username: s.user.username,
      role: s.user.role,
      petName: s.pet_name,
      petType: s.pet_type,
      element: s.element || '',
      stage: stageKey(s.xp),
      xp: s.xp,
      hunger: Math.round(s.hunger),
      health: s.health,
      totalWords: s.total_words,
      atkLv: s.atk_lv, defLv: s.def_lv, evaLv: s.eva_lv,
      stamina: s.stamina,
      wins: s.pvp_wins, losses: s.pvp_losses,
      itemHerb: s.item_herb, itemKit: s.item_kit, itemSnack: s.item_snack,
      costume: s.costume || '',
      wardrobe: Array.isArray(s.wardrobe) ? s.wardrobe : [],
      restUntil: s.rest_until,
      lastSickAt: s.last_sick_at,
      updatedAt: s.updated_at,
    }));
    res.json({ rows });
  } catch (err) {
    console.error('pet/admin/list error:', err.message);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

/* รีเซ็ตสัตว์เลี้ยงของผู้ใช้คนหนึ่ง
   body: { mode } — 'full' = ล้างทั้งหมดกลับไปเป็นไข่ (ค่าเริ่มต้น)
                    'heal' = รักษาอาการ + เติมความอิ่ม/พลังฝึกเท่านั้น
                    'stats' = ล้างเฉพาะทักษะและสถิติ PvP (คงคำศัพท์และ EXP) */
router.post('/admin/reset/:userId', authenticate, restrictTo('ADMIN'), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) return res.status(400).json({ message: 'userId ไม่ถูกต้อง' });

    const state = await prisma.petState.findUnique({ where: { user_id: userId } });
    if (!state) return res.status(404).json({ message: 'ผู้ใช้นี้ยังไม่มีสัตว์เลี้ยง' });

    const mode = ['full', 'heal', 'stats'].includes(req.body?.mode) ? req.body.mode : 'full';

    const heal = {
      health: 'healthy', rest_until: null, last_sick_at: new Date(),
      hunger: 100, stamina: STAMINA_MAX, stamina_at: new Date(),
    };
    const stats = {
      atk_lv: 1, atk_xp: 0, def_lv: 1, def_xp: 0, eva_lv: 1, eva_xp: 0,
      pvp_wins: 0, pvp_losses: 0,
    };

    let data;
    if (mode === 'heal') data = heal;
    else if (mode === 'stats') data = { ...heal, ...stats };
    else data = {
      ...heal, ...stats,
      hunger: 60, xp: 0, stage: 'EGG', total_words: 0,
      element: '', costume: '', wardrobe: [],
      item_herb: 1, item_kit: 1, item_snack: 0,
      last_sick_at: null,
    };

    await prisma.petState.update({ where: { user_id: userId }, data });
    // รีเซ็ตเต็มรูปแบบ: คืนคำศัพท์ที่เคยใช้ให้คนอื่นใช้ได้ด้วย
    if (mode === 'full') {
      await prisma.petWord.deleteMany({ where: { used_by: userId } }).catch(() => {});
    }

    console.log(`[PET ADMIN] ${req.user.username} reset user ${userId} (mode=${mode})`);
    res.json({ ok: true, mode });
  } catch (err) {
    console.error('pet/admin/reset error:', err.message);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
module.exports.ELEMENTS = ELEMENTS;
module.exports.atkXpNeeded = atkXpNeeded;
