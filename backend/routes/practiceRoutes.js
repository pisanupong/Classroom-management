const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const { protect: authenticate, restrictTo } = require('../middleware/authMiddleware');
const A = require('../utils/learningAnalytics');
const { recordAttempt } = require('../utils/practiceEngine');

router.use(authenticate);

const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const dayEnd = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

// เอา check/เฉลยออกก่อนส่งข้อสอบให้ผู้เรียน — กันเปิดดูเฉลยจาก network tab
const publicItem = (it) => ({
  id: it.id,
  subject_id: it.subject_id,
  subject: it.subject?.name,
  topic: it.topic,
  sub_topic: it.sub_topic,
  bloom: it.bloom,
  question_text: it.question_text,
  choices: it.choices,
  has_hint: !!it.hint,
  elo: Math.round(it.elo),
  expected_sec: A.expectedSecForItem(it.elo, it.bloom),
});

/* ═══════════════ META ═══════════════ */
router.get('/meta', async (req, res) => {
  try {
    const [subjects, items] = await Promise.all([
      prisma.subject.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.practiceItem.groupBy({
        by: ['subject_id', 'topic', 'sub_topic'],
        where: { is_active: true },
        _count: { _all: true },
      }),
    ]);
    res.json({
      subjects,
      tree: items.map(i => ({ subjectId: i.subject_id, topic: i.topic, subTopic: i.sub_topic, count: i._count._all })),
      bloomLevels: A.BLOOM_LEVELS,
      masteryLevels: A.MASTERY_LEVELS,
    });
  } catch (e) {
    console.error('[PRACTICE] meta:', e);
    res.status(500).json({ message: 'ดึงข้อมูลไม่สำเร็จ' });
  }
});

/* ═══════════════ ชุดฝึกวันนี้ (Dynamic Item Selection) ═══════════════ */
/*
 * ลำดับความสำคัญ:
 *   1. หัวข้อที่ถึงกำหนดทบทวน (next_review_date <= วันนี้)   — กันการลืม
 *   2. หัวข้อที่ยังไม่ชำนาญ (ตอบผิดล่าสุด / p_known ต่ำ)
 *   3. ข้อใหม่ที่ยังไม่เคยทำ ซึ่ง elo ใกล้ระดับผู้เรียน       — ไม่ง่ายไม่ยากเกิน
 * เลี่ยงข้อที่เพิ่งทำใน 3 วัน (ยกเว้นหัวข้อที่ถึงกำหนดทบทวน)
 */
router.get('/session', async (req, res) => {
  try {
    const userId = req.user.id;
    const count = Math.min(20, Math.max(3, parseInt(req.query.count, 10) || 10));
    const subjectId = req.query.subject ? parseInt(req.query.subject, 10) : null;
    const topic = req.query.topic || null;

    const where = { is_active: true };
    if (subjectId) where.subject_id = subjectId;
    if (topic) where.topic = topic;

    const [pool, states, recent] = await Promise.all([
      prisma.practiceItem.findMany({ where, include: { subject: { select: { name: true } } } }),
      prisma.masteryState.findMany({ where: { user_id: userId } }),
      prisma.practiceAttempt.findMany({
        where: { user_id: userId, created_at: { gte: new Date(Date.now() - 3 * 86400000) } },
        select: { item_id: true },
      }),
    ]);

    if (!pool.length) return res.json({ items: [], reason: 'คลังข้อสอบยังว่าง — ให้ครูเพิ่มข้อสอบก่อน' });

    const stateBySub = Object.fromEntries(states.map(s => [s.sub_topic, s]));
    const recentIds = new Set(recent.map(r => r.item_id));
    const today = todayStart();

    // ระดับความสามารถของผู้เรียน — เฉลี่ย elo ของหัวข้อที่เคยทำ (ยังไม่เคยทำ = 1200)
    const learnerElo = states.length
      ? states.reduce((s, x) => s + x.elo, 0) / states.length
      : 1200;

    const scored = pool.map(it => {
      const st = stateBySub[it.sub_topic];
      const due = st?.next_review_date && new Date(st.next_review_date) <= today;
      let score = 0;

      if (due) score += 1000 + (st.reps === 0 ? 50 : 0);                    // ถึงกำหนดทบทวน = มาก่อน
      if (!st) score += 300;                                                // หัวข้อใหม่ที่ยังไม่เคยแตะ
      else {
        if (st.mastery_status === 'learning')   score += 400;
        if (st.mastery_status === 'developing') score += 250;
        if (st.mastery_status === 'proficient') score += 60;
        if (st.mastery_status === 'mastered')   score += 10;
        score += (1 - st.p_known) * 200;                                    // ยิ่งไม่แน่ใจยิ่งควรทำ
      }
      // ความยากที่เหมาะสม: ห่างจากระดับผู้เรียนน้อย = ดี (โซนพัฒนา)
      score += Math.max(0, 150 - Math.abs(it.elo - learnerElo) / 2);
      if (recentIds.has(it.id) && !due) score -= 500;                       // เพิ่งทำไป
      score += Math.random() * 60;                                          // กันได้ชุดเดิมซ้ำๆ
      return { it, score, due: !!due };
    });

    scored.sort((a, b) => b.score - a.score);

    // ไม่ให้หัวข้อย่อยเดียวเกิน 40% ของชุด เพื่อให้ได้ฝึกหลายเรื่อง
    const maxPerSub = Math.max(2, Math.ceil(count * 0.4));
    const perSub = {};
    const picked = [];
    for (const s of scored) {
      const k = s.it.sub_topic;
      if ((perSub[k] || 0) >= maxPerSub) continue;
      perSub[k] = (perSub[k] || 0) + 1;
      picked.push(s);
      if (picked.length >= count) break;
    }

    res.json({
      items: picked.map(p => ({ ...publicItem(p.it), due: p.due })),
      learnerElo: Math.round(learnerElo),
      dueCount: scored.filter(s => s.due).length,
    });
  } catch (e) {
    console.error('[PRACTICE] session:', e);
    res.status(500).json({ message: 'สร้างชุดฝึกไม่สำเร็จ' });
  }
});

