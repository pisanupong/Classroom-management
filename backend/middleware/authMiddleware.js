const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

// Role hierarchy: higher index = more permissions
const ROLE_LEVEL = {
  STUDENT:     0,
  PARENT:      0,   // ผู้ปกครอง (same level as student)
  STAFF:       1,   // ทีมงาน
  CLASS_ADMIN: 1,   // นักเรียนแอดมิน
  TEACHER:     2,
  ADMIN:       3,
  SUPER_USER:  4,
};

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          username: true,
          role: true,
          name: true,
          student_number: true,
          total_points: true,
        },
      });
      // Update last_active (fire-and-forget, don't await)
      prisma.user.update({ where: { id: decoded.id }, data: { last_active: new Date() } }).catch(() => {});
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
    return;
  }

  res.status(401).json({ message: 'Not authorized, no token' });
};

// restrictTo('TEACHER') — allow TEACHER, ADMIN, SUPER_USER (anyone at or above the lowest listed role)
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(403).json({ message: 'ไม่มีสิทธิ์' });
    const minLevel = Math.min(...roles.map(r => ROLE_LEVEL[r] ?? 99));
    if (ROLE_LEVEL[req.user.role] >= minLevel) return next();
    return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
  };
};

// requireExact — must be exactly one of listed roles (no upward permission)
const requireExact = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
    }
    next();
  };
};

module.exports = { protect, restrictTo, requireExact, ROLE_LEVEL };
