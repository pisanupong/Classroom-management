const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const { protect: authenticate } = require('../middleware/authMiddleware');
function isThai(word) {
  return /[฀-๿]/.test(word);
}

// POST /api/pet/feed
// Body: { word: string }
// Returns: { ok, pts, status: 'fed'|'duplicate'|'invalid'|'unverified', usedBy? }
router.post('/feed', authenticate, async (req, res) => {
  try {
    const { word } = req.body;
    if (!word || typeof word !== 'string') return res.status(400).json({ message: 'กรุณาส่งคำศัพท์' });

    const trimmed = word.trim().toLowerCase();
    if (trimmed.length < 2) return res.status(400).json({ message: 'คำต้องยาวอย่างน้อย 2 ตัวอักษร' });

    // 1. Check global duplicate
    const existing = await prisma.petWord.findUnique({
      where: { word: trimmed },
      include: { user: { select: { name: true } } },
    });
    if (existing) {
      const isSelf = existing.used_by === req.user.id;
      return res.json({
        ok: false,
        status: 'duplicate',
        usedBy: isSelf ? 'คุณเอง' : existing.user.name,
      });
    }

    // 2. Save word
    await prisma.petWord.create({
      data: { word: trimmed, used_by: req.user.id },
    });

    const pts = trimmed.length * 3;
    let validationStatus = 'fed';

    // 4. Update pet state
    await prisma.petState.upsert({
      where: { user_id: req.user.id },
      create: { user_id: req.user.id, hunger: Math.min(100, 60 + pts), total_words: 1 },
      update: { hunger: { increment: pts }, total_words: { increment: 1 } },
    });
    // Cap hunger at 100
    await prisma.petState.update({
      where: { user_id: req.user.id },
      data: { hunger: { set: undefined } }, // re-fetch to cap
    }).catch(() => {});
    const state = await prisma.petState.findUnique({ where: { user_id: req.user.id } });
    if (state && state.hunger > 100) {
      await prisma.petState.update({ where: { user_id: req.user.id }, data: { hunger: 100 } });
    }

    res.json({ ok: true, status: validationStatus, pts });
  } catch (err) {
    console.error('pet/feed error:', err.message);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// GET /api/pet/state — load pet state + word history
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
    res.json({ state, words });
  } catch (err) {
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// PUT /api/pet/state — sync hunger + name from client tick
router.put('/state', authenticate, async (req, res) => {
  try {
    const { hunger, pet_name } = req.body;
    const data = {};
    if (typeof hunger === 'number') data.hunger = Math.max(0, Math.min(100, hunger));
    if (pet_name) data.pet_name = pet_name;
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

module.exports = router;