/* ═══════════════ คิวทบทวนวันนี้ ═══════════════ */
router.get('/due', async (req, res) => {
  try {
    const today = todayStart();
    const states = await prisma.masteryState.findMany({
      where: { user_id: req.user.id },
      orderBy: { next_review_date: 'asc' },
    });
    const subjects = await prisma.subject.findMany({ select: { id: true, name: true } });
    const subName = Object.fromEntries(subjects.map(s => [s.id, s.name]));

    const rows = states.map(s => ({
      subTopic: s.sub_topic,
      topic: s.topic,
      subject: subName[s.subject_id] || '(ไม่ระบุวิชา)',
      status: s.mastery_status,
      pKnown: s.p_known,
      intervalDays: s.interval_days,
      ef: s.ef,
      reps: s.reps,
      nextReviewDate: s.next_review_date,
      overdueDays: s.next_review_date
        ? Math.max(0, Math.floor((today - new Date(s.next_review_date)) / 86400000))
        : 0,
      due: s.next_review_date ? new Date(s.next_review_date) <= today : false,
    }));

    res.json({
      due: rows.filter(r => r.due),
      upcoming: rows.filter(r => !r.due).slice(0, 15),
      dueCount: rows.filter(r => r.due).length,
    });
  } catch (e) {
    console.error('[PRACTICE] due:', e);
    res.status(500).json({ message: 'ดึงคิวทบทวนไม่สำเร็จ' });
  }
});

/* ═══════════════ คำใบ้ ═══════════════ */
router.get('/hint/:itemId', async (req, res) => {
  try {
    const it = await prisma.practiceItem.findUnique({
      where: { id: parseInt(req.params.itemId, 10) },
      select: { hint: true },
    });
    if (!it) return res.status(404).json({ message: 'ไม่พบข้อสอบ' });
    res.json({ hint: it.hint || 'ข้อนี้ยังไม่มีคำใบ้' });
  } catch (e) {
    res.status(500).json({ message: 'ดึงคำใบ้ไม่สำเร็จ' });
  }
});

