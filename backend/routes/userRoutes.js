const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const prisma = require('../config/db');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);

// Save character data
router.put('/me/character', protect, async (req, res) => {
  try {
    const { grid, width, height } = req.body;
    if (!grid || !width || !height) return res.status(400).json({ message: 'ข้อมูลไม่ครบ' });
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { character_data: { grid, width, height } },
      select: { id: true, character_data: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
