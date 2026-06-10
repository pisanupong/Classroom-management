const axios = require('axios');

const LINE_API = 'https://api.line.me/v2/bot/message/push';
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const push = async (lineUserId, messages) => {
  if (!lineUserId || !TOKEN) return;
  try {
    await axios.post(LINE_API, { to: lineUserId, messages }, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[LINE] push error:', err.response?.data || err.message);
  }
};

// 📖 มีการบ้านใหม่
const notifyNewHomework = async (lineUserId, homework) => {
  const due = homework.due_date
    ? `\n📅 กำหนดส่ง: ${new Date(homework.due_date).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' })}`
    : '';
  const location = homework.submit_location ? `\n📍 ส่งที่: ${homework.submit_location}` : '';
  await push(lineUserId, [{
    type: 'text',
    text: `📖 มีการบ้านใหม่!\n\n📚 วิชา: ${homework.subject}\n${homework.detail ? `📝 ${homework.detail}\n` : ''}🗂️ ประเภท: ${homework.homework_type}${due}${location}`,
  }]);
};

// ⏰ แจ้งเตือนใกล้กำหนดส่ง
const notifyDeadline = async (lineUserId, homework, daysLeft) => {
  const label = daysLeft === 0 ? '🚨 วันนี้!' : `อีก ${daysLeft} วัน`;
  const due = new Date(homework.due_date).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' });
  await push(lineUserId, [{
    type: 'text',
    text: `⏰ ใกล้กำหนดส่งการบ้าน!\n\n📚 วิชา: ${homework.subject}\n📅 กำหนดส่ง: ${due} (${label})\n📍 ส่งที่: ${homework.submit_location}`,
  }]);
};

// 📅 มีกิจกรรมในปฏิทิน
const notifyNewEvent = async (lineUserId, event) => {
  const TYPE_LABEL = { EVENT:'📅 กิจกรรม', HOLIDAY:'🎌 วันหยุด', SCHOOL:'🏫 ปฏิทินโรงเรียน', NOTE:'📝 Note' };
  const start = new Date(event.start_date).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' });
  await push(lineUserId, [{
    type: 'text',
    text: `${TYPE_LABEL[event.event_type] || '📅 กิจกรรม'}ใหม่!\n\n🗓️ ${event.title}\n📅 วันที่: ${start}${event.description ? `\n📝 ${event.description}` : ''}`,
  }]);
};

module.exports = { push, notifyNewHomework, notifyDeadline, notifyNewEvent };
