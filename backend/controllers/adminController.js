const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const xlsx  = require('xlsx');
const { ROLE_LEVEL } = require('../middleware/authMiddleware');

const VALID_ROLES = ['STUDENT', 'PARENT', 'STAFF', 'CLASS_ADMIN', 'TEACHER', 'ADMIN', 'SUPER_USER'];

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

// POST /api/admin/users  — create single user
const createUser = async (req, res) => {
  try {
    const { username, name, password, role = 'STUDENT', student_number } = req.body;
    const actorLevel = ROLE_LEVEL[req.user.role];

    if (!username || !name || !password)
      return res.status(400).json({ message: 'กรุณากรอก username, ชื่อ และรหัสผ่าน' });
    if (role && ROLE_LEVEL[role] >= actorLevel)
      return res.status(403).json({ message: 'ไม่สามารถสร้าง role ที่สูงกว่าสิทธิ์ตัวเอง' });

    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return res.status(400).json({ message: `username "${username}" ถูกใช้แล้ว` });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: { username, name, password_hash, role: VALID_ROLES.includes(role) ? role : 'STUDENT', student_number: student_number || null },
      select: { id: true, username: true, name: true, role: true, student_number: true, total_points: true },
    });
    res.status(201).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// POST /api/admin/users/import  — import from Excel
const importUsers = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'ไม่พบไฟล์ Excel' });
    const actorLevel = ROLE_LEVEL[req.user.role];

    const wb  = xlsx.read(req.file.buffer, { type: 'buffer' });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

    const results = { created: [], skipped: [], errors: [] };

    for (const row of rows) {
      // รองรับหัวคอลัมน์ทั้งภาษาไทยและอังกฤษ
      const username       = String(row['username'] || row['Username'] || row['ชื่อผู้ใช้'] || '').trim();
      const name           = String(row['name']     || row['Name']     || row['ชื่อ-นามสกุล'] || row['ชื่อ'] || '').trim();
      const password       = String(row['password'] || row['Password'] || row['รหัสผ่าน'] || '').trim();
      const role           = String(row['role']     || row['Role']     || row['สิทธิ์'] || 'STUDENT').trim().toUpperCase();
      const student_number = String(row['student_number'] || row['รหัสนักเรียน'] || '').trim();

      if (!username || !name) { results.errors.push({ row: username || '?', reason: 'ไม่มี username หรือ ชื่อ' }); continue; }
      if (!VALID_ROLES.includes(role)) { results.errors.push({ row: username, reason: `role "${role}" ไม่ถูกต้อง` }); continue; }
      if (ROLE_LEVEL[role] >= actorLevel) { results.errors.push({ row: username, reason: 'role สูงเกินสิทธิ์ของคุณ' }); continue; }

      const exists = await prisma.user.findUnique({ where: { username } });
      if (exists) { results.skipped.push(username); continue; }

      const finalPass = password || username; // default password = username
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(finalPass, salt);

      await prisma.user.create({
        data: { username, name, password_hash, role, student_number: student_number || null },
      });
      results.created.push(username);
    }

    res.json({
      message: `นำเข้าสำเร็จ ${results.created.length} คน, ข้าม ${results.skipped.length} คน, ผิดพลาด ${results.errors.length} รายการ`,
      ...results,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = { getUsers, createUser, importUsers, updateUser, deleteUser };
