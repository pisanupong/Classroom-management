const prisma = require('../config/db');

// @desc    Get all events + assignments for calendar
// @route   GET /api/events/calendar?year=2026&month=5
// @access  Private
const getCalendarData = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month); // 0-indexed (0=Jan)

    let startDate, endDate;
    if (month !== undefined && !isNaN(month)) {
      // Return full month range + padding weeks
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    } else {
      // Return whole year
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    }

    const [events, assignments] = await Promise.all([
      prisma.event.findMany({
        where: {
          start_date: { gte: startDate, lte: endDate },
        },
        include: { creator: { select: { id: true, name: true } } },
        orderBy: { start_date: 'asc' },
      }),
      prisma.assignment.findMany({
        where: {
          due_date: { gte: startDate, lte: endDate },
        },
        include: {
          teacher: { select: { id: true, name: true } },
          submissions: req.user.role === 'STUDENT'
            ? { where: { student_id: req.user.id }, select: { id: true, status: true } }
            : { select: { id: true } },
        },
        orderBy: { due_date: 'asc' },
      }),
    ]);

    res.json({ events, assignments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get all events
// @route   GET /api/events
// @access  Private
const getEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { start_date: 'asc' },
    });
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Create event (Teacher only)
// @route   POST /api/events
// @access  Private (TEACHER)
const createEvent = async (req, res) => {
  try {
    const { title, description, start_date, end_date, color, event_type, is_all_day } = req.body;
    if (!title || !start_date) return res.status(400).json({ message: 'กรุณาใส่ชื่อและวันที่' });

    const event = await prisma.event.create({
      data: {
        title,
        description: description || null,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        color: color || '#7c3aed',
        event_type: ['EVENT','HOLIDAY','SCHOOL'].includes(event_type) ? event_type : 'EVENT',
        is_all_day: !!is_all_day,
        created_by: req.user.id,
      },
    });
    res.status(201).json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// GET /api/events/upcoming?days=7 — สำหรับ notifications
const getUpcoming = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const now  = new Date();
    const end  = new Date(now.getTime() + days * 86400000);
    const [events, assignments] = await Promise.all([
      prisma.event.findMany({
        where: { start_date: { gte: now, lte: end } },
        orderBy: { start_date: 'asc' },
      }),
      prisma.assignment.findMany({
        where: { due_date: { gte: now, lte: end } },
        include: {
          submissions: { where: { student_id: req.user.id }, select: { id: true } },
        },
        orderBy: { due_date: 'asc' },
      }),
    ]);
    res.json({ events, assignments });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// @desc    Delete event (Teacher/creator only)
// @route   DELETE /api/events/:id
// @access  Private (TEACHER)
const deleteEvent = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await prisma.event.delete({ where: { id: event.id } });
    res.json({ message: 'Event deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = { getCalendarData, getEvents, createEvent, deleteEvent, getUpcoming };
