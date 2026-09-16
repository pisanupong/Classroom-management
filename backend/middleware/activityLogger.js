/*
 * บันทึกประวัติการใช้งาน (ActivityLog)
 * ดักเฉพาะคำขอที่เปลี่ยนแปลงข้อมูล (POST/PUT/PATCH/DELETE) + การเข้าสู่ระบบ
 * เขียนลง DB ตอน response finish เพื่อไม่ให้หน่วงผู้ใช้ และไม่ให้ล้มถ้า log พัง
 */
const prisma = require('../config/db');

const CATEGORIES = {
  users: '👥 ผู้ใช้',
  auth: '🔐 เข้าสู่ระบบ',
  assignments: '📚 การบ้าน',
  daily_homework: '📖 จดการบ้าน',
  quiz: '🎯 แบบฝึกหัด',
  treasury: '💰 เงินห้อง',
  rewards: '🎁 ของรางวัล',
  chat: '💬 สนทนา',
  events: '📅 ปฏิทิน',
  vocab: '⚔️ Vocab',
  pet: '🐾 สัตว์เลี้ยง',
  python: '🐍 Python',
  game: '🎮 Quiz Rumble',
  subjects: '📚 วิชา',
  settings: '⚙️ ตั้งค่า',
  upload: '📎 ไฟล์',
  other: '📌 อื่นๆ',
};

// path → หมวด (ดูจากส่วนแรกหลัง /api/)
const categoryOf = (path) => {
  const seg = (path.split('?')[0].split('/')[2] || '').toLowerCase();
  if (seg === 'admin') return 'users';
  if (seg === 'dashboard') return 'other';
  if (seg === 'daily-homework') return 'daily_homework';
  return CATEGORIES[seg] ? seg : 'other';
};

const VERB = { POST: 'เพิ่ม', PUT: 'แก้ไข', PATCH: 'แก้ไข', DELETE: 'ลบ' };

// กติกาเฉพาะกิจ — ไล่จากบนลงล่าง ตัวแรกที่ตรงชนะ
const RULES = [
  [/^\/api\/users\/login/i,                    'เข้าสู่ระบบ'],
  [/^\/api\/users\/logout/i,                   'ออกจากระบบ'],
  [/^\/api\/users\/register/i,                 'สมัครสมาชิก'],
  [/^\/api\/users\/character/i,                'บันทึกตัวละคร'],
  [/^\/api\/users\/\d+\/password/i,            'เปลี่ยนรหัสผ่าน'],
  [/^\/api\/admin\/users\/import/i,            'นำเข้าผู้ใช้จากไฟล์'],
  [/^\/api\/admin\/users\/\d+$/i,              (m) => (m === 'DELETE' ? 'ลบผู้ใช้' : 'แก้ไขผู้ใช้')],
  [/^\/api\/admin\/users/i,                    'สร้างผู้ใช้ใหม่'],
  [/^\/api\/settings/i,                        'บันทึกการตั้งค่า'],
  [/^\/api\/quiz\/\d+\/submit/i,               'ส่งคำตอบแบบฝึกหัด'],
  [/^\/api\/quiz/i,                            (m) => `${VERB[m]}แบบฝึกหัด`],
  [/^\/api\/assignments\/\d+\/submit/i,        'ส่งการบ้าน'],
  [/^\/api\/assignments/i,                     (m) => `${VERB[m]}การบ้าน`],
  [/^\/api\/daily-homework/i,                  (m) => `${VERB[m]}รายการจดการบ้าน`],
  [/^\/api\/treasury\/\d+\/approve/i,          'อนุมัติรายการเงิน'],
  [/^\/api\/treasury/i,                        (m) => `${VERB[m]}รายการเงินห้อง`],
  [/^\/api\/rewards\/\d+\/redeem/i,            'แลกของรางวัล'],
  [/^\/api\/rewards/i,                         (m) => `${VERB[m]}ของรางวัล`],
  [/^\/api\/chat/i,                            (m) => (m === 'DELETE' ? 'ลบข้อความ' : 'ส่งข้อความ')],
  [/^\/api\/events/i,                          (m) => `${VERB[m]}กิจกรรมในปฏิทิน`],
  [/^\/api\/subjects/i,                        (m) => `${VERB[m]}วิชา`],
  [/^\/api\/upload/i,                          'อัปโหลดไฟล์'],
  [/^\/api\/python\/admin\/reset/i,            'รีเซ็ตข้อมูล Python ของผู้ใช้'],
  [/^\/api\/python\/exercise/i,                'ส่งแบบฝึกหัด Python'],
  [/^\/api\/python\/learn/i,                   'เรียนบทเรียน Python'],
  [/^\/api\/python\/mission/i,                 'ทำภารกิจ Python'],
  [/^\/api\/python\/hint/i,                    'ขอคำใบ้ Python'],
  [/^\/api\/python/i,                          'ใช้งานเมนู Python'],
  [/^\/api\/pet\/admin\/reset/i,               'รีเซ็ตสัตว์เลี้ยงของผู้ใช้'],
  [/^\/api\/pet/i,                             'ใช้งานเมนูสัตว์เลี้ยง'],
  [/^\/api\/vocab/i,                           'ใช้งาน Vocab Battle'],
  [/^\/api\/game/i,                            'ใช้งาน Quiz Rumble'],
];

