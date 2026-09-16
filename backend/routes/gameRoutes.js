const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const prisma = require('../config/db');

router.use(protect);

// List available quizzes for game selection
router.get('/quizzes', async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { is_active: true },
      select: { id: true, title: true, description: true, _count: { select: { questions: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.json(quizzes);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Get quiz questions for game (without revealing correct answers to client)
router.get('/quizzes/:id/questions', async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        questions: {
          select: {
            id: true,
            question_text: true,
            choices: true,
            // correct_answer intentionally omitted — server validates
          },
        },
      },
    });
    if (!quiz) return res.status(404).json({ message: 'ไม่พบชุดคำถาม' });
    res.json(quiz);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ตารางอันดับ + อัตราชนะ/แพ้
router.get('/leaderboard', async (req, res) => {
  try {
    const stats = await prisma.battleStats.findMany({
      include: { user: { select: { id: true, name: true, character_data: true, total_points: true } } },
      orderBy: [{ wins: 'desc' }, { losses: 'asc' }],
      take: 50,
    });

    const rows = stats
      .filter(s => s.user && (s.wins + s.losses) > 0)
      .map(s => {
        const played = s.wins + s.losses;
        return {
          userId: s.user.id,
          name: s.user.name,
          character: s.user.character_data,
          wins: s.wins,
          losses: s.losses,
          played,
          winRate: Math.round((s.wins / played) * 100),
          points: s.user.total_points,
        };
      })
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.losses - b.losses)
      .map((r, i) => ({ rank: i + 1, ...r }));

    const me = rows.find(r => r.userId === req.user.id) || {
      rank: null, userId: req.user.id, name: req.user.name,
      wins: 0, losses: 0, played: 0, winRate: 0,
    };

    res.json({ rows, me });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
