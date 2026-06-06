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
    const { subject, detail, date, homework_type, due_date, submit_location } = req.body;
    if (!subject || !date) {
      return res.status(400).json({ message: 'กรุณากรอกวิชาและวันที่' });
    }

    const VALID_TYPES     = ['หนังสือ', 'สมุด', 'รายงาน', 'อื่นๆ'];
    const VALID_LOCATIONS = ['classroom', 'ในห้องเรียน', 'โต๊ะครู'];
    const { start } = dayRange(date);

    const item = await prisma.dailyHomework.create({
      data: {
        student_id:      req.user.id,
        subject,
        detail:          detail || null,
        homework_type:   VALID_TYPES.includes(homework_type) ? homework_type : 'อื่นๆ',
        due_date:        due_date ? new Date(due_date) : null,
        submit_location: VALID_LOCATIONS.includes(submit_location) ? submit_location : 'ในห้องเรียน',
        date:            start,
      },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// PUT /api/daily-homework/:id  — CLASS_ADMIN and above only
const updateHomework = async (req, res) => {
  try {
    const item = await prisma.dailyHomework.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!item) return res.status(404).json({ message: 'ไม่พบรายการ' });

    const { ROLE_LEVEL } = require('../middleware/authMiddleware');
    // ต้องเป็นเจ้าของ หรือ มี role สูงกว่า STUDENT
    if (item.student_id !== req.user.id && ROLE_LEVEL[req.user.role] < 1) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไข' });
    }

    const { subject, detail, homework_type, due_date, submit_location } = req.body;
    const VALID_TYPES     = ['หนังสือ', 'สมุด', 'รายงาน', 'อื่นๆ'];
    const VALID_LOCATIONS = ['classroom', 'ในห้องเรียน', 'โต๊ะครู'];

    const updated = await prisma.dailyHomework.update({
      where: { id: item.id },
      data: {
        ...(subject          && { subject }),
        detail:          detail !== undefined ? (detail || null) : item.detail,
        ...(homework_type    && VALID_TYPES.includes(homework_type)     && { homework_type }),
        ...(submit_location  && VALID_LOCATIONS.includes(submit_location) && { submit_location }),
        due_date: due_date === '' ? null : due_date ? new Date(due_date) : item.due_date,
      },
    });
    res.json(updated);
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

// GET /api/daily-homework/:id/detail — รายละเอียด + submissions + reads
const getHomeworkDetail = async (req, res) => {
  try {
    const item = await prisma.dailyHomework.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        student: { select: { id:true, name:true, student_number:true, role:true } },
        submissions: {
          include: { student: { select: { id:true, name:true, student_number:true } } },
          orderBy: { submitted_at: 'asc' },
        },
        reads: {
          include: { student: { select: { id:true, name:true, student_number:true } } },
          orderBy: { viewed_at: 'asc' },
        },
      },
    });
    if (!item) return res.status(404).json({ message: 'ไม่พบรายการ' });

    // mark as read (upsert)
    await prisma.homeworkRead.upsert({
      where:  { homework_id_student_id: { homework_id: item.id, student_id: req.user.id } },
      create: { homework_id: item.id, student_id: req.user.id },
      update: { viewed_at: new Date() },
    });

    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// POST /api/daily-homework/:id/submit — นักเรียนส่งการบ้าน
const submitHomework = async (req, res) => {
  try {
    const { submitted_at, note } = req.body;
    const homework_id = parseInt(req.params.id);

    if (!submitted_at) return res.status(400).json({ message: 'กรุณาระบุวันเวลาที่ส่ง' });

    const item = await prisma.dailyHomework.findUnique({ where: { id: homework_id } });
    if (!item) return res.status(404).json({ message: 'ไม่พบรายการ' });
    if (item.student_id !== req.user.id) return res.status(403).json({ message: 'ไม่ใช่การบ้านของคุณ' });

    // ตรวจว่าส่งช้าหรือไม่
    const isLate = item.due_date && new Date(submitted_at) > new Date(item.due_date);

    const submission = await prisma.homeworkSubmission.upsert({
      where:  { homework_id_student_id: { homework_id, student_id: req.user.id } },
      create: { homework_id, student_id: req.user.id, submitted_at: new Date(submitted_at), note: note||null, status: isLate ? 'LATE' : 'SUBMITTED' },
      update: { submitted_at: new Date(submitted_at), note: note||null, status: isLate ? 'LATE' : 'SUBMITTED', updated_at: new Date() },
      include: { student: { select: { id:true, name:true } } },
    });

    // auto-toggle done
    await prisma.dailyHomework.update({ where: { id: homework_id }, data: { done: true } });

    res.json(submission);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// PATCH /api/daily-homework/:id/submission-status — ครู/ประธาน เปลี่ยนสถานะ
const updateSubmissionStatus = async (req, res) => {
  try {
    const { status, student_id } = req.body;
    const VALID = ['SUBMITTED','APPROVED','LATE','REJECTED'];
    if (!VALID.includes(status)) return res.status(400).json({ message: 'status ไม่ถูกต้อง' });

    const homework_id = parseInt(req.params.id);
    const sid = parseInt(student_id) || req.user.id;

    const submission = await prisma.homeworkSubmission.update({
      where:  { homework_id_student_id: { homework_id, student_id: sid } },
      data:   { status },
      include: { student: { select: { id:true, name:true } } },
    });
    res.json(submission);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ message: 'ไม่พบการส่งงาน' });
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = { getHomework, createHomework, updateHomework, toggleDone, deleteHomework, getSummary, getAllStudentsHomework, getHomeworkDetail, submitHomework, updateSubmissionStatus };
