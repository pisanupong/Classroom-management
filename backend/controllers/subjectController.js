const prisma = require('../config/db');

// GET /api/subjects
const getSubjects = async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      include: { teacher: { select: { id: true, name: true, role: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(subjects);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/subjects
const createSubject = async (req, res) => {
  try {
    const { name, teacher_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'กรุณาใส่ชื่อวิชา' });
    const subject = await prisma.subject.create({
      data: { name: name.trim(), teacher_id: teacher_id ? parseInt(teacher_id) : null },
      include: { teacher: { select: { id: true, name: true } } },
    });
    res.status(201).json(subject);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ message: 'มีวิชานี้แล้ว' });
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/subjects/:id
const updateSubject = async (req, res) => {
  try {
    const { name, teacher_id } = req.body;
    const subject = await prisma.subject.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(name && { name: name.trim() }),
        teacher_id: teacher_id ? parseInt(teacher_id) : null,
      },
      include: { teacher: { select: { id: true, name: true } } },
    });
    res.json(subject);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/subjects/:id
const deleteSubject = async (req, res) => {
  try {
    await prisma.subject.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'ลบวิชาแล้ว' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/subjects/teachers — list teachers for dropdown
const getTeachers = async (req, res) => {
  try {
    const teachers = await prisma.user.findMany({
      where: { role: { in: ['TEACHER', 'ADMIN', 'SUPER_USER'] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
    res.json(teachers);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getSubjects, createSubject, updateSubject, deleteSubject, getTeachers };
