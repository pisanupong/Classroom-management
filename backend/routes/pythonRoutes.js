const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const { protect: authenticate, restrictTo } = require('../middleware/authMiddleware');
const {
  LESSONS, LESSON_XP, LESSON_SCORE,
  MISSIONS, REWARDS, REWARD_TIERS, EXERCISES,
  levelForXp, countTrue, publicCurriculum,
} = require('../utils/pythonCurriculum');

const HINTS_MAX = 10;
const HINTS_PER_LEVEL = 3;
const HISTORY_MAX = 30;

/* ══════════════════════════════════════════════════════════
   helper — โหลด/สร้าง state และคำนวณรางวัลทั้งหมดฝั่งเซิร์ฟเวอร์
══════════════════════════════════════════════════════════ */

const emptyState = (userId) => ({
  user_id: userId,
  learned: {}, missions: {}, rewards: { r1: true }, exercises: {}, history: [],
});

async function getState(userId) {
  let s = await prisma.pythonState.findUnique({ where: { user_id: userId } });
  if (!s) s = await prisma.pythonState.create({ data: emptyState(userId) });
  return s;
}

// แปลง row ของ prisma ให้เป็นก้อนที่แก้ในหน่วยความจำได้สะดวก
const toWork = (s) => ({
  score: s.score,
  bestScore: s.best_score,
  xp: s.xp,
  level: s.level,
  hints: s.hints,
  charName: s.char_name,
  learned: s.learned || {},
  missions: s.missions || {},
  rewards: s.rewards || {},
  exercises: s.exercises || {},
  history: Array.isArray(s.history) ? s.history : [],
  ranInput: s.ran_input,
});

const toRow = (w) => ({
  score: w.score,
  best_score: w.bestScore,
  xp: w.xp,
  level: w.level,
  hints: w.hints,
  char_name: w.charName,
  learned: w.learned,
  missions: w.missions,
  rewards: w.rewards,
  exercises: w.exercises,
  history: w.history,
  ran_input: w.ranInput,
});

// events = รายการสิ่งที่เกิดขึ้นในรอบนี้ ส่งกลับให้ frontend เล่นเสียง/popup
function addScore(w, pts, reason, events) {
  if (!pts || pts <= 0) return;
  w.score += pts;
  if (w.score > w.bestScore) w.bestScore = w.score;
  w.history.unshift({ pts, reason, time: Date.now() });
  if (w.history.length > HISTORY_MAX) w.history = w.history.slice(0, HISTORY_MAX);
  events.push({ type: 'score', pts, reason });
}

function addXP(w, amount, events) {
  const before = w.level;
  w.xp += amount;
  const info = levelForXp(w.xp);
  w.level = info.level;
  if (w.level > before) {
    events.push({ type: 'levelup', level: w.level, avatar: info.avatar, title: info.title, titleShort: info.titleShort });
    addScore(w, w.level * 30, `อัปเลเวลเป็น Lv.${w.level}`, events);
    const gained = Math.min(HINTS_MAX, w.hints + HINTS_PER_LEVEL) - w.hints;
    w.hints += gained;
    if (gained > 0) events.push({ type: 'hints', gained, left: w.hints });
  }
}

// ภารกิจอัตโนมัติ + รางวัล — วนซ้ำเพราะการได้อย่างหนึ่งอาจปลดอีกอย่างต่อเนื่อง
function settle(w, events) {
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;

    for (const m of MISSIONS) {
      if (!m.auto || w.missions[m.id] || w.level < m.unlockLevel) continue;
      if (!m.auto(w)) continue;
      w.missions[m.id] = true;
      events.push({ type: 'mission', id: m.id, title: m.title, xp: m.xp, score: m.score });
      addXP(w, m.xp, events);
      addScore(w, m.score, `ภารกิจ: ${m.title}`, events);
      changed = true;
    }

    for (const r of REWARDS) {
      if (w.rewards[r.id] || !r.cond(w)) continue;
      w.rewards[r.id] = true;
      const tier = REWARD_TIERS[r.tier] || REWARD_TIERS[1];
      events.push({ type: 'reward', id: r.id, icon: r.icon, name: r.name, desc: r.desc, tier: r.tier, tierName: tier.name, bonus: r.scoreBonus });
      addScore(w, r.scoreBonus, `รางวัล[${tier.name}]: ${r.name}`, events);
      changed = true;
    }

    if (!changed) break;
  }
}

