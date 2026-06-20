const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const { protect: authenticate } = require('../middleware/authMiddleware');

// POST /api/pet/feed
router.post('/feed', authenticate, async (req, res) => {
  try {
    const { word } = req.body;
    if (!word || typeof word !== 'string') return res.status(400).json({ message: 'กรุณาส่งคำศัพท์' });
    const trimmed = word.trim().toLowerCase();
    if (trimmed.length < 2) return res.status(400).json({ message: 'คำต้องยาวอย่างน้อย 2 ตัวอักษร' });

    const existing = await prisma.petWord.findUnique({
      where: { word: trimmed },
      include: { user: { select: { name: true } } },
    });
    if (existing) {
      const isSelf = existing.used_by === req.user.id;
      return res.json({ ok: false, status: 'duplicate', usedBy: isSelf ? 'คุณเอง' : existing.user.name });
    }

    await prisma.petWord.create({ data: { word: trimmed, used_by: req.user.id } });

    const pts = trimmed.length * 3;
    const xpGain = trimmed.length;

    const current = await prisma.petState.findUnique({ where: { user_id: req.user.id } });
    const newHunger = Math.min(100, (current?.hunger ?? 60) + pts);
    const newXp = (current?.xp ?? 0) + xpGain;

    await prisma.petState.upsert({
      where: { user_id: req.user.id },
      create: { user_id: req.user.id, hunger: newHunger, xp: newXp, total_words: 1 },
      update: { hunger: newHunger, xp: newXp, total_words: { increment: 1 } },
    });

    res.json({ ok: true, status: 'fed', pts, xpGain, newXp });
  } catch (err) {
    console.error('pet/feed error:', err.message);
    res.status(500).json({ message: 'เกิดข้อผิดพลาด' });
  }
});

// GET /api/pet/state
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

// PUT /api/pet/state
router.put('/state', authenticate, async (req, res) => {
  try {
    const { hunger, pet_name, pet_type } = req.body;
    const data = {};
    if (typeof hunger === 'number') data.hunger = Math.max(0, Math.min(100, hunger));
    if (pet_name) data.pet_name = pet_name;
    if (pet_type) data.pet_type = pet_type;
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
