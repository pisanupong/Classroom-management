const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ── ensure uploads dir exists ─────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── multer config ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `bg_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|avif/;
  if (allowed.test(path.extname(file.originalname).toLowerCase()) &&
      allowed.test(file.mimetype.split('/')[1])) {
    cb(null, true);
  } else {
    cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น'));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // max 10 MB

// ── POST /api/upload/background ───────────────────────────────
router.post(
  '/background',
  protect,
  restrictTo('ADMIN', 'SUPER_USER'),
  upload.single('image'),
  (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'ไม่พบไฟล์ที่อัปโหลด' });

    // Return a public URL the frontend can use
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const url = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({ url });
  }
);

module.exports = router;
