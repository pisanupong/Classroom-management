const prisma = require('../config/db');

// helper: parse date string to start/end of day UTC
const dayRange = (dateStr) => {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return { start, end };
};

// GET /api/daily-homework?date=YYYY-MM-DD
const getHomework = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const { start, end } = dayRange(dateStr);

    const items = await prisma.dailyHomework.findMany({
      where: {
        student_id: req.user.id,
        date: { gte: start, lt: end },
      },
      orderBy: [{ done: 'asc' }, { created_at: 'asc' }],
    });

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// POST /api/daily-homework
const createHomework = async (req, res) => {
  try {
    const { subject, detail, date } = req.body;
    if (!subject || !date) {
      return res.status(400).json({ message: 'กรุณากรอกวิชาและวันที่' });
    }

    const { start } = dayRange(date);

    const item = await prisma.dailyHomework.create({
      data: {
        student_id: req.user.id,
        subject,
        detail: detail || null,
        date: start,
      },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// PATCH /api/daily-homework/:id/toggle
const toggleDone = async (req, res) => {
  try {
    const item = await prisma.dailyHomework.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!item) return res.status(404).json({ message: 'ไม่พบรายการ' });
    if (item.student_id !== req.user.id) return res.status(403).json({ message: 'ไม่มีสิทธิ์' });

    const updated = await prisma.dailyHomework.update({
      where: { id: item.id },
      data: { done: !item.done },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// DELETE /api/daily-homework/:id
const deleteHomework = async (req, res) => {
  try {
    const item = await prisma.dailyHomework.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!item) return res.status(404).json({ message: 'ไม่พบรายการ' });
    if (item.student_id !== req.user.id) return res.status(403).json({ message: 'ไม่มีสิทธิ์' });

    await prisma.dailyHomework.delete({ where: { id: item.id } });
    res.json({ message: 'ลบสำเร็จ' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// GET /api/daily-homework/summary?days=7  — streak & stats
const getSummary = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    since.setHours(0, 0, 0, 0);

    const items = await prisma.dailyHomework.findMany({
      where: { student_id: req.user.id, date: { gte: since } },
    });

    // Group by date
    const byDate = {};
    items.forEach(i => {
      const key = i.date.toISOString().slice(0, 10);
      if (!byDate[key]) byDate[key] = { total: 0, done: 0 };
      byDate[key].total++;
      if (i.done) byDate[key].done++;
    });

    res.json({ byDate, total: items.length, done: items.filter(i => i.done).length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// GET /api/daily-homework/all?date=YYYY-MM-DD — CLASS_ADMIN/TEACHER ดูทุกคน
const getAllStudentsHomework = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const { start, end } = dayRange(dateStr);

    const items = await prisma.dailyHomework.findMany({
      where: { date: { gte: start, lt: end } },
      include: { student: { select: { id: true, name: true, student_number: true } } },
      orderBy: [{ student: { student_number: 'asc' } }, { done: 'asc' }],
    });

    // Group by student
    const byStudent = {};
    items.forEach(item => {
      const sid = item.student_id;
      if (!byStudent[sid]) byStudent[sid] = { student: item.student, items: [] };
      byStudent[sid].items.push(item);
    });

    res.json(Object.values(byStudent));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = { getHomework, createHomework, toggleDone, deleteHomework, getSummary, getAllStudentsHomework };