/* ═══════════════ ส่งคำตอบ 1 ข้อ ═══════════════ */
router.post('/answer', async (req, res) => {
  try {
    const { itemId, answer, timeSpentSec = 0, answerChanges = 0, hintUsed = false, skipped = false } = req.body;
    const item = await prisma.practiceItem.findUnique({ where: { id: parseInt(itemId, 10) } });
    if (!item || !item.is_active) return res.status(404).json({ message: 'ไม่พบข้อสอบ' });

    const r = await recordAttempt({
      userId: req.user.id, item, chosen: answer,
      timeSpentSec: Math.min(3600, Math.max(0, parseInt(timeSpentSec, 10) || 0)),
      answerChanges: Math.min(50, Math.max(0, parseInt(answerChanges, 10) || 0)),
      hintUsed: !!hintUsed, skipped: !!skipped, source: 'practice',
    });

    // มโนทัศน์ที่คลาดเคลื่อน ตรงกับตัวเลือกที่เลือกผิด (Real-time Feedback เฉพาะบุคคล)
    const mis = (!r.isCorrect && !skipped && item.misconception && typeof item.misconception === 'object')
      ? item.misconception[String(answer)] || null
      : null;

    res.json({
      correct: r.isCorrect,
      correctAnswer: item.correct_answer,
      explanation: item.explanation || null,
      misconception: mis,
      quality: r.q,
      expectedSec: r.expectedSec,
      attemptNumber: r.attemptNumber,
      elo: {
        before: Math.round(r.attempt.elo_before),
        after: Math.round(r.attempt.elo_after),
        delta: Math.round((r.attempt.elo_after - r.attempt.elo_before) * 10) / 10,
      },
      surprise: r.elo.surprise,
      pKnown: r.pKnown,
      masteryStatus: r.status,
      streak: r.streak,
      nextReview: { days: r.srs.intervalDays, date: r.srs.nextReviewDate, ef: r.srs.ef },
    });
  } catch (e) {
    console.error('[PRACTICE] answer:', e);
    res.status(500).json({ message: 'บันทึกคำตอบไม่สำเร็จ' });
  }
});