const actionOf = (method, path) => {
  for (const [re, label] of RULES) {
    if (re.test(path)) return typeof label === 'function' ? label(method) : label;
  }
  return `${VERB[method] || method} ${path.replace(/^\/api\//, '')}`;
};

// ดึงรายละเอียดสั้นๆ จาก body โดยไม่แตะข้อมูลอ่อนไหว
const detailOf = (body) => {
  if (!body || typeof body !== 'object') return null;
  const keys = ['title', 'name', 'username', 'subject', 'text', 'content', 'reason', 'mode', 'lesson', 'id', 'amount'];
  const parts = [];
  for (const k of keys) {
    const v = body[k];
    if (v === undefined || v === null || typeof v === 'object') continue;
    parts.push(`${k}: ${String(v).slice(0, 60)}`);
    if (parts.length >= 3) break;
  }
  return parts.length ? parts.join(' · ') : null;
};

const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.ip || req.socket?.remoteAddress || null;

// เขียน log หนึ่งรายการ (ใช้เองจาก controller ได้ด้วย)
async function writeLog(data) {
  try {
    await prisma.activityLog.create({ data });
  } catch (e) {
    console.error('[ACTIVITY LOG] เขียนไม่สำเร็จ:', e.message);
  }
}

const SKIP = [/^\/api\/line\/webhook/i];   // webhook ภายนอก ไม่ใช่การใช้งานของผู้ใช้

function activityLogger(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (SKIP.some(re => re.test(req.originalUrl))) return next();

  const body = req.body;               // เก็บไว้ก่อน เพราะ handler อาจแก้
  const isLogin = /^\/api\/users\/login/i.test(req.originalUrl);
  const loginName = isLogin ? String(body?.username || '').slice(0, 60) : null;

  res.on('finish', async () => {
    const path = req.originalUrl.split('?')[0];
    let u = req.user;
    // เส้นทาง login ไม่ผ่าน protect จึงไม่มี req.user — หาเจ้าของจาก username ที่ล็อกอินสำเร็จ
    if (!u && isLogin && res.statusCode < 400 && loginName) {
      try {
        u = await prisma.user.findUnique({
          where: { username: loginName },
          select: { id: true, username: true, name: true, role: true },
        });
      } catch { /* หาไม่ได้ก็บันทึกเท่าที่มี */ }
    }
    writeLog({
      user_id: u?.id ?? null,
      username: u?.username ?? loginName,
      name: u?.name ?? null,
      role: u?.role ?? null,
      action: isLogin && res.statusCode >= 400 ? 'เข้าสู่ระบบไม่สำเร็จ' : actionOf(req.method, path),
      category: categoryOf(path),
      method: req.method,
      path: path.slice(0, 200),
      status: res.statusCode,
      detail: isLogin ? (loginName ? `username: ${loginName}` : null) : detailOf(body),
      ip: clientIp(req),
      user_agent: (req.headers['user-agent'] || '').slice(0, 200) || null,
    });
  });

  next();
}

module.exports = { activityLogger, writeLog, CATEGORIES };
