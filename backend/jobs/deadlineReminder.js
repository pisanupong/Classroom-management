const cron = require('node-cron');
const prisma = require('../config/db');
const { notifyDeadline } = require('../services/lineService');

// ทุกวัน 8:00 น. — แจ้งเตือนการบ้านที่ due วันนี้และพรุ่งนี้
const startDeadlineReminder = () => {
  cron.schedule('0 8 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);

      // หาการบ้านที่ due วันนี้หรือพรุ่งนี้ และยังไม่ส่ง
      const items = await prisma.dailyHomework.findMany({
        where: {
          due_date: { gte: today, lt: dayAfter },
          done: false,
        },
        include: {
          student: { select: { id: true, line_user_id: true, name: true } },
          submissions: { select: { student_id: true } },
        },
      });

      for (const hw of items) {
        if (!hw.student.line_user_id) continue;
        // ตรวจว่ายังไม่ได้ส่ง
        const alreadySubmitted = hw.submissions.some(s => s.student_id === hw.student_id);
        if (alreadySubmitted) continue;

        const dueDate = new Date(hw.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysLeft = Math.round((dueDate - today) / 86400000);

        await notifyDeadline(hw.student.line_user_id, hw, daysLeft);
      }

      console.log(`[Cron] Deadline reminder sent for ${items.length} items`);
    } catch (err) {
      console.error('[Cron] deadline reminder error:', err.message);
    }
  }, { timezone: 'Asia/Bangkok' });

  console.log('[Cron] Deadline reminder job started (daily 08:00 BKK)');
};

module.exports = { startDeadlineReminder };