/* ═══════════════ Dashboard ผู้เรียน ═══════════════ */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.query.userId && req.user.role !== 'STUDENT'
      ? parseInt(req.query.userId, 10)
      : req.user.id;

    const [states, subjects, attempts] = await Promise.all([
      prisma.masteryState.findMany({ where: { user_id: userId } }),
      prisma.subject.findMany({ select: { id: true, name: true } }),
      prisma.practiceAttempt.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'asc' },
        select: {
          subject_id: true, topic: true, sub_topic: true, bloom: true,
          is_correct: true, time_spent_sec: true, created_at: true, quality: true, source: true,
        },
      }),
    ]);

    const subName = Object.fromEntries(subjects.map(s => [s.id, s.name]));
    const today = todayStart();

    // ── Knowledge Heatmap: วิชา → หัวข้อ → หัวข้อย่อย
    const bySubject = {};
    states.forEach(st => {
      const decay = A.decayRisk({
        masteryStatus: st.mastery_status,
        recentAccuracy: st.recent_accuracy,
        firstAccuracy: st.first_accuracy,
        nextReviewDate: st.next_review_date,
      });
      const subTimes = attempts
        .filter(a => a.sub_topic === st.sub_topic && a.is_correct && a.source === 'practice')
        .map(a => a.time_spent_sec);

      const node = {
        subTopic: st.sub_topic,
        topic: st.topic,
        elo: Math.round(st.elo),
        pKnown: st.p_known,
        status: st.mastery_status,
        streak: st.streak,
        longestStreak: st.longest_streak,
        attempts: st.total_attempts,
        accuracy: pct(st.total_correct, st.total_attempts),
        firstAccuracy: st.first_accuracy,
        recentAccuracy: st.recent_accuracy,
        growth: (st.recent_accuracy != null && st.first_accuracy != null)
          ? Math.round((st.recent_accuracy - st.first_accuracy) * 10) / 10 : null,
        avgTimeSec: st.avg_time_sec,
        fluency: A.fluencyTrend(subTimes),
        due: st.next_review_date ? new Date(st.next_review_date) <= today : false,
        nextReviewDate: st.next_review_date,
        intervalDays: st.interval_days,
        ef: st.ef,
        decay,
      };
      const sid = st.subject_id;
      bySubject[sid] = bySubject[sid] || { subjectId: sid, subject: subName[sid] || '(ไม่ระบุวิชา)', topics: {} };
      bySubject[sid].topics[st.topic] = bySubject[sid].topics[st.topic] || { topic: st.topic, subTopics: [] };
      bySubject[sid].topics[st.topic].subTopics.push(node);
    });

    const heatmap = Object.values(bySubject).map(s => {
      const topics = Object.values(s.topics).map(t => {
        const n = t.subTopics.length;
        return {
          ...t,
          avgPKnown: Math.round((t.subTopics.reduce((x, y) => x + y.pKnown, 0) / n) * 100) / 100,
          mastered: t.subTopics.filter(x => x.status === 'mastered').length,
          weak: t.subTopics.filter(x => x.status === 'learning' || x.status === 'developing').length,
        };
      });
      const allSubs = topics.flatMap(t => t.subTopics);
      const totA = allSubs.reduce((x, y) => x + y.attempts, 0);
      return {
        ...s, topics,
        elo: Math.round(allSubs.reduce((x, y) => x + y.elo, 0) / allSubs.length),
        attempts: totA,
        avgPKnown: Math.round((allSubs.reduce((x, y) => x + y.pKnown, 0) / allSubs.length) * 100) / 100,
        masteredCount: allSubs.filter(x => x.status === 'mastered').length,
        subTopicCount: allSubs.length,
      };
    }).sort((a, b) => b.attempts - a.attempts);

    // ── Accuracy trend รายวัน (30 วันล่าสุด)
    const byDay = {};
    attempts.forEach(a => {
      const k = new Date(a.created_at).toISOString().slice(0, 10);
      byDay[k] = byDay[k] || { date: k, total: 0, correct: 0, time: 0 };
      byDay[k].total++;
      if (a.is_correct) byDay[k].correct++;
      byDay[k].time += a.time_spent_sec;
    });
    const trend = Object.values(byDay).slice(-30).map(d => ({
      date: d.date, total: d.total, accuracy: pct(d.correct, d.total),
      avgTime: Math.round(d.time / d.total),
    }));

    // ── ความก้าวหน้าตามระดับ Bloom
    const bloom = A.BLOOM_LEVELS.map(b => {
      const rows = attempts.filter(a => a.bloom === b.key);
      return { ...b, attempts: rows.length, accuracy: pct(rows.filter(r => r.is_correct).length, rows.length) };
    });

    // ── Learning Path: หัวข้อที่ควรซ่อมเสริมก่อน
    const allNodes = heatmap.flatMap(s => s.topics.flatMap(t => t.subTopics.map(x => ({ ...x, subject: s.subject }))));
    const recommendations = allNodes
      .map(n => {
        let priority = 0;
        let reason = '';
        if (n.decay.level === 'high')   { priority += 100; reason = `เคยทำได้แล้วแต่เริ่มลืม (เลยกำหนดทบทวน ${n.decay.overdueDays} วัน)`; }
        else if (n.due)                 { priority += 80;  reason = 'ถึงกำหนดทบทวนวันนี้'; }
        if (n.status === 'learning')     { priority += 70;  reason = reason || 'ยังตอบถูกไม่สม่ำเสมอ ควรฝึกเพิ่ม'; }
        else if (n.status === 'developing') { priority += 45; reason = reason || 'กำลังพัฒนา อีกไม่ไกลก็ชำนาญ'; }
        if (n.growth != null && n.growth < -10) { priority += 30; reason = `ผลตกลง ${Math.abs(n.growth)}% จากช่วงแรก`; }
        if (n.accuracy != null && n.accuracy < 50) priority += 25;
        return { ...n, priority, reason };
      })
      .filter(n => n.priority > 0)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 8);

    const totalA = attempts.length;
    const practiceOnly = attempts.filter(a => a.source === 'practice');
    const dueToday = states.filter(s => s.next_review_date && new Date(s.next_review_date) <= today).length;

    res.json({
      summary: {
        totalAttempts: totalA,
        accuracy: pct(attempts.filter(a => a.is_correct).length, totalA),
        avgTimeSec: totalA ? Math.round(attempts.reduce((s, a) => s + a.time_spent_sec, 0) / totalA) : 0,
        elo: states.length ? Math.round(states.reduce((s, x) => s + x.elo, 0) / states.length) : 1200,
        subTopics: states.length,
        mastered: states.filter(s => s.mastery_status === 'mastered').length,
        proficient: states.filter(s => s.mastery_status === 'proficient').length,
        dueToday,
        longestStreak: states.reduce((m, s) => Math.max(m, s.longest_streak), 0),
        practiceRatio: pct(practiceOnly.length, totalA),
        daysActive: new Set(attempts.map(a => new Date(a.created_at).toISOString().slice(0, 10))).size,
      },
      heatmap, trend, bloom, recommendations,
      masteryLevels: A.MASTERY_LEVELS,
      bloomLevels: A.BLOOM_LEVELS,
    });
  } catch (e) {
    console.error('[PRACTICE] dashboard:', e);
    res.status(500).json({ message: 'ดึงรายงานไม่สำเร็จ' });
  }
});

