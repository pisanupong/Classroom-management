const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe } = require('../controllers/userController');
const bcrypt = require('bcrypt');
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

// Change own password
router.put('/me/password', protect, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ message: 'กรุณากรอกรหัสผ่านให้ครบ' });
    if (new_password.length < 4)
      return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });

    const hash = await bcrypt.hash(new_password, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password_hash: hash } });
    res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
