const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const { ROLE_LEVEL } = require('../middleware/authMiddleware');

const VALID_ROLES = ['STUDENT', 'CLASS_ADMIN', 'TEACHER', 'ADMIN', 'SUPER_USER'];

// GET /api/admin/users?search=&role=
const getUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const where = {};
    if (role && VALID_ROLES.includes(role)) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { student_number: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        student_number: true,
        total_points: true,
        _count: { select: { submissions: true } },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// PUT /api/admin/users/:id
const updateUser = async (req, res) => {
  try {
    const { name, role, student_number, password } = req.body;
    const userId = parseInt(req.params.id);
    const actorLevel = ROLE_LEVEL[req.user.role];

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'ไม่สามารถแก้ไขบัญชีตัวเองจากเมนูนี้ได้' });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

    // Cannot edit someone at same or higher level
    if (ROLE_LEVEL[target.role] >= actorLevel) {
      return res.status(403).json({ message: 'ไม่สามารถแก้ไขผู้ใช้ที่มีสิทธิ์เท่ากันหรือสูงกว่าได้' });
    }

    // Cannot assign role higher than actor's own level
    if (role && ROLE_LEVEL[role] >= actorLevel) {
      return res.status(403).json({ message: 'ไม่สามารถกำหนด role ที่สูงกว่าสิทธิ์ของตัวเองได้' });
    }

    const data = {};
    if (name) data.name = name;
    if (role && VALID_ROLES.includes(role)) data.role = role;
    if (student_number !== undefined) data.student_number = student_number || null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      data.password_hash = await bcrypt.hash(password, salt);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, name: true, role: true, student_number: true, total_points: true },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const actorLevel = ROLE_LEVEL[req.user.role];

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'ไม่สามารถลบบัญชีตัวเองได้' });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

    if (ROLE_LEVEL[target.role] >= actorLevel) {
      return res.status(403).json({ message: 'ไม่สามารถลบผู้ใช้ที่มีสิทธิ์เท่ากันหรือสูงกว่าได้' });
    }

    // Cascade delete
    await prisma.submission.deleteMany({ where: { student_id: userId } });
    await prisma.dailyHomework.deleteMany({ where: { student_id: userId } });
    await prisma.rewardLog.deleteMany({ where: { student_id: userId } });
    await prisma.quizAttempt.deleteMany({ where: { student_id: userId } });
    await prisma.treasury.deleteMany({ where: { student_id: userId } });
    await prisma.event.deleteMany({ where: { created_by: userId } });
    const userAssignments = await prisma.assignment.findMany({ where: { created_by: userId }, select: { id: true } });
    const aIds = userAssignments.map(a => a.id);
    if (aIds.length > 0) {
      await prisma.submission.deleteMany({ where: { assignment_id: { in: aIds } } });
      await prisma.assignment.deleteMany({ where: { id: { in: aIds } } });
    }
    await prisma.user.delete({ where: { id: userId } });

    res.json({ message: 'ลบผู้ใช้สำเร็จ' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = { getUsers, updateUser, deleteUser };