/* ═══════════════ ภาพรวมห้อง (ครู) ═══════════════ */
router.get('/class', restrictTo('TEACHER'), async (req, res) => {
  try {
    const subjectId = req.query.subject ? parseInt(req.query.subject, 10) : null;

    const [attempts, states, items, students] = await Promise.all([
      prisma.practiceAttempt.findMany({
        where: subjectId ? { subject_id: subjectId } : {},
        select: {
          user_id: true, item_id: true, sub_topic: true, topic: true, bloom: true,
          is_correct: true, chosen_answer: true, time_spent_sec: true, created_at: true,
        },
      }),
      prisma.masteryState.findMany({ where: subjectId ? { subject_id: subjectId } : {} }),
      prisma.practiceItem.findMany({
        where: { ...(subjectId ? { subject_id: subjectId } : {}), is_active: true },
        include: { subject: { select: { name: true } } },
      }),
      prisma.user.findMany({
        where: { role: { in: ['STUDENT', 'CLASS_ADMIN'] } },
        select: { id: true, name: true, username: true, student_number: true },
      }),
    ]);

    const nameOf = Object.fromEntries(students.map(s => [s.id, s.name || s.username]));

    // คะแนนรวมของแต่ละคน — ใช้เป็นเกณฑ์แบ่งกลุ่มสูง/ต่ำสำหรับ item analysis
    const userScore = {};
    attempts.forEach(a => {
      userScore[a.user_id] = userScore[a.user_id] || { total: 0, correct: 0 };
      userScore[a.user_id].total++;
      if (a.is_correct) userScore[a.user_id].correct++;
    });
    const scoreOf = (uid) => {
      const s = userScore[uid];
      return s && s.total ? s.correct / s.total : 0;
    };

    // ── Item Analysis: ค่าความยาก p และอำนาจจำแนก d
    const itemAnalysisRows = items.map(it => {
      const rows = attempts
        .filter(a => a.item_id === it.id)
        .map(a => ({ userScore: scoreOf(a.user_id), isCorrect: a.is_correct }));
      const stats = A.itemAnalysis(rows);
      return {
        id: it.id, question_text: it.question_text,
        subject: it.subject?.name, topic: it.topic, sub_topic: it.sub_topic, bloom: it.bloom,
        elo: Math.round(it.elo), timesShown: it.times_shown,
        ...stats,
        qualityLabel: A.ITEM_QUALITY_LABEL[stats.quality],
      };
    });

    // ── ข้อที่คนตอบผิดเยอะที่สุด (มีข้อมูลพอ)
    const hardest = [...itemAnalysisRows]
      .filter(r => r.n >= 3)
      .sort((a, b) => a.p - b.p)
      .slice(0, 10);

    // ── Misconception Alert: ตัวเลือกผิดที่ถูกเลือกซ้ำเป็นกลุ่มก้อน
    const misconceptions = [];
    items.forEach(it => {
      const wrong = attempts.filter(a => a.item_id === it.id && !a.is_correct && a.chosen_answer);
      if (wrong.length < 3) return;
      const byChoice = {};
      wrong.forEach(w => { byChoice[w.chosen_answer] = (byChoice[w.chosen_answer] || []).concat(w.user_id); });
      Object.entries(byChoice).forEach(([choice, uids]) => {
        const unique = [...new Set(uids)];
        // ตัวเลือกเดียวกัน ผิดเหมือนกัน ≥3 คน และเป็น ≥50% ของคำตอบผิดทั้งหมด = น่าจะเข้าใจผิดร่วมกัน
        if (unique.length >= 3 && uids.length / wrong.length >= 0.5) {
          misconceptions.push({
            itemId: it.id, question_text: it.question_text,
            topic: it.topic, sub_topic: it.sub_topic,
            chosen: choice, correct: it.correct_answer,
            note: (it.misconception && it.misconception[choice]) || null,
            students: unique.length, occurrences: uids.length,
            studentNames: unique.slice(0, 8).map(u => nameOf[u] || `#${u}`),
          });
        }
      });
    });
    misconceptions.sort((a, b) => b.students - a.students);

    // ── หัวข้อย่อยที่ห้องอ่อนที่สุด
    const bySub = {};
    states.forEach(st => {
      bySub[st.sub_topic] = bySub[st.sub_topic] || { subTopic: st.sub_topic, topic: st.topic, rows: [] };
      bySub[st.sub_topic].rows.push(st);
    });
    const weakTopics = Object.values(bySub).map(g => {
      const n = g.rows.length;
      const totalA = g.rows.reduce((s, x) => s + x.total_attempts, 0);
      const totalC = g.rows.reduce((s, x) => s + x.total_correct, 0);
      return {
        subTopic: g.subTopic, topic: g.topic, students: n,
        accuracy: pct(totalC, totalA), attempts: totalA,
        avgPKnown: Math.round((g.rows.reduce((s, x) => s + x.p_known, 0) / n) * 100) / 100,
        mastered: g.rows.filter(x => x.mastery_status === 'mastered').length,
        struggling: g.rows.filter(x => x.mastery_status === 'learning').length,
      };
    }).sort((a, b) => a.avgPKnown - b.avgPKnown);

    // ── Automated Grouping: จัดกลุ่มนักเรียนตามระดับความเข้าใจ
    const perStudent = {};
    states.forEach(st => {
      perStudent[st.user_id] = perStudent[st.user_id] || { userId: st.user_id, name: nameOf[st.user_id] || `#${st.user_id}`, rows: [] };
      perStudent[st.user_id].rows.push(st);
    });
    const studentRows = Object.values(perStudent).map(s => {
      const n = s.rows.length;
      const totalA = s.rows.reduce((x, y) => x + y.total_attempts, 0);
      const totalC = s.rows.reduce((x, y) => x + y.total_correct, 0);
      const avgP = s.rows.reduce((x, y) => x + y.p_known, 0) / n;
      const weak = s.rows.filter(x => x.mastery_status === 'learning').map(x => x.sub_topic);
      return {
        userId: s.userId, name: s.name,
        elo: Math.round(s.rows.reduce((x, y) => x + y.elo, 0) / n),
        avgPKnown: Math.round(avgP * 100) / 100,
        accuracy: pct(totalC, totalA), attempts: totalA, subTopics: n,
        mastered: s.rows.filter(x => x.mastery_status === 'mastered').length,
        weakTopics: weak.slice(0, 5),
        group: avgP >= 0.85 ? 'advanced' : avgP >= 0.6 ? 'ontrack' : 'needs_help',
      };
    }).sort((a, b) => b.avgPKnown - a.avgPKnown);

    const groups = [
      { key: 'advanced',   label: '🟢 พร้อมเนื้อหาที่ยากขึ้น', color: '#4ade80', students: studentRows.filter(s => s.group === 'advanced') },
      { key: 'ontrack',    label: '🟡 ตามเกณฑ์',              color: '#fbbf24', students: studentRows.filter(s => s.group === 'ontrack') },
      { key: 'needs_help', label: '🔴 ต้องสอนซ่อมเสริม',      color: '#f87171', students: studentRows.filter(s => s.group === 'needs_help') },
    ];

    // ── ภาพรวมตามระดับ Bloom ของทั้งห้อง
    const bloom = A.BLOOM_LEVELS.map(b => {
      const rows = attempts.filter(a => a.bloom === b.key);
      return { ...b, attempts: rows.length, accuracy: pct(rows.filter(r => r.is_correct).length, rows.length) };
    });

    res.json({
      summary: {
        students: studentRows.length,
        totalAttempts: attempts.length,
        accuracy: pct(attempts.filter(a => a.is_correct).length, attempts.length),
        items: items.length,
        subTopics: Object.keys(bySub).length,
        needsHelp: groups[2].students.length,
      },
      hardest, misconceptions: misconceptions.slice(0, 10), weakTopics, groups, bloom,
      itemAnalysis: itemAnalysisRows.sort((a, b) => (b.n - a.n)),
    });
  } catch (e) {
    console.error('[PRACTICE] class:', e);
    res.status(500).json({ message: 'ดึงภาพรวมห้องไม่สำเร็จ' });
  }
});

