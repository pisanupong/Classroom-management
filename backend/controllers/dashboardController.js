const prisma = require('../config/db');

// GET /api/dashboard
const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const onlineThreshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 min
    const next7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [assignments, onlineUsers, leaderboard, calendarData] = await Promise.all([
      // All assignments with submission details
      prisma.assignment.findMany({
        include: {
          teacher: { select: { id: true, name: true } },
          submissions: {
            include: {
              student: { select: { id: true, name: true, student_number: true } },
            },
          },
        },
        orderBy: { due_date: 'asc' },
      }),

      // Online users (active in last 5 min)
      prisma.user.findMany({
        where: { last_active: { gte: onlineThreshold } },
        select: { id: true, name: true, role: true, last_active: true },
        orderBy: { last_active: 'desc' },
      }),

      // Leaderboard top 10 students by points
      prisma.user.findMany({
        where: { role: 'STUDENT' },
        select: { id: true, name: true, student_number: true, total_points: true, last_active: true },
        orderBy: { total_points: 'desc' },
        take: 10,
      }),

      // This month calendar
      prisma.event.findMany({
        where: { start_date: { gte: monthStart, lte: monthEnd } },
        include: { creator: { select: { id: true, name: true } } },
        orderBy: { start_date: 'asc' },
      }),
    ]);

    // Deadlines within 7 days
    const upcomingDeadlines = assignments.filter(a => {
      const due = new Date(a.due_date);
      return due >= now && due <= next7days;
    });

    // My submission status (for students)
    const mySubmissions = req.user.role === 'STUDENT'
      ? assignments.map(a => ({
          assignment_id: a.id,
          title: a.title,
          due_date: a.due_date,
          max_score: a.max_score,
          submission: a.submissions.find(s => s.student_id === req.user.id) || null,
        }))
      : null;

    res.json({
      assignments,
      upcomingDeadlines,
      onlineUsers,
      leaderboard,
      calendarEvents: calendarData,
      mySubmissions,
      stats: {
        totalAssignments: assignments.length,
        totalSubmissions: assignments.reduce((sum, a) => sum + a.submissions.length, 0),
        onlineCount: onlineUsers.length,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = { getDashboard };
