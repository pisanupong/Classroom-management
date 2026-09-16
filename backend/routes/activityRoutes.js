const express = require('express');
const prisma = require('../config/db');
const { protect: authenticate, restrictTo } = require('../middleware/authMiddleware');
const { CATEGORIES } = require('../middleware/activityLogger');

const router = express.Router();

// เฉพาะ ADMIN ขึ้นไป (restrictTo ใช้ลำดับชั้น role อยู่แล้ว)
router.use(authenticate, restrictTo('ADMIN'));

const PAGE_MAX = 100;

// GET /api/activity — รายการประวัติ (กรอง + แบ่งหน้า)
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(PAGE_MAX, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const { category, userId, search, from, to, failedOnly } = req.query;

    const where = {};
    if (category && CATEGORIES[category]) where.category = category;
    if (userId) where.user_id = parseInt(userId, 10);
    if (failedOnly === 'true') where.status = { gte: 400 };
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.created_at.lte = end;
      }
    }
    if (search) {
      where.OR = [
        { action:   { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { name:     { contains: search, mode: 'insensitive' } },
        { detail:   { contains: search, mode: 'insensitive' } },
        { path:     { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) || 1 });
  } catch (e) {
    console.error('[ACTIVITY] list error:', e);
    res.status(500).json({ message: 'ดึงประวัติไม่สำเร็จ' });
  }
});

// GET /api/activity/meta — หมวด + รายชื่อผู้ใช้ที่มีประวัติ (สำหรับ dropdown)
router.get('/meta', async (_req, res) => {
  try {
    const [byCategory, users, total, today] = await Promise.all([
      prisma.activityLog.groupBy({ by: ['category'], _count: { _all: true } }),
      prisma.activityLog.groupBy({ by: ['user_id', 'username', 'name'], _count: { _all: true } }),
      prisma.activityLog.count(),
      prisma.activityLog.count({ where: { created_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);

    res.json({
      categories: Object.entries(CATEGORIES).map(([key, label]) => ({
        key, label,
        count: byCategory.find(c => c.category === key)?._count._all || 0,
      })),
      users: users
        .filter(u => u.user_id)
        .map(u => ({ userId: u.user_id, username: u.username, name: u.name, count: u._count._all }))
        .sort((a, b) => b.count - a.count),
      total, today,
    });
  } catch (e) {
    console.error('[ACTIVITY] meta error:', e);
    res.status(500).json({ message: 'ดึงข้อมูลสรุปไม่สำเร็จ' });
  }
});

// DELETE /api/activity/purge?days=30 — ล้างประวัติที่เก่ากว่า N วัน (days=0 = ล้างทั้งหมด)
router.delete('/purge', restrictTo('SUPER_USER'), async (req, res) => {
  try {
    const days = Math.max(0, parseInt(req.query.days, 10) || 0);
    const where = days > 0
      ? { created_at: { lt: new Date(Date.now() - days * 86400000) } }
      : {};
    const { count } = await prisma.activityLog.deleteMany({ where });
    console.log(`[ACTIVITY] ${req.user.username} ล้างประวัติ ${count} รายการ (days=${days})`);
    res.json({ ok: true, deleted: count });
  } catch (e) {
    console.error('[ACTIVITY] purge error:', e);
    res.status(500).json({ message: 'ล้างประวัติไม่สำเร็จ' });
  }
});

module.exports = router;
