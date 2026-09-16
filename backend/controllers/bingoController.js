const prisma = require('../config/db');

/* ── Generate a random 5x5 bingo card ──────────────────────────────────── */
function generateCard() {
  // Classic bingo: B1-15, I16-30, N31-45, G46-60, O61-75
  const cols = [
    { min: 1,  max: 15 },
    { min: 16, max: 30 },
    { min: 31, max: 45 },
    { min: 46, max: 60 },
    { min: 61, max: 75 },
  ];
  const numbers = [];
  cols.forEach(({ min, max }) => {
    const pool = [];
    for (let i = min; i <= max; i++) pool.push(i);
    // Pick 5 random from pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    numbers.push(...pool.slice(0, 5));
  });
  // Flatten column-by-column into row-major 5x5
  // numbers = [B0..B4, I0..I4, N0..N4, G0..G4, O0..O4]
  // Rearrange to row-major: row r = [B[r], I[r], N[r], G[r], O[r]]
  const grid = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      grid.push(numbers[c * 5 + r]);
    }
  }
  // FREE center
  grid[12] = 0;
  return grid;
}

/* ── POST /api/bingo/rooms ── Create room ─────────────────────────────── */
const createRoom = async (req, res) => {
  try {
    const { name, total_rounds = 3, rounds_config = [] } = req.body;
    if (!name) return res.status(400).json({ message: 'กรุณาใส่ชื่อห้อง' });

    const room = await prisma.bingoRoom.create({
      data: {
        name,
        created_by: req.user.id,
        total_rounds: parseInt(total_rounds),
        rounds: {
          create: Array.from({ length: parseInt(total_rounds) }, (_, i) => {
            const cfg = rounds_config[i] || {};
            return {
              round_number: i + 1,
              pattern:   cfg.pattern   || 'line',
              prize:     cfg.prize     || null,
              is_golden: cfg.is_golden || false,
            };
          }),
        },
      },
      include: { rounds: { orderBy: { round_number: 'asc' } } },
    });
    res.status(201).json(room);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
};

/* ── GET /api/bingo/rooms ── List active rooms ────────────────────────── */
const getRooms = async (req, res) => {
  try {
    const rooms = await prisma.bingoRoom.findMany({
      where: { status: { not: 'finished' } },
      include: {
        rounds: { orderBy: { round_number: 'asc' } },
        _count: { select: { cards: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(rooms);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/* ── GET /api/bingo/rooms/:id ── Room detail ─────────────────────────── */
const getRoom = async (req, res) => {
  try {
    const room = await prisma.bingoRoom.findUnique({
      where: { id: req.params.id },
      include: {
        rounds: {
          orderBy: { round_number: 'asc' },
          include: { winners: { orderBy: { won_at: 'asc' } } },
        },
        _count: { select: { cards: true } },
      },
    });
    if (!room) return res.status(404).json({ message: 'ไม่พบห้อง' });
    res.json(room);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/* ── POST /api/bingo/rooms/:id/join ── Get / create card ─────────────── */
const joinRoom = async (req, res) => {
  try {
    const { alias } = req.body;
    if (!alias) return res.status(400).json({ message: 'กรุณาใส่ชื่อ' });

    const room = await prisma.bingoRoom.findUnique({ where: { id: req.params.id } });
    if (!room) return res.status(404).json({ message: 'ไม่พบห้อง' });
    if (room.status === 'finished') return res.status(400).json({ message: 'เกมจบแล้ว' });

    // Check existing card for this alias
    let card = await prisma.bingoCard.findFirst({
      where: { room_id: req.params.id, alias },
    });
    if (!card) {
      card = await prisma.bingoCard.create({
        data: {
          room_id: req.params.id,
          alias,
          numbers: generateCard(),
        },
      });
    }

    const rounds = await prisma.bingoRound.findMany({
      where: { room_id: req.params.id },
      orderBy: { round_number: 'asc' },
      include: { winners: true },
    });

    res.json({ card, room, rounds });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
};

/* ── PUT /api/bingo/rooms/:id/rounds ── Update round config ────────────── */
const updateRounds = async (req, res) => {
  try {
    const { rounds } = req.body; // array of { id, pattern, prize, is_golden }
    if (!Array.isArray(rounds)) return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง' });

    const updated = await Promise.all(
      rounds.map(r => prisma.bingoRound.update({
        where: { id: r.id },
        data: {
          pattern:   r.pattern   ?? 'line',
          prize:     r.prize     ?? null,
          is_golden: r.is_golden ?? false,
        },
      }))
    );
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/* ── DELETE /api/bingo/rooms/:id ── Delete room ─────────────────────── */
const deleteRoom = async (req, res) => {
  try {
    const room = await prisma.bingoRoom.findUnique({ where: { id: req.params.id } });
    if (!room) return res.status(404).json({ message: 'ไม่พบห้อง' });

    // Cascade via schema relations
    await prisma.bingoWinner.deleteMany({ where: { round: { room_id: req.params.id } } });
    await prisma.bingoCard.deleteMany({ where: { room_id: req.params.id } });
    await prisma.bingoRound.deleteMany({ where: { room_id: req.params.id } });
    await prisma.bingoRoom.delete({ where: { id: req.params.id } });
    res.json({ message: 'ลบห้องแล้ว' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { createRoom, getRooms, getRoom, joinRoom, updateRounds, deleteRoom };
