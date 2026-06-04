const express = require('express');
const router = express.Router();
const { getDashboard } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const prisma = require('../config/db');

router.get('/', protect, getDashboard);

// Public leaderboard — anyone logged in can see
router.get('/leaderboard', protect, async (req, res) => {
  try {
    const players = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: { id: true, name: true, student_number: true, total_points: true, character_data: true },
      orderBy: { total_points: 'desc' },
    });
    res.json(players);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
