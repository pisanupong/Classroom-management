const prisma = require('../config/db');

// GET /api/vocab/words?category=
const getWords = async (req, res) => {
  try {
    const { category } = req.query;
    const words = await prisma.vocabWord.findMany({
      where: category ? { category } : {},
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.json(words);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/vocab/categories
const getCategories = async (req, res) => {
  try {
    const cats = await prisma.vocabWord.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { category: 'asc' },
    });
    res.json(cats.map(c => ({ name: c.category, count: c._count.id })));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/vocab/words (TEACHER / CLASS_ADMIN)
const createWord = async (req, res) => {
  try {
    const { word, translation, hint, category } = req.body;
    if (!word || !translation) return res.status(400).json({ message: 'กรุณาใส่คำศัพท์และคำแปล' });
    const w = await prisma.vocabWord.create({
      data: { word: word.trim(), translation: translation.trim(), hint: hint?.trim() || null, category: category?.trim() || 'ทั่วไป', created_by: req.user.id },
    });
    res.status(201).json(w);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/vocab/words/bulk — import หลายคำพร้อมกัน
const bulkCreateWords = async (req, res) => {
  try {
    const { words, category } = req.body; // words: [{word, translation, hint?}]
    if (!Array.isArray(words) || !words.length) return res.status(400).json({ message: 'ต้องมีคำศัพท์อย่างน้อย 1 คำ' });
    const created = await prisma.vocabWord.createMany({
      data: words.map(w => ({
        word: w.word.trim(), translation: w.translation.trim(),
        hint: w.hint?.trim() || null, category: category?.trim() || 'ทั่วไป',
        created_by: req.user.id,
      })),
      skipDuplicates: true,
    });
    res.status(201).json({ count: created.count });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/vocab/words/:id
const updateWord = async (req, res) => {
  try {
    const { word, translation, hint, category } = req.body;
    const w = await prisma.vocabWord.update({
      where: { id: parseInt(req.params.id) },
      data: { word: word?.trim(), translation: translation?.trim(), hint: hint?.trim() || null, category: category?.trim() },
    });
    res.json(w);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/vocab/words/:id
const deleteWord = async (req, res) => {
  try {
    await prisma.vocabWord.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'ลบแล้ว' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/vocab/stats — สถิติส่วนตัว + อันดับ
const getStats = async (req, res) => {
  try {
    const [myStats, topPlayers] = await Promise.all([
      prisma.battleStats.findUnique({
        where: { user_id: req.user.id },
      }),
      prisma.battleStats.findMany({
        include: { user: { select: { id: true, name: true, student_number: true } } },
        orderBy: [{ wins: 'desc' }, { best_combo: 'desc' }],
        take: 10,
      }),
    ]);
    res.json({ myStats: myStats || { wins: 0, losses: 0, best_combo: 0, total_combo: 0 }, topPlayers });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/vocab/battles — ประวัติการต่อสู้ของตัวเอง
const getMyBattles = async (req, res) => {
  try {
    const battles = await prisma.vocabBattle.findMany({
      where: { OR: [{ challenger_id: req.user.id }, { opponent_id: req.user.id }], status: { in: ['FINISHED', 'ACTIVE'] } },
      include: {
        challenger: { select: { id: true, name: true } },
        opponent:   { select: { id: true, name: true } },
        winner:     { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });
    res.json(battles);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/vocab/battles/pending — คำท้าที่รอตอบรับ
const getPendingBattles = async (req, res) => {
  try {
    const battles = await prisma.vocabBattle.findMany({
      where: { opponent_id: req.user.id, status: 'PENDING' },
      include: { challenger: { select: { id: true, name: true, student_number: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.json(battles);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/vocab/battles — ท้าต่อสู้
const createBattle = async (req, res) => {
  try {
    const { opponent_id, category, max_rounds } = req.body;
    if (!opponent_id) return res.status(400).json({ message: 'กรุณาเลือกคู่ต่อสู้' });
    if (opponent_id === req.user.id) return res.status(400).json({ message: 'ไม่สามารถท้าตัวเองได้' });

    // Check word count
    const wordCount = await prisma.vocabWord.count({ where: category ? { category } : {} });
    if (wordCount < 5) return res.status(400).json({ message: 'ต้องมีคำศัพท์อย่างน้อย 5 คำ' });

    const battle = await prisma.vocabBattle.create({
      data: {
        challenger_id: req.user.id,
        opponent_id:   parseInt(opponent_id),
        category:      category || null,
        max_rounds:    max_rounds || 15,
      },
      include: {
        challenger: { select: { id: true, name: true } },
        opponent:   { select: { id: true, name: true } },
      },
    });
    res.status(201).json(battle);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/vocab/battles/:id/respond — ตอบรับ/ปฏิเสธ
const respondBattle = async (req, res) => {
  try {
    const { action } = req.body; // 'accept' | 'decline'
    const battle = await prisma.vocabBattle.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!battle) return res.status(404).json({ message: 'ไม่พบคำท้า' });
    if (battle.opponent_id !== req.user.id) return res.status(403).json({ message: 'ไม่ใช่คำท้าของคุณ' });
    if (battle.status !== 'PENDING') return res.status(400).json({ message: 'คำท้านี้ถูกตอบรับแล้ว' });

    const updated = await prisma.vocabBattle.update({
      where: { id: battle.id },
      data: { status: action === 'accept' ? 'ACTIVE' : 'DECLINED' },
      include: {
        challenger: { select: { id: true, name: true } },
        opponent:   { select: { id: true, name: true } },
      },
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/vocab/battles/:id — รายละเอียด battle
const getBattle = async (req, res) => {
  try {
    const battle = await prisma.vocabBattle.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        challenger: { select: { id: true, name: true, character_data: true } },
        opponent:   { select: { id: true, name: true, character_data: true } },
        winner:     { select: { id: true, name: true } },
      },
    });
    if (!battle) return res.status(404).json({ message: 'ไม่พบ battle' });
    res.json(battle);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/vocab/players — รายชื่อผู้เล่นที่ท้าได้
const getPlayers = async (req, res) => {
  try {
    const players = await prisma.user.findMany({
      where: { id: { not: req.user.id } },
      select: { id: true, name: true, student_number: true, role: true,
        battle_stats: { select: { wins: true, losses: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(players);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getWords, getCategories, createWord, bulkCreateWords, updateWord, deleteWord, getStats, getMyBattles, getPendingBattles, createBattle, respondBattle, getBattle, getPlayers };
