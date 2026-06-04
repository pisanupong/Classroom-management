const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const students = [
  { name: 'กุนิโอะ ทานากะ',    username: 'kunio',    student_number: '67001', points: 980 },
  { name: 'ซูบาตะ ยามาดะ',     username: 'subata',   student_number: '67002', points: 850 },
  { name: 'โมริโกะ วาตานาเบะ', username: 'moriko',   student_number: '67003', points: 760 },
  { name: 'นานาเสะ ฟูจิ',      username: 'nanase',   student_number: '67004', points: 640 },
  { name: 'อิชิโจ คาโต้',      username: 'ishijo',   student_number: '67005', points: 530 },
  { name: 'ริกิชิ โอกาวะ',     username: 'rikiishi', student_number: '67006', points: 420 },
  { name: 'โทชิโอะ มัตสึ',     username: 'toshio',   student_number: '67007', points: 310 },
  { name: 'ยูกิโกะ นากะ',      username: 'yukiko',   student_number: '67008', points: 200 },
  { name: 'เคนจิ ฮาระ',        username: 'kenji',    student_number: '67009', points: 120 },
  { name: 'ฮินาตะ ซาโต้',      username: 'hinata',   student_number: '67010', points: 50  },
];

async function main() {
  console.log('🌱 Seeding users...');

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);
  const adminHash = await bcrypt.hash('admin123', salt);

  // Super user
  const aun = await prisma.user.findUnique({ where: { username: 'aun' } });
  if (aun) {
    await prisma.user.update({
      where: { username: 'aun' },
      data: { role: 'SUPER_USER', password_hash: adminHash, name: 'Aun' },
    });
    console.log('  ↺ Updated: Aun (SUPER_USER)');
  } else {
    await prisma.user.create({
      data: { username: 'aun', password_hash: adminHash, role: 'SUPER_USER', name: 'Aun' },
    });
    console.log('  ✓ Created: Aun (SUPER_USER)');
  }

  for (const s of students) {
    const existing = await prisma.user.findUnique({ where: { username: s.username } });
    if (existing) {
      // Update points only
      await prisma.user.update({
        where: { username: s.username },
        data: { total_points: s.points, password_hash: passwordHash },
      });
      console.log(`  ↺ Updated: ${s.name} (${s.points} pts)`);
    } else {
      await prisma.user.create({
        data: {
          username: s.username,
          password_hash: passwordHash,
          role: 'STUDENT',
          name: s.name,
          student_number: s.student_number,
          total_points: s.points,
        },
      });
      console.log(`  ✓ Created: ${s.name} (${s.points} pts)`);
    }
  }

  console.log('\n✅ Seed complete!');
  console.log('   aun / admin123 (SUPER_USER)');
  console.log('   students / password123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