/* ═══════════════ คลังข้อสอบ (ครู) ═══════════════ */
router.get('/items', restrictTo('TEACHER'), async (req, res) => {
  try {
    const where = { };
    if (req.query.subject) where.subject_id = parseInt(req.query.subject, 10);
    if (req.query.topic) where.topic = req.query.topic;
    if (req.query.search) {
      where.OR = [
        { question_text: { contains: req.query.search, mode: 'insensitive' } },
        { sub_topic:     { contains: req.query.search, mode: 'insensitive' } },
        { topic:         { contains: req.query.search, mode: 'insensitive' } },
      ];
    }
    const items = await prisma.practiceItem.findMany({
      where, orderBy: [{ subject_id: 'asc' }, { topic: 'asc' }, { sub_topic: 'asc' }, { id: 'asc' }],
      include: { subject: { select: { name: true } }, author: { select: { name: true } } },
      take: 300,
    });
    res.json(items.map(it => ({
      ...it,
      accuracy: pct(it.times_correct, it.times_shown),
      elo: Math.round(it.elo),
      linkedToQuiz: !!it.source_question_id,
    })));
  } catch (e) {
    console.error('[PRACTICE] items:', e);
    res.status(500).json({ message: 'ดึงคลังข้อสอบไม่สำเร็จ' });
  }
});

