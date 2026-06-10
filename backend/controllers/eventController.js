const prisma = require('../config/db');
const { ROLE_LEVEL } = require('../middleware/authMiddleware');
const { notifyNewEvent } = require('../services/lineService');

// ── helpers ─────────────────────────────────────────────────────────────────
const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

// @desc    Get all events + assignments + daily-homework due dates for calendar
// @route   GET /api/events/calendar?year=2026&month=5
const getCalendarData = async (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month);

    let startDate, endDate;
    if (month !== undefined && !isNaN(month)) {
      startDate = new Date(year, month - 1, 1);
      endDate   = new Date(year, month, 0, 23, 59, 59);
    } else {
      startDate = new Date(year, 0, 1);
      endDate   = new Date(year, 11, 31, 23, 59, 59);
    }

    const [events, assignments, dailyHomework] = await Promise.all([
      prisma.event.findMany({
        where: {
          start_date: { gte: startDate, lte: endDate },
          OR: [
            { is_personal: false },
            { is_personal: true, created_by: req.user.id },
          ],
        },
        include: { creator: { select: { id: true, name: true } } },
        orderBy: { start_date: 'asc' },
      }),
      prisma.assignment.findMany({
        where: { due_date: { gte: startDate, lte: endDate } },
        include: {
          teacher: { select: { id: true, name: true } },
          submissions: req.user.role === 'STUDENT'
            ? { where: { student_id: req.user.id }, select: { id: true, status: true } }
            : { select: { id: true } },
        },
        orderBy: { due_date: 'asc' },
      }),
      // Personal homework with due_date
      prisma.dailyHomework.findMany({
        where: {
          student_id: req.user.id,
          due_date:   { gte: startDate, lte: endDate },
          due_date:   { not: null },
        },
        orderBy: { due_date: 'asc' },
      }),
    ]);

    res.json({ events, assignments, dailyHomework });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @route   GET /api/events
const getEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: {
        OR: [
          { is_personal: false },
          { is_personal: true, created_by: req.user.id },
        ],
      },
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { start_date: 'asc' },
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @route   POST /api/events  — CLASS_ADMIN+ (announcements) or any user (personal NOTE)
const createEvent = async (req, res) => {
  try {
    const { title, description, start_date, end_date, color, event_type, is_all_day, is_personal } = req.body;
    if (!title || !start_date) return res.status(400).json({ message: 'กรุณาใส่ชื่อและวันที่' });

    const isNote = event_type === 'NOTE';

    // Non-note events require CLASS_ADMIN+
    if (!isNote && ROLE_LEVEL[req.user.role] < ROLE_LEVEL['CLASS_ADMIN']) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์สร้างกิจกรรม' });
    }

    const VALID_TYPES = ['EVENT','HOLIDAY','SCHOOL','NOTE'];
    const event = await prisma.event.create({
      data: {
        title,
        description:  description || null,
        start_date:   new Date(start_date),
        end_date:     end_date ? new Date(end_date) : null,
        color:        color || (isNote ? '#fbbf24' : '#7c3aed'),
        event_type:   VALID_TYPES.includes(event_type) ? event_type : 'EVENT',
        is_all_day:   !!is_all_day,
        is_personal:  isNote ? true : false,
        created_by:   req.user.id,
      },
      include: { creator: { select: { id: true, name: true } } },
    });
    // LINE notify ทุกคนที่ผูก LINE (เฉพาะ public event)
    if (!event.is_personal) {
      const users = await prisma.user.findMany({ where: { line_user_id: { not: null } }, select: { line_user_id: true } });
      users.forEach(u => notifyNewEvent(u.line_user_id, event));
    }

    res.status(201).json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @route   PUT /api/events/:id
const updateEvent = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!event) return res.status(404).json({ message: 'ไม่พบกิจกรรม' });

    // ต้องเป็นเจ้าของ หรือ ADMIN+
    if (event.created_by !== req.user.id && ROLE_LEVEL[req.user.role] < ROLE_LEVEL['ADMIN']) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์แก้ไข' });
    }

    const { title, description, start_date, end_date, color, event_type, is_all_day } = req.body;
    const VALID_TYPES = ['EVENT','HOLIDAY','SCHOOL','NOTE'];

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: {
        ...(title       && { title }),
        description: description !== undefined ? (description || null) : event.description,
        ...(start_date  && { start_date: new Date(start_date) }),
        end_date:    end_date === '' ? null : end_date ? new Date(end_date) : event.end_date,
        ...(color       && { color }),
        ...(event_type  && VALID_TYPES.includes(event_type) && { event_type }),
        ...(is_all_day  !== undefined && { is_all_day: !!is_all_day }),
      },
      include: { creator: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @route   DELETE /api/events/:id
const deleteEvent = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // เจ้าของ หรือ ADMIN+
    if (event.created_by !== req.user.id && ROLE_LEVEL[req.user.role] < ROLE_LEVEL['ADMIN']) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await prisma.event.delete({ where: { id: event.id } });
    res.json({ message: 'ลบสำเร็จ' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @route   GET /api/events/upcoming?days=7
const getUpcoming = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const now  = new Date();
    const end  = new Date(now.getTime() + days * 86400000);

    const [events, assignments] = await Promise.all([
      prisma.event.findMany({
        where: {
          start_date: { gte: now, lte: end },
          OR: [{ is_personal: false }, { is_personal: true, created_by: req.user.id }],
        },
        orderBy: { start_date: 'asc' },
      }),
      prisma.assignment.findMany({
        where: { due_date: { gte: now, lte: end } },
        include: { submissions: { where: { student_id: req.user.id }, select: { id: true } } },
        orderBy: { due_date: 'asc' },
      }),
    ]);
    res.json({ events, assignments });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// @route   POST /api/events/import-csv  — CLASS_ADMIN+
const importHolidays = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'ไม่พบไฟล์' });

    const text = req.file.buffer.toString('utf-8').replace(/^﻿/, ''); // strip BOM
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ message: 'ไฟล์ว่างเปล่าหรือไม่ถูกรูปแบบ' });

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const idx = {
      subject:     headers.findIndex(h => h.includes('subject') || h.includes('ชื่อ')),
      start:       headers.findIndex(h => h.includes('start')),
      end:         headers.findIndex(h => h.includes('end')),
      description: headers.findIndex(h => h.includes('description') || h.includes('คำอธิบาย')),
    };

    const created = []; const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const title     = cols[idx.subject]     || '';
      const startStr  = cols[idx.start]       || '';
      const endStr    = cols[idx.end]         || '';
      const desc      = cols[idx.description] || '';

      if (!title || !startStr) { errors.push(`แถว ${i+1}: ไม่มีชื่อหรือวันที่`); continue; }

      try {
        const startDate = new Date(startStr);
        const endDate   = endStr ? new Date(endStr) : null;
        if (isNaN(startDate)) { errors.push(`แถว ${i+1}: วันที่ไม่ถูกต้อง`); continue; }

        await prisma.event.create({
          data: {
            title, description: desc || null,
            start_date:  startDate,
            end_date:    endDate,
            color:       '#ef4444',
            event_type:  'HOLIDAY',
            is_all_day:  true,
            is_personal: false,
            created_by:  req.user.id,
          },
        });
        created.push(title);
      } catch (e) {
        if (e.code === 'P2002') errors.push(`${title}: มีอยู่แล้ว`);
        else errors.push(`${title}: ${e.message}`);
      }
    }

    res.json({
      message: `นำเข้าสำเร็จ ${created.length} รายการ, ข้อผิดพลาด ${errors.length} รายการ`,
      created, errors,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = { getCalendarData, getEvents, createEvent, updateEvent, deleteEvent, getUpcoming, importHolidays };
