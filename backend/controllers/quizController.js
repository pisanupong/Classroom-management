const prisma = require('../config/db');
const { rollLoot } = require('../utils/petLoot');
const { ingestQuizAttempt } = require('../utils/practiceEngine');

// Fisher-Yates shuffle
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ── GET /api/quiz  (list all active quizzes) ──────────────────────────────
const getQuizzes = async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: req.user.role === 'STUDENT' ? { is_active: true } : {},
      include: {
        creator: { select: { id: true, name: true } },
        _count: { select: { questions: true, attempts: true } },
        attempts: req.user.role === 'STUDENT'
          ? { where: { student_id: req.user.id }, select: { id: true, score: true, completed_at: true }, orderBy: { completed_at: 'desc' } }
          : false,
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(quizzes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ── GET /api/quiz/:id  (quiz detail — questions WITHOUT answers for students) ──
const getQuiz = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        creator: { select: { id: true, name: true } },
        questions: true,
        _count: { select: { attempts: true } },
      },
    });
    if (!quiz) return res.status(404).json({ message: 'ไม่พบแบบฝึกหัด' });

    // For non-teachers: shuffle choices + hide correct_answer, check attempt limit
    const isTeacher = ['TEACHER', 'ADMIN', 'SUPER_USER'].includes(req.user.role);
    if (!isTeacher) {
      if (quiz.max_attempts > 0) {
        const count = await prisma.quizAttempt.count({
          where: { quiz_id: quiz.id, student_id: req.user.id },
        });
        if (count >= quiz.max_attempts) {
          return res.status(403).json({ message: `ทำได้สูงสุด ${quiz.max_attempts} ครั้งแล้ว`, attempted: true });
        }
      }

      const shuffledQuestions = shuffle(quiz.questions).map(q => ({
        id: q.id,
        question_text: q.question_text,
        choices: shuffle(q.choices),
      }));

      return res.json({ ...quiz, questions: shuffledQuestions });
    }

    res.json(quiz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ── POST /api/quiz  (Teacher creates quiz) ────────────────────────────────
const createQuiz = async (req, res) => {
  try {
    const { title, description, time_limit, max_attempts, points_per_q, questions } = req.body;

    if (!title) return res.status(400).json({ message: 'กรุณาใส่ชื่อแบบฝึกหัด' });
    if (!questions?.length) return res.status(400).json({ message: 'กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อ' });

    // Validate questions
    for (const q of questions) {
      if (!q.question_text) return res.status(400).json({ message: 'คำถามต้องมีเนื้อหา' });
      if (!q.choices || q.choices.length < 2) return res.status(400).json({ message: 'ต้องมีตัวเลือกอย่างน้อย 2 ตัว' });
      if (!q.correct_answer) return res.status(400).json({ message: 'ต้องระบุคำตอบที่ถูกต้อง' });
      if (!q.choices.includes(q.correct_answer)) return res.status(400).json({ message: 'คำตอบที่ถูกต้องต้องอยู่ในตัวเลือก' });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description: description || null,
        time_limit: time_limit ? parseInt(time_limit) : 600,
        max_attempts: max_attempts !== undefined ? parseInt(max_attempts) : 1,
        points_per_q: points_per_q ? parseInt(points_per_q) : 10,
        created_by: req.user.id,
        questions: {
          create: questions.map(q => ({
            question_text: q.question_text,
            choices: q.choices,
            correct_answer: q.correct_answer,
          })),
        },
      },
      include: { questions: true, _count: { select: { questions: true } } },
    });

    res.status(201).json(quiz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ── PUT /api/quiz/:id/toggle  (Teacher toggle active) ─────────────────────
const toggleQuiz = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!quiz) return res.status(404).json({ message: 'ไม่พบแบบฝึกหัด' });
    const updated = await prisma.quiz.update({
      where: { id: quiz.id },
      data: { is_active: !quiz.is_active },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── DELETE /api/quiz/:id ──────────────────────────────────────────────────
const deleteQuiz = async (req, res) => {
  try {
    const qid = parseInt(req.params.id);
    await prisma.quizAttempt.deleteMany({ where: { quiz_id: qid } });
    await prisma.question.deleteMany({ where: { quiz_id: qid } });
    await prisma.quiz.delete({ where: { id: qid } });
    res.json({ message: 'ลบแบบฝึกหัดแล้ว' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── POST /api/quiz/:id/submit ─────────────────────────────────────────────
const submitQuiz = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);
    const { answers, time_taken } = req.body; // answers: { [question_id]: chosen_answer }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true },
    });
    if (!quiz) return res.status(404).json({ message: 'ไม่พบแบบฝึกหัด' });

    // Check attempt limit (skip for teachers/admins)
    const isTeacher = ['TEACHER', 'ADMIN', 'SUPER_USER'].includes(req.user.role);
    if (!isTeacher && quiz.max_attempts > 0) {
      const count = await prisma.quizAttempt.count({
        where: { quiz_id: quizId, student_id: req.user.id },
      });
      if (count >= quiz.max_attempts) {
        return res.status(403).json({ message: 'ครบจำนวนครั้งที่อนุญาตแล้ว' });
      }
    }

    // Grade
    let correct = 0;
    const result = quiz.questions.map(q => {
      const chosen = answers?.[q.id] || null;
      const isCorrect = chosen === q.correct_answer;
      if (isCorrect) correct++;
      return { id: q.id, question_text: q.question_text, correct_answer: q.correct_answer, chosen, isCorrect };
    });

    const earnedPoints = correct * quiz.points_per_q;

    // Save attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        student_id: req.user.id,
        quiz_id: quizId,
        score: earnedPoints,
        total_q: quiz.questions.length,
        correct,
        time_taken: time_taken || 0,
        answers,
      },
    });

    // Add points to user
    await prisma.user.update({
      where: { id: req.user.id },
      data: { total_points: { increment: earnedPoints } },
    });

    // ── ของรางวัลสุ่มสำหรับสัตว์เลี้ยง ──
    let rewards = [];
    try {
      const pct = quiz.questions.length ? (correct / quiz.questions.length) * 100 : 0;
      const state = await prisma.petState.findUnique({ where: { user_id: req.user.id } });
      if (state && state.pet_type) {
        const owned = Array.isArray(state.wardrobe) ? state.wardrobe : [];
        rewards = rollLoot(pct, owned);

        if (rewards.length) {
          const add = { herb: 0, kit: 0, snack: 0 };
          const newCostumes = [];
          rewards.forEach(r => {
            if (r.type === 'costume') newCostumes.push(r.key);
            else add[r.type] = (add[r.type] || 0) + (r.amount || 1);
          });

          await prisma.petState.update({
            where: { user_id: req.user.id },
            data: {
              item_herb:  Math.min(99, state.item_herb + add.herb),
              item_kit:   Math.min(99, state.item_kit + add.kit),
              item_snack: Math.min(99, (state.item_snack || 0) + add.snack),
              ...(newCostumes.length ? { wardrobe: [...owned, ...newCostumes] } : {}),
            },
          });
        }
      }
    } catch (lootErr) {
      console.error('quiz loot failed for user', req.user.id, '→', lootErr.message);
      rewards = [];
    }

    // ── ป้อนข้อมูลเข้าระบบวิเคราะห์การเรียนรู้ (เฉพาะข้อที่ครู import เข้าคลังแล้ว) ──
    let analytics = { ingested: 0 };
    try {
      analytics = await ingestQuizAttempt({
        userId: req.user.id,
        questions: quiz.questions,
        answers,
        timeTakenSec: time_taken || 0,
      });
    } catch (aErr) {
      console.error('quiz analytics ingest failed for user', req.user.id, '→', aErr.message);
    }

    res.json({
      attempt_id: attempt.id,
      correct,
      total: quiz.questions.length,
      analytics,
      score: earnedPoints,
      points_per_q: quiz.points_per_q,
      result,
      rewards,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ── GET /api/quiz/:id/leaderboard ─────────────────────────────────────────
const getQuizLeaderboard = async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);
    // Best attempt per student
    const attempts = await prisma.quizAttempt.findMany({
      where: { quiz_id: quizId },
      include: { student: { select: { id: true, name: true, student_number: true } } },
      orderBy: [{ score: 'desc' }, { time_taken: 'asc' }],
    });

    // Deduplicate: keep best per student
    const best = {};
    attempts.forEach(a => {
      if (!best[a.student_id] || a.score > best[a.student_id].score ||
          (a.score === best[a.student_id].score && a.time_taken < best[a.student_id].time_taken)) {
        best[a.student_id] = a;
      }
    });

    const ranked = Object.values(best).sort((a, b) =>
      b.score !== a.score ? b.score - a.score : a.time_taken - b.time_taken
    );

    res.json(ranked);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── GET /api/quiz/:id/my-attempts ─────────────────────────────────────────
const getMyAttempts = async (req, res) => {
  try {
    const attempts = await prisma.quizAttempt.findMany({
      where: { quiz_id: parseInt(req.params.id), student_id: req.user.id },
      orderBy: { completed_at: 'desc' },
    });
    res.json(attempts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── PUT /api/quiz/:id  (Teacher updates quiz) ─────────────────────────────
const updateQuiz = async (req, res) => {
  try {
    const qid = parseInt(req.params.id);
    const { title, description, time_limit, max_attempts, points_per_q, questions } = req.body;

    const quiz = await prisma.quiz.findUnique({ where: { id: qid } });
    if (!quiz) return res.status(404).json({ message: 'ไม่พบแบบฝึกหัด' });

    if (!title) return res.status(400).json({ message: 'กรุณาใส่ชื่อแบบฝึกหัด' });
    if (!questions?.length) return res.status(400).json({ message: 'กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อ' });

    for (const q of questions) {
      if (!q.question_text) return res.status(400).json({ message: 'คำถามต้องมีเนื้อหา' });
      if (!q.choices || q.choices.length < 2) return res.status(400).json({ message: 'ต้องมีตัวเลือกอย่างน้อย 2 ตัว' });
      if (!q.correct_answer) return res.status(400).json({ message: 'ต้องระบุคำตอบที่ถูกต้อง' });
      if (!q.choices.includes(q.correct_answer)) return res.status(400).json({ message: 'คำตอบที่ถูกต้องต้องอยู่ในตัวเลือก' });
    }

    await prisma.question.deleteMany({ where: { quiz_id: qid } });

    const updated = await prisma.quiz.update({
      where: { id: qid },
      data: {
        title,
        description: description || null,
        time_limit: time_limit ? parseInt(time_limit) : 600,
        max_attempts: max_attempts !== undefined ? parseInt(max_attempts) : 1,
        points_per_q: points_per_q ? parseInt(points_per_q) : 10,
        questions: {
          create: questions.map(q => ({
            question_text: q.question_text,
            choices: q.choices,
            correct_answer: q.correct_answer,
          })),
        },
      },
      include: { questions: true, _count: { select: { questions: true } } },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getQuizzes, getQuiz, createQuiz, updateQuiz, toggleQuiz, deleteQuiz, submitQuiz, getQuizLeaderboard, getMyAttempts };
