const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const prisma  = require('../config/db');
const { protect } = require('../middleware/authMiddleware');

const LOGIN_CHANNEL_ID     = process.env.LINE_LOGIN_CHANNEL_ID;
const LOGIN_CHANNEL_SECRET = process.env.LINE_LOGIN_CHANNEL_SECRET;
const CALLBACK_URL         = process.env.LINE_CALLBACK_URL || 'http://72.62.67.40:5000/api/line/callback';
const FRONTEND_URL         = process.env.FRONTEND_URL      || 'http://72.62.67.40:8081';

// Middleware: allow token from query string for redirect flow
const jwt = require('jsonwebtoken');
const prisma2 = require('../config/db');
const authFromQuery = async (req, res, next) => {
  const token = req.query.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await prisma2.user.findUnique({ where: { id: decoded.id } });
    next();
  } catch { res.status(401).json({ message: 'Invalid token' }); }
};

// GET /api/line/auth?token=JWT  — redirect ไป LINE Login
router.get('/auth', authFromQuery, (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64');
  const url = new URL('https://access.line.me/oauth2/v2.1/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', LOGIN_CHANNEL_ID);
  url.searchParams.set('redirect_uri', CALLBACK_URL);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'profile');
  res.redirect(url.toString());
});

// GET /api/line/callback  — รับ code จาก LINE
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.redirect(`${FRONTEND_URL}/dashboard?line=error`);

    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code → access token
    const tokenRes = await axios.post('https://api.line.me/oauth2/v2.1/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: CALLBACK_URL,
        client_id: LOGIN_CHANNEL_ID,
        client_secret: LOGIN_CHANNEL_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Get LINE profile
    const profileRes = await axios.get('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    const lineUserId = profileRes.data.userId;

    // Save to DB
    await prisma.user.update({ where: { id: userId }, data: { line_user_id: lineUserId } });

    res.redirect(`${FRONTEND_URL}/dashboard?line=success`);
  } catch (err) {
    console.error('[LINE callback]', err.response?.data || err.message);
    res.redirect(`${FRONTEND_URL}/dashboard?line=error`);
  }
});

// DELETE /api/line/unlink  — ยกเลิกการผูก
router.delete('/unlink', protect, async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { line_user_id: null } });
    res.json({ message: 'ยกเลิกการผูก LINE แล้ว' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/line/status  — เช็คว่าผูกแล้วหรือยัง
router.get('/status', protect, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { line_user_id: true } });
  res.json({ linked: !!user?.line_user_id });
});

module.exports = router;