const validateItem = (b) => {
  if (!b.subject_id) return 'กรุณาเลือกวิชา';
  if (!b.topic?.trim()) return 'กรุณาระบุหัวข้อ';
  if (!b.sub_topic?.trim()) return 'กรุณาระบุหัวข้อย่อย';
  if (!b.question_text?.trim()) return 'กรุณาใส่คำถาม';
  const choices = Array.isArray(b.choices) ? b.choices.filter(c => String(c).trim()) : [];
  if (choices.length < 2) return 'ต้องมีตัวเลือกอย่างน้อย 2 ข้อ';
  if (!b.correct_answer || !choices.map(String).includes(String(b.correct_answer))) return 'คำตอบที่ถูกต้องต้องตรงกับตัวเลือกใดตัวเลือกหนึ่ง';
  if (b.bloom && !A.BLOOM_KEYS.includes(b.bloom)) return 'ระดับ Bloom ไม่ถูกต้อง';
  return null;
};

const itemPayload = (b) => ({
  subject_id: parseInt(b.subject_id, 10),
  topic: b.topic.trim(),
  sub_topic: b.sub_topic.trim(),
  bloom: b.bloom || 'understand',
  question_text: b.question_text.trim(),
  choices: b.choices.filter(c => String(c).trim()).map(String),
  correct_answer: String(b.correct_answer),
  explanation: b.explanation?.trim() || null,
  hint: b.hint?.trim() || null,
  misconception: (b.misconception && typeof b.misconception === 'object' && Object.keys(b.misconception).length)
    ? b.misconception : null,
  is_active: b.is_active !== false,
});

router.post('/items', restrictTo('TEACHER'), async (req, res) => {
  const err = validateItem(req.body);
  if (err) return res.status(400).json({ message: err });
  try {
    const item = await prisma.practiceItem.create({
      data: { ...itemPayload(req.body), created_by: req.user.id },
    });
    res.status(201).json(item);
  } catch (e) {
    console.error('[PRACTICE] create item:', e);
    res.status(500).json({ message: 'เพิ่มข้อสอบไม่สำเร็จ' });
  }
});

router.put('/items/:id', restrictTo('TEACHER'), async (req, res) => {
  const err = validateItem(req.body);
  if (err) return res.status(400).json({ message: err });
  try {
    const item = await prisma.practiceItem.update({
      where: { id: parseInt(req.params.id, 10) },
      data: itemPayload(req.body),
    });
    res.json(item);
  } catch (e) {
    console.error('[PRACTICE] update item:', e);
    res.status(500).json({ message: 'แก้ไขข้อสอบไม่สำเร็จ' });
  }
});

// ปิดใช้งานแทนการลบ ถ้ามีสถิติแล้ว — ไม่ให้ประวัติการเรียนรู้หาย
router.delete('/items/:id', restrictTo('TEACHER'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const used = await prisma.practiceAttempt.count({ where: { item_id: id } });
    if (used > 0) {
      await prisma.practiceItem.update({ where: { id }, data: { is_active: false } });
      return res.json({ ok: true, deactivated: true, message: `ข้อนี้มีสถิติ ${used} ครั้งแล้ว จึงปิดใช้งานแทนการลบ` });
    }
    await prisma.practiceItem.delete({ where: { id } });
    res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[PRACTICE] delete item:', e);
    res.status(500).json({ message: 'ลบข้อสอบไม่สำเร็จ' });
  }
});

