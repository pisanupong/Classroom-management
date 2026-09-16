/*
 * เครื่องมือกลางสำหรับบันทึกการทำข้อสอบ 1 ครั้ง
 * แยกออกจาก route เพื่อให้ quizController เรียกใช้ได้ด้วย (Quiz เดิมป้อนข้อมูลเข้าระบบวิเคราะห์)
 */
const prisma = require('../config/db');
const A = require('./learningAnalytics');

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

// อัปเดต first_accuracy (5 ครั้งแรก) และ recent_accuracy (5 ครั้งล่าสุด) ของหัวข้อย่อย
async function refreshAccuracyWindow(userId, subTopic) {
  try {
    const rows = await prisma.practiceAttempt.findMany({
      where: { user_id: userId, sub_topic: subTopic },
      orderBy: { created_at: 'asc' },
      select: { is_correct: true },
    });
    if (rows.length < 3) return;
    const first = rows.slice(0, 5);
    const recent = rows.slice(-5);
    await prisma.masteryState.update({
      where: { user_id_sub_topic: { user_id: userId, sub_topic: subTopic } },
      data: {
        first_accuracy: pct(first.filter(r => r.is_correct).length, first.length),
        recent_accuracy: pct(recent.filter(r => r.is_correct).length, recent.length),
      },
    });
  } catch (e) {
    console.error('[PRACTICE] accuracy window:', e.message);
  }
}

/*
 * ตัดสินถูก/ผิดที่เซิร์ฟเวอร์ แล้วอัปเดตครบใน transaction เดียว:
 *   Elo (คน+ข้อ) → q → SM-2 → BKT → mastery_status → log
 */
async function recordAttempt({
  userId, item, chosen,
  timeSpentSec = 0, answerChanges = 0, hintUsed = false, skipped = false,
  source = 'practice',
}) {
  const isCorrect = !skipped && String(chosen) === String(item.correct_answer);

  const state = await prisma.masteryState.findUnique({
    where: { user_id_sub_topic: { user_id: userId, sub_topic: item.sub_topic } },
  });

  const prevElo = state?.elo ?? 1200;
  const prevAttempts = state?.total_attempts ?? 0;

  const elo = A.eloUpdate({
    learnerElo: prevElo,
    itemElo: item.elo,
    isCorrect,
    learnerAttempts: prevAttempts,
    itemAttempts: item.times_shown,
  });

  const expectedSec = A.expectedSecForItem(item.elo, item.bloom);
  const q = A.gradeQuality({ isCorrect, timeSpentSec, expectedSec, hintUsed, answerChanges, skipped });
  const srs = A.sm2({ q, reps: state?.reps ?? 0, ef: state?.ef ?? 2.5, intervalDays: state?.interval_days ?? 0 });
  const pKnown = A.bktUpdate({ pKnown: state?.p_known ?? A.BKT.P_INIT, isCorrect, hintUsed });

  const streak = isCorrect ? (state?.streak ?? 0) + 1 : 0;
  const totalAttempts = prevAttempts + 1;
  const totalCorrect = (state?.total_correct ?? 0) + (isCorrect ? 1 : 0);
  const status = A.masteryStatus({ pKnown, streak, totalAttempts });

  // เวลาเฉลี่ยแบบ running average (ไม่นับข้อที่ข้าม)
  const avgTime = skipped
    ? (state?.avg_time_sec ?? 0)
    : Math.round((((state?.avg_time_sec ?? 0) * prevAttempts + timeSpentSec) / totalAttempts) * 10) / 10;

  const attemptNumber = await prisma.practiceAttempt.count({ where: { user_id: userId, item_id: item.id } }) + 1;

  const stateData = {
    subject_id: item.subject_id,
    topic: item.topic,
    elo: elo.learnerElo,
    p_known: pKnown,
    mastery_status: status,
    streak,
    longest_streak: Math.max(state?.longest_streak ?? 0, streak),
    total_attempts: totalAttempts,
    total_correct: totalCorrect,
    avg_time_sec: avgTime,
    ef: srs.ef,
    interval_days: srs.intervalDays,
    reps: srs.reps,
    next_review_date: srs.nextReviewDate,
    last_tested_at: new Date(),
  };

  const [attempt] = await prisma.$transaction([
    prisma.practiceAttempt.create({
      data: {
        user_id: userId, item_id: item.id, subject_id: item.subject_id,
        topic: item.topic, sub_topic: item.sub_topic, bloom: item.bloom,
        is_correct: isCorrect, chosen_answer: skipped ? null : String(chosen ?? ''),
        time_spent_sec: timeSpentSec, answer_changes: answerChanges,
        hint_used: hintUsed, skipped, quality: q, attempt_number: attemptNumber,
        elo_before: prevElo, elo_after: elo.learnerElo, item_elo_before: item.elo,
        source,
      },
    }),
    prisma.practiceItem.update({
      where: { id: item.id },
      data: {
        elo: elo.itemElo,
        times_shown: { increment: 1 },
        ...(isCorrect ? { times_correct: { increment: 1 } } : {}),
      },
    }),
    prisma.masteryState.upsert({
      where: { user_id_sub_topic: { user_id: userId, sub_topic: item.sub_topic } },
      create: { user_id: userId, sub_topic: item.sub_topic, ...stateData },
      update: stateData,
    }),
  ]);

  // คำนวณหลังบันทึก เพื่อให้รวมครั้งนี้ด้วย
  await refreshAccuracyWindow(userId, item.sub_topic);

  return { attempt, isCorrect, q, elo, srs, pKnown, status, streak, expectedSec, attemptNumber };
}

/*
 * ป้อนผลจาก Quiz เดิมเข้าระบบวิเคราะห์
 * นับเฉพาะข้อที่ครู import เข้าคลังแล้ว (มี source_question_id) เพราะข้อที่ยังไม่ติดแท็กไม่รู้หัวข้อย่อย
 * Quiz เก็บเวลารวมทั้งชุด จึงหารเฉลี่ยรายข้อ และ answer_changes ไม่มีข้อมูล = 0
 */
async function ingestQuizAttempt({ userId, questions, answers, timeTakenSec = 0 }) {
  try {
    const ids = questions.map(q => q.id);
    if (!ids.length) return { ingested: 0 };

    const items = await prisma.practiceItem.findMany({
      where: { source_question_id: { in: ids }, is_active: true },
    });
    if (!items.length) return { ingested: 0 };

    const avgSec = Math.max(0, Math.round((timeTakenSec || 0) / questions.length));
    let ingested = 0;
    for (const item of items) {
      const chosen = answers?.[item.source_question_id] ?? null;
      if (chosen === null || chosen === undefined) continue;   // ไม่ตอบ = ไม่นับ ไม่ให้เสีย mastery ฟรีๆ
      await recordAttempt({
        userId, item, chosen,
        timeSpentSec: avgSec, answerChanges: 0, hintUsed: false, skipped: false,
        source: 'quiz',
      });
      ingested++;
    }
    return { ingested };
  } catch (e) {
    console.error('[PRACTICE] ingest quiz:', e.message);
    return { ingested: 0, error: e.message };
  }
}

module.exports = { recordAttempt, refreshAccuracyWindow, ingestQuizAttempt, pct };
