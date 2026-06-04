const prisma = require('../config/db');

// GET /api/rewards — ดูของรางวัลทั้งหมด (ทุก role)
const getRewards = async (req, res) => {
  try {
    const rewards = await prisma.reward.findMany({
      include: { _count: { select: { reward_logs: true } } },
      orderBy: { points_required: 'asc' },
    });
    res.json(rewards);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/rewards — สร้างของรางวัล (TEACHER+)
const createReward = async (req, res) => {
  try {
    const { title, image_url, points_required, stock } = req.body;
    if (!title || points_required === undefined) {
      return res.status(400).json({ message: 'กรุณาระบุชื่อและพอยต์ที่ต้องใช้' });
    }
    const reward = await prisma.reward.create({
      data: {
        title,
        image_url: image_url || null,
        points_required: parseInt(points_required),
        stock: parseInt(stock) || 0,
      },
    });
    res.status(201).json(reward);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/rewards/:id — แก้ไขของรางวัล (TEACHER+)
const updateReward = async (req, res) => {
  try {
    const { title, image_url, points_required, stock } = req.body;
    const reward = await prisma.reward.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(title !== undefined && { title }),
        ...(image_url !== undefined && { image_url: image_url || null }),
        ...(points_required !== undefined && { points_required: parseInt(points_required) }),
        ...(stock !== undefined && { stock: parseInt(stock) }),
      },
    });
    res.json(reward);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/rewards/:id (TEACHER+)
const deleteReward = async (req, res) => {
  try {
    await prisma.rewardLog.deleteMany({ where: { reward_id: parseInt(req.params.id) } });
    await prisma.reward.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'ลบของรางวัลแล้ว' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/rewards/:id/redeem — นักเรียนแลกของรางวัล
const redeemReward = async (req, res) => {
  try {
    const rewardId = parseInt(req.params.id);
    const studentId = req.user.id;

    const [reward, student] = await Promise.all([
      prisma.reward.findUnique({ where: { id: rewardId } }),
      prisma.user.findUnique({ where: { id: studentId }, select: { id: true, total_points: true, name: true } }),
    ]);

    if (!reward) return res.status(404).json({ message: 'ไม่พบของรางวัล' });
    if (reward.stock <= 0) return res.status(400).json({ message: 'ของรางวัลหมดแล้ว' });
    if (student.total_points < reward.points_required) {
      return res.status(400).json({ message: `พอยต์ไม่พอ (มี ${student.total_points} ต้องการ ${reward.points_required})` });
    }

    // Transaction: หักพอยต์ + ลด stock + สร้าง log
    const [log] = await prisma.$transaction([
      prisma.rewardLog.create({
        data: { student_id: studentId, reward_id: rewardId, status: 'PENDING' },
        include: { reward: true },
      }),
      prisma.user.update({
        where: { id: studentId },
        data: { total_points: { decrement: reward.points_required } },
      }),
      prisma.reward.update({
        where: { id: rewardId },
        data: { stock: { decrement: 1 } },
      }),
    ]);

    res.status(201).json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/rewards/logs — ดูประวัติการแลกทั้งหมด (TEACHER+)
const getRewardLogs = async (req, res) => {
  try {
    const logs = await prisma.rewardLog.findMany({
      include: {
        student: { select: { id: true, name: true, student_number: true } },
        reward: { select: { id: true, title: true, image_url: true, points_required: true } },
      },
      orderBy: { redeemed_at: 'desc' },
    });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/rewards/my-logs — ประวัติการแลกของนักเรียนตัวเอง
const getMyLogs = async (req, res) => {
  try {
    const logs = await prisma.rewardLog.findMany({
      where: { student_id: req.user.id },
      include: { reward: { select: { id: true, title: true, image_url: true, points_required: true } } },
      orderBy: { redeemed_at: 'desc' },
    });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/rewards/logs/:id/claim — ครูกด claim ส่งของให้นักเรียนแล้ว
const claimLog = async (req, res) => {
  try {
    const log = await prisma.rewardLog.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'CLAIMED' },
      include: {
        student: { select: { id: true, name: true, student_number: true } },
        reward: { select: { id: true, title: true } },
      },
    });
    res.json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/rewards/points/:studentId — ครูปรับพอยต์ manual
const adjustPoints = async (req, res) => {
  try {
    const { delta, reason } = req.body; // delta = +/- number
    if (delta === undefined) return res.status(400).json({ message: 'ระบุจำนวนพอยต์ที่ต้องการปรับ' });

    const student = await prisma.user.update({
      where: { id: parseInt(req.params.studentId) },
      data: { total_points: { increment: parseInt(delta) } },
      select: { id: true, name: true, total_points: true },
    });
    res.json(student);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getRewards, createReward, updateReward, deleteReward, redeemReward, getRewardLogs, getMyLogs, claimLog, adjustPoints };