/* ═══════════════ Import จาก Quiz เดิม ═══════════════ */
router.get('/importable-quizzes', restrictTo('TEACHER'), async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      orderBy: { created_at: 'desc' },
      include: { questions: { select: { id: true } } },
    });
    const linked = await prisma.practiceItem.findMany({
      where: { source_question_id: { not: null } },
      select: { source_question_id: true },
    });
    const linkedSet = new Set(linked.map(l => l.source_question_id));
    res.json(quizzes.map(q => ({
      id: q.id, title: q.title,
      total: q.questions.length,
      imported: q.questions.filter(x => linkedSet.has(x.id)).length,
    })));
  } catch (e) {
    console.error('[PRACTICE] importable:', e);
    res.status(500).json({ message: 'ดึงรายการ Quiz ไม่สำเร็จ' });
  }
});

// นำข้อสอบจาก Quiz มาเข้าคลัง พร้อม tag วิชา/หัวข้อ (ครูมาแก้หัวข้อย่อยรายข้อทีหลังได้)
router.post('/items/import-quiz/:quizId', restrictTo('TEACHER'), async (req, res) => {
  try {
    const { subject_id, topic, sub_topic, bloom } = req.body;
    if (!subject_id || !topic?.trim() || !sub_topic?.trim()) {
      return res.status(400).json({ message: 'กรุณาระบุ วิชา / หัวข้อ / หัวข้อย่อย สำหรับข้อสอบที่นำเข้า' });
    }
    const quizId = parseInt(req.params.quizId, 10);
    const questions = await prisma.question.findMany({ where: { quiz_id: quizId } });
    if (!questions.length) return res.status(404).json({ message: 'Quiz นี้ไม่มีข้อสอบ' });

    const existing = await prisma.practiceItem.findMany({
      where: { source_question_id: { in: questions.map(q => q.id) } },
      select: { source_question_id: true },
    });
    const done = new Set(existing.map(e => e.source_question_id));
    const todo = questions.filter(q => !done.has(q.id));

    if (!todo.length) return res.json({ ok: true, imported: 0, skipped: questions.length, message: 'นำเข้าครบแล้วก่อนหน้านี้' });

    const created = await prisma.practiceItem.createMany({
      data: todo.map(q => ({
        subject_id: parseInt(subject_id, 10),
        topic: topic.trim(),
        sub_topic: sub_topic.trim(),
        bloom: A.BLOOM_KEYS.includes(bloom) ? bloom : 'understand',
        question_text: q.question_text,
        choices: q.choices,
        correct_answer: q.correct_answer,
        created_by: req.user.id,
        source_question_id: q.id,
      })),
    });

    res.json({ ok: true, imported: created.count, skipped: questions.length - todo.length });
  } catch (e) {
    console.error('[PRACTICE] import quiz:', e);
    res.status(500).json({ message: 'นำเข้าข้อสอบไม่สำเร็จ' });
  }
});

/* ═══════════════ รายชื่อผู้เรียน (ครูเลือกดู dashboard รายคน) ═══════════════ */
router.get('/students', restrictTo('TEACHER'), async (req, res) => {
  try {
    const states = await prisma.masteryState.groupBy({
      by: ['user_id'],
      _count: { _all: true },
      _avg: { p_known: true, elo: true },
    });
    const users = await prisma.user.findMany({
      where: { id: { in: states.map(s => s.user_id) } },
      select: { id: true, name: true, username: true, student_number: true },
    });
    const byId = Object.fromEntries(users.map(u => [u.id, u]));
    res.json(states
      .map(s => ({
        userId: s.user_id,
        name: byId[s.user_id]?.name || byId[s.user_id]?.username || `#${s.user_id}`,
        studentNumber: byId[s.user_id]?.student_number || null,
        subTopics: s._count._all,
        avgPKnown: Math.round((s._avg.p_known || 0) * 100) / 100,
        elo: Math.round(s._avg.elo || 1200),
      }))
      .sort((a, b) => b.avgPKnown - a.avgPKnown));
  } catch (e) {
    console.error('[PRACTICE] students:', e);
    res.status(500).json({ message: 'ดึงรายชื่อไม่สำเร็จ' });
  }
});

module.exports = router;
