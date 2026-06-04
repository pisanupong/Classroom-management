const prisma = require('../config/db');

const { ROLE_LEVEL } = require('../middleware/authMiddleware');

// GET /api/treasury — ภาพรวม: ยอดรวม + รายการล่าสุด + นักเรียนที่ค้างชำระ
const getSummary = async (req, res) => {
  try {
    const [transactions, students] = await Promise.all([
      prisma.treasury.findMany({
        where: { tx_status: 'APPROVED' }, // นับเฉพาะที่อนุมัติแล้ว
        include: {
          student:  { select: { id: true, name: true, student_number: true } },
          creator:  { select: { id: true, name: true, role: true } },
          approver: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.user.findMany({
        where: { role: 'STUDENT' },
        select: { id: true, name: true, student_number: true },
        orderBy: { student_number: 'asc' },
      }),
    ]);

    const totalIncome  = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

    res.json({ balance: totalIncome - totalExpense, totalIncome, totalExpense, transactions, students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/treasury/my — ประวัติของนักเรียนตัวเอง
const getMyTransactions = async (req, res) => {
  try {
    const transactions = await prisma.treasury.findMany({
      where: { student_id: req.user.id },
      orderBy: { created_at: 'desc' },
    });
    const totalIncome  = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    res.json({ balance: totalIncome - totalExpense, transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/treasury — บันทึกรายการ
// CLASS_ADMIN → PENDING (รอ TEACHER อนุมัติ)
// TEACHER+    → APPROVED ทันที
const createTransaction = async (req, res) => {
  try {
    const { student_id, amount, type, description } = req.body;
    if (!amount || !type || !['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }
    const isTeacher = ROLE_LEVEL[req.user.role] >= ROLE_LEVEL['TEACHER'];
    const tx = await prisma.treasury.create({
      data: {
        student_id:  student_id || null,
        amount:      parseFloat(amount),
        type,
        description: description || null,
        created_by:  req.user.id,
        tx_status:   isTeacher ? 'APPROVED' : 'PENDING',
        approved_by: isTeacher ? req.user.id : null,
      },
      include: {
        student:  { select: { id: true, name: true, student_number: true } },
        creator:  { select: { id: true, name: true, role: true } },
      },
    });
    res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/treasury/pending — รายการรอการอนุมัติ (TEACHER+)
const getPending = async (req, res) => {
  try {
    const pending = await prisma.treasury.findMany({
      where: { tx_status: 'PENDING' },
      include: {
        student: { select: { id: true, name: true, student_number: true } },
        creator: { select: { id: true, name: true, role: true } },
      },
      orderBy: { created_at: 'asc' },
    });
    res.json(pending);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/treasury/:id/approve — อนุมัติ (TEACHER+)
const approveTransaction = async (req, res) => {
  try {
    const { action } = req.body; // 'approve' | 'reject'
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action ต้องเป็น approve หรือ reject' });
    }
    const tx = await prisma.treasury.update({
      where: { id: parseInt(req.params.id) },
      data: {
        tx_status:   action === 'approve' ? 'APPROVED' : 'REJECTED',
        approved_by: req.user.id,
      },
      include: {
        student:  { select: { id: true, name: true, student_number: true } },
        creator:  { select: { id: true, name: true, role: true } },
        approver: { select: { id: true, name: true } },
      },
    });
    res.json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/treasury/:id — แก้ไขรายการ (TEACHER+)
const updateTransaction = async (req, res) => {
  try {
    const { amount, type, description, student_id } = req.body;
    const tx = await prisma.treasury.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(type && { type }),
        ...(description !== undefined && { description }),
        ...(student_id !== undefined && { student_id: student_id || null }),
      },
      include: { student: { select: { id: true, name: true, student_number: true } } },
    });
    res.json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/treasury/:id (TEACHER+)
const deleteTransaction = async (req, res) => {
  try {
    await prisma.treasury.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'ลบรายการแล้ว' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getSummary, getMyTransactions, createTransaction, updateTransaction, deleteTransaction, getPending, approveTransaction };