// บันทึก state + โยนคะแนนที่ได้เข้า total_points ของผู้ใช้ด้วย
async function commit(userId, before, w, events) {
  const earned = w.score - before.score;
  const [row] = await prisma.$transaction([
    prisma.pythonState.update({ where: { user_id: userId }, data: toRow(w) }),
    ...(earned > 0
      ? [prisma.user.update({ where: { id: userId }, data: { total_points: { increment: earned } } })]
      : []),
  ]);
  return { ok: true, state: toWork(row), events, earned };
}

/* ══════════════════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════════════════ */

router.use(authenticate);

// ข้อมูลหลักสูตร (คงที่) — โจทย์ ภารกิจ รางวัล เลเวล
router.get('/meta', (req, res) => res.json(publicCurriculum()));

router.get('/state', async (req, res) => {
  try {
    const s = await getState(req.user.id);
    const w = toWork(s);
    const events = [];
    settle(w, events);                       // เผื่อเงื่อนไขเปลี่ยนตั้งแต่ครั้งก่อน
    if (events.length) return res.json(await commit(req.user.id, toWork(s), w, events));
    res.json({ ok: true, state: w, events: [] });
  } catch (err) {
    console.error('[PYTHON] state', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// กด "เข้าใจแล้ว" ในบทเรียน
router.post('/learn', async (req, res) => {
  try {
    const id = String(req.body?.lesson || '');
    if (!LESSONS.includes(id)) return res.status(400).json({ message: 'ไม่รู้จักบทเรียนนี้' });

    const s = await getState(req.user.id);
    const before = toWork(s);
    const w = toWork(s);
    if (w.learned[id]) return res.json({ ok: true, already: true, state: w, events: [] });

    const events = [];
    w.learned[id] = true;
    addXP(w, LESSON_XP, events);
    addScore(w, LESSON_SCORE, `เข้าใจคำสั่ง: ${id}`, events);
    settle(w, events);
    res.json(await commit(req.user.id, before, w, events));
  } catch (err) {
    console.error('[PYTHON] learn', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ส่งคำตอบแบบฝึกหัด — เซิร์ฟเวอร์ตรวจเองด้วย check ของตัวเอง
router.post('/exercise', async (req, res) => {
  try {
    const ex = EXERCISES.find(e => e.id === req.body?.id);
    if (!ex) return res.status(400).json({ message: 'ไม่รู้จักแบบฝึกหัดนี้' });
    const output = String(req.body?.output ?? '');
    const code   = String(req.body?.code ?? '');

    if (!ex.check(output, code)) {
      return res.json({ ok: true, correct: false, state: null, events: [] });
    }

    const s = await getState(req.user.id);
    const before = toWork(s);
    const w = toWork(s);
    if (w.exercises[ex.id]) {
      return res.json({ ok: true, correct: true, already: true, state: w, events: [] });
    }

    const events = [];
    w.exercises[ex.id] = true;
    addXP(w, ex.xp, events);
    addScore(w, ex.score, `แบบฝึกหัด: ${ex.title}`, events);
    settle(w, events);
    const out = await commit(req.user.id, before, w, events);
    res.json({ ...out, correct: true });
  } catch (err) {
    console.error('[PYTHON] exercise', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ภารกิจที่ผูกกับบทเรียน — client ส่ง output/code ที่รันได้ เซิร์ฟเวอร์ตรวจซ้ำ
router.post('/mission', async (req, res) => {
  try {
    const m = MISSIONS.find(x => x.id === req.body?.id);
    if (!m) return res.status(400).json({ message: 'ไม่รู้จักภารกิจนี้' });

    const s = await getState(req.user.id);
    const before = toWork(s);
    const w = toWork(s);
    if (w.missions[m.id]) return res.json({ ok: true, already: true, state: w, events: [] });
    if (w.level < m.unlockLevel) return res.json({ ok: false, locked: true, state: w, events: [] });

    const output = String(req.body?.output ?? '');
    const code   = String(req.body?.code ?? '');
    const passed = m.auto ? m.auto(w) : (m.check ? m.check(output, code) : false);
    if (!passed) return res.json({ ok: true, correct: false, state: w, events: [] });

    const events = [];
    if (m.special === 'input') w.ranInput = true;
    w.missions[m.id] = true;
    events.push({ type: 'mission', id: m.id, title: m.title, xp: m.xp, score: m.score });
    addXP(w, m.xp, events);
    addScore(w, m.score, `ภารกิจ: ${m.title}`, events);
    settle(w, events);
    const out = await commit(req.user.id, before, w, events);
    res.json({ ...out, correct: true });
  } catch (err) {
    console.error('[PYTHON] mission', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ขอคำใบ้ — หัก 1 สิทธิ์ แล้วส่งข้อความคำใบ้กลับ (เก็บคำใบ้ไว้ฝั่งเซิร์ฟเวอร์)
router.post('/hint', async (req, res) => {
  try {
    const ex = EXERCISES.find(e => e.id === req.body?.id);
    if (!ex) return res.status(400).json({ message: 'ไม่รู้จักแบบฝึกหัดนี้' });

    const s = await getState(req.user.id);
    const w = toWork(s);
    if (w.hints <= 0) return res.json({ ok: false, reason: 'no_hints', state: w });

    w.hints -= 1;
    const row = await prisma.pythonState.update({ where: { user_id: req.user.id }, data: { hints: w.hints } });
    res.json({ ok: true, hint: ex.hint, state: toWork(row) });
  } catch (err) {
    console.error('[PYTHON] hint', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/char-name', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 16) || 'PyBot';
    await getState(req.user.id);
    const row = await prisma.pythonState.update({ where: { user_id: req.user.id }, data: { char_name: name } });
    res.json({ ok: true, state: toWork(row) });
  } catch (err) {
    console.error('[PYTHON] char-name', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// อันดับคะแนน Python ของทั้งห้อง
router.get('/leaderboard', async (req, res) => {
  try {
    const rows = await prisma.pythonState.findMany({
      orderBy: [{ score: 'desc' }, { xp: 'desc' }],
      take: 50,
      include: { user: { select: { id: true, name: true, student_number: true } } },
    });
    res.json(rows.map((r, i) => ({
      rank: i + 1,
      userId: r.user_id,
      name: r.user?.name || '-',
      studentNumber: r.user?.student_number || '',
      charName: r.char_name,
      score: r.score,
      level: r.level,
      xp: r.xp,
      exercises: countTrue(r.exercises),
      missions: countTrue(r.missions),
      me: r.user_id === req.user.id,
    })));
  } catch (err) {
    console.error('[PYTHON] leaderboard', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ── ADMIN ───────────────────────────────────────────────── */

router.get('/admin/list', restrictTo('ADMIN'), async (req, res) => {
  try {
    const rows = await prisma.pythonState.findMany({
      orderBy: { updated_at: 'desc' },
      include: { user: { select: { id: true, name: true, username: true, role: true } } },
    });
    res.json(rows.map(r => ({
      userId: r.user_id,
      owner: r.user?.name || '-',
      username: r.user?.username || '-',
      role: r.user?.role || '-',
      charName: r.char_name,
      score: r.score,
      bestScore: r.best_score,
      level: r.level,
      xp: r.xp,
      hints: r.hints,
      learned: countTrue(r.learned),
      exercises: countTrue(r.exercises),
      missions: countTrue(r.missions),
      rewards: countTrue(r.rewards),
      updatedAt: r.updated_at,
    })));
  } catch (err) {
    console.error('[PYTHON] admin/list', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// mode: hints = เติมคำใบ้ · progress = ล้างความคืบหน้าแต่เก็บคะแนนเดิม · full = ล้างทุกอย่าง
router.post('/admin/reset/:userId', restrictTo('ADMIN'), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (!userId) return res.status(400).json({ message: 'userId ไม่ถูกต้อง' });
    const mode = String(req.body?.mode || 'progress');

    await getState(userId);
    const data =
      mode === 'hints'
        ? { hints: HINTS_MAX }
        : mode === 'full'
          ? { score: 0, best_score: 0, xp: 0, level: 1, hints: 5, learned: {}, missions: {}, rewards: { r1: true }, exercises: {}, history: [], ran_input: false }
          : { xp: 0, level: 1, learned: {}, missions: {}, rewards: { r1: true }, exercises: {}, ran_input: false };

    const row = await prisma.pythonState.update({ where: { user_id: userId }, data });
    console.log(`[PYTHON ADMIN] ${req.user.username} reset user ${userId} (mode=${mode})`);
    res.json({ ok: true, state: toWork(row) });
  } catch (err) {
    console.error('[PYTHON] admin/reset', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
