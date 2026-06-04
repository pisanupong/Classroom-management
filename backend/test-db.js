require('dotenv').config();
const prisma = require('./config/db');

async function main() {
  try {
    const user = await prisma.user.findUnique({ where: { username: 'aun' } });
    console.log('DB OK. User found:', user ? `${user.username} (${user.role})` : 'NOT FOUND');
  } catch (e) {
    console.error('DB Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
