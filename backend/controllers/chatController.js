const prisma = require('../config/db');
const { ROLE_LEVEL } = require('../middleware/authMiddleware');

// ── Channels ───────────────────────────────────────────────────────────────

const getChannels = async (req, res) => {
  try {
    const channels = await prisma.channel.findMany({
      where: { is_active: true },
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { messages: { where: { deleted: false } } } },
      },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
    });
    res.json(channels);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createChannel = async (req, res) => {
  try {
    const { name, description, type } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'กรุณาใส่ชื่อห้อง' });

    const exists = await prisma.channel.findUnique({ where: { name: name.trim().toLowerCase().replace(/\s+/g,'-') } });
    if (exists) return res.status(400).json({ message: 'ชื่อห้องนี้มีอยู่แล้ว' });

    const count = await prisma.channel.count();
    const channel = await prisma.channel.create({
      data: {
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        description: description || null,
        type: type === 'ANNOUNCEMENT' ? 'ANNOUNCEMENT' : 'TEXT',
        created_by: req.user.id,
        position: count,
      },
      include: { creator: { select: { id: true, name: true } }, _count: { select: { messages: true } } },
    });
    res.status(201).json(channel);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteChannel = async (req, res) => {
  try {
    const ch = await prisma.channel.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!ch) return res.status(404).json({ message: 'ไม่พบห้อง' });
    await prisma.message.deleteMany({ where: { channel_id: ch.id } });
    await prisma.channel.delete({ where: { id: ch.id } });
    res.json({ message: 'ลบห้องแล้ว' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Messages ───────────────────────────────────────────────────────────────

const getMessages = async (req, res) => {
  try {
    const { before, limit = 50 } = req.query;
    const where = { channel_id: parseInt(req.params.id), deleted: false };
    if (before) where.id = { lt: parseInt(before) };

    const messages = await prisma.message.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true, character_data: true } },
      },
      orderBy: { created_at: 'desc' },
      take: parseInt(limit),
    });
    res.json(messages.reverse()); // oldest first
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const deleteMessage = async (req, res) => {
  try {
    const msgId = parseInt(req.params.msgId);
    const msg = await prisma.message.findUnique({ where: { id: msgId } });
    if (!msg) return res.status(404).json({ message: 'ไม่พบข้อความ' });

    const actorLevel = ROLE_LEVEL[req.user.role] ?? 0;
    const isOwn = msg.user_id === req.user.id;
    const isAdmin = actorLevel >= ROLE_LEVEL['TEACHER'];

    if (!isOwn && !isAdmin) return res.status(403).json({ message: 'ไม่มีสิทธิ์ลบข้อความนี้' });

    const updated = await prisma.message.update({
      where: { id: msgId },
      data: { deleted: true, deleted_by: req.user.id },
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getChannels, createChannel, deleteChannel, getMessages, deleteMessage };
