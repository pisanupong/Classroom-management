require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// วันหยุดนักขัตฤกษ์ไทย 2568 (2025) + ปฎิทินโรงเรียน
const HOLIDAYS_2568 = [
  // ── วันหยุดนักขัตฤกษ์ ──
  { title: 'วันขึ้นปีใหม่', date: '2025-01-01', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันมาฆบูชา', date: '2025-02-12', color: '#f59e0b', type: 'HOLIDAY' },
  { title: 'วันจักรี', date: '2025-04-06', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันสงกรานต์', date: '2025-04-13', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันสงกรานต์', date: '2025-04-14', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันสงกรานต์', date: '2025-04-15', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันแรงงานแห่งชาติ', date: '2025-05-01', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันฉัตรมงคล', date: '2025-05-04', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันวิสาขบูชา', date: '2025-05-11', color: '#f59e0b', type: 'HOLIDAY' },
  { title: 'วันเฉลิมพระชนมพรรษา ร.10', date: '2025-07-28', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันอาสาฬหบูชา', date: '2025-07-10', color: '#f59e0b', type: 'HOLIDAY' },
  { title: 'วันเข้าพรรษา', date: '2025-07-11', color: '#f59e0b', type: 'HOLIDAY' },
  { title: 'วันแม่แห่งชาติ', date: '2025-08-12', color: '#ec4899', type: 'HOLIDAY' },
  { title: 'วันคล้ายวันสวรรคต ร.9', date: '2025-10-13', color: '#6b7280', type: 'HOLIDAY' },
  { title: 'วันปิยมหาราช', date: '2025-10-23', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันพ่อแห่งชาติ', date: '2025-12-05', color: '#0ea5e9', type: 'HOLIDAY' },
  { title: 'วันรัฐธรรมนูญ', date: '2025-12-10', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันสิ้นปี', date: '2025-12-31', color: '#ef4444', type: 'HOLIDAY' },

  // ── ปฎิทินโรงเรียน (ตัวอย่าง) ──
  { title: '🏫 เปิดภาคเรียนที่ 1', date: '2025-05-15', color: '#10b981', type: 'SCHOOL', desc: 'เปิดภาคเรียนที่ 1 ปีการศึกษา 2568' },
  { title: '📝 สอบกลางภาค 1', date: '2025-07-07', color: '#8b5cf6', type: 'SCHOOL', desc: 'สอบกลางภาคเรียนที่ 1' },
  { title: '🎓 สอบปลายภาค 1', date: '2025-09-22', color: '#8b5cf6', type: 'SCHOOL', desc: 'สอบปลายภาคเรียนที่ 1' },
  { title: '🏖 ปิดภาคเรียนที่ 1', date: '2025-10-06', color: '#f59e0b', type: 'SCHOOL', desc: 'ปิดภาคเรียนที่ 1' },
  { title: '🏫 เปิดภาคเรียนที่ 2', date: '2025-11-01', color: '#10b981', type: 'SCHOOL', desc: 'เปิดภาคเรียนที่ 2 ปีการศึกษา 2568' },
  { title: '📝 สอบกลางภาค 2', date: '2026-01-12', color: '#8b5cf6', type: 'SCHOOL', desc: 'สอบกลางภาคเรียนที่ 2' },
  { title: '🎓 สอบปลายภาค 2', date: '2026-02-23', color: '#8b5cf6', type: 'SCHOOL', desc: 'สอบปลายภาคเรียนที่ 2' },
  { title: '🏖 ปิดภาคฤดูร้อน', date: '2026-03-02', color: '#f59e0b', type: 'SCHOOL', desc: 'ปิดภาคฤดูร้อน' },

  // ── วันหยุดนักขัตฤกษ์ 2569 (2026) ──
  { title: 'วันขึ้นปีใหม่', date: '2026-01-01', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันมาฆบูชา', date: '2026-03-03', color: '#f59e0b', type: 'HOLIDAY' },
  { title: 'วันจักรี', date: '2026-04-06', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันสงกรานต์', date: '2026-04-13', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันสงกรานต์', date: '2026-04-14', color: '#ef4444', type: 'HOLIDAY' },
  { title: 'วันสงกรานต์', date: '2026-04-15', color: '#ef4444', type: 'HOLIDAY' },
];

async function main() {
  console.log('🌱 Seeding holidays & school calendar...');
  let created = 0, skipped = 0;

  for (const h of HOLIDAYS_2568) {
    const date = new Date(h.date);
    date.setHours(0, 0, 0, 0);
    const existing = await prisma.event.findFirst({
      where: { title: h.title, start_date: date, event_type: h.type },
    });
    if (existing) { skipped++; continue; }
    await prisma.event.create({
      data: {
        title: h.title,
        description: h.desc || null,
        start_date: date,
        end_date: date,
        color: h.color,
        event_type: h.type,
        is_all_day: true,
        created_by: null,
      },
    });
    created++;
  }
  console.log(`✅ Created: ${created} | Skipped: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
