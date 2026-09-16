/*
 * อัลกอริทึมวิเคราะห์การเรียนรู้ — ฟังก์ชันบริสุทธิ์ ไม่แตะ DB
 *   - Elo Rating       : ความสามารถผู้เรียน vs ความยากข้อสอบ (อัปเดตทุกข้อ)
 *   - SM-2             : เว้นระยะทบทวน (Spaced Repetition)
 *   - BKT              : โอกาสที่ผู้เรียน "เข้าใจแล้วจริง"
 *   - Item Analysis    : ค่าความยาก p และอำนาจจำแนก d
 */

/* ═════════ Bloom's Taxonomy ═════════ */
const BLOOM_LEVELS = [
  { key: 'remember',   order: 1, label: 'จำได้',       icon: '🧠', color: '#38bdf8' },
  { key: 'understand', order: 2, label: 'เข้าใจ',      icon: '💡', color: '#4ade80' },
  { key: 'apply',      order: 3, label: 'ประยุกต์ใช้', icon: '🔧', color: '#fbbf24' },
  { key: 'analyze',    order: 4, label: 'วิเคราะห์',   icon: '🔍', color: '#fb923c' },
  { key: 'evaluate',   order: 5, label: 'ประเมินค่า',  icon: '⚖️', color: '#f87171' },
  { key: 'create',     order: 6, label: 'สร้างสรรค์',  icon: '✨', color: '#a78bfa' },
];
const BLOOM_KEYS = BLOOM_LEVELS.map(b => b.key);

/* ═════════ ระดับความชำนาญ ═════════ */
const MASTERY_LEVELS = [
  { key: 'new',        label: 'ยังไม่เริ่ม',   icon: '⚪', color: '#94a3b8' },
  { key: 'learning',   label: 'เริ่มเรียนรู้', icon: '🔴', color: '#f87171' },
  { key: 'developing', label: 'กำลังพัฒนา',   icon: '🟠', color: '#fb923c' },
  { key: 'proficient', label: 'ชำนาญ',        icon: '🟡', color: '#fbbf24' },
  { key: 'mastered',   label: 'เชี่ยวชาญ',    icon: '🟢', color: '#4ade80' },
];

/* ═════════ 1. Elo Rating ═════════ */
// K สูงตอนเริ่ม (rating ยังไม่นิ่ง) แล้วลดลงเมื่อมีข้อมูลมากขึ้น
const kFactor = (attempts) => (attempts < 10 ? 40 : attempts < 30 ? 28 : 18);

// คาดการณ์โอกาสตอบถูก จากส่วนต่าง rating
const expectedScore = (learnerElo, itemElo) => 1 / (1 + Math.pow(10, (itemElo - learnerElo) / 400));

/**
 * อัปเดต Elo ทั้งผู้เรียนและข้อสอบพร้อมกัน (zero-sum)
 * ตอบข้อยากกว่าตัวเองถูก → rating พุ่งขึ้นมาก / ตอบข้อง่ายกว่าตัวเองผิด → ลดลงมาก
 */
function eloUpdate({ learnerElo, itemElo, isCorrect, learnerAttempts = 0, itemAttempts = 0 }) {
  const expected = expectedScore(learnerElo, itemElo);
  const actual = isCorrect ? 1 : 0;
  const kL = kFactor(learnerAttempts);
  const kI = kFactor(itemAttempts) * 0.5;   // ข้อสอบขยับช้ากว่าคน เพราะถูกวัดจากหลายคน
  return {
    learnerElo: Math.round((learnerElo + kL * (actual - expected)) * 10) / 10,
    itemElo:    Math.round((itemElo    - kI * (actual - expected)) * 10) / 10,
    expected:   Math.round(expected * 100) / 100,
    // เซอร์ไพรส์: ตอบผิดข้อที่ควรทำได้ = สัญญาณความสะเพร่า/ความรู้ถดถอย
    surprise:   Math.round(Math.abs(actual - expected) * 100) / 100,
  };
}

/* ═════════ 2. Quality Grade (q 0–5) ═════════ */
/**
 * แปลงพฤติกรรมการตอบเป็นคะแนนคุณภาพ q สำหรับ SM-2
 *   5 = ถูก เร็ว มั่นใจ | 4 = ถูก ใช้เวลาพอสมควร | 3 = ถูกแต่ลังเล/ใช้คำใบ้
 *   2 = ผิดแบบเกือบได้  | 1 = ผิด | 0 = ข้าม/ไม่รู้เลย
 * expectedSec = เวลาที่ควรใช้ ประมาณจากความยากของข้อ
 */
function gradeQuality({ isCorrect, timeSpentSec, expectedSec = 45, hintUsed = false, answerChanges = 0, skipped = false }) {
  if (skipped) return 0;
  if (!isCorrect) {
    // ตอบผิดแต่ตั้งใจทำ (ใช้เวลา เปลี่ยนคำตอบ) = เกือบได้ ให้ 2 ; ผิดแบบรีบกด = 1
    return (timeSpentSec >= expectedSec * 0.5 || answerChanges > 0) ? 2 : 1;
  }
  if (hintUsed) return 3;                              // ถูกเพราะคำใบ้ ยังไม่ถือว่าชำนาญ
  const ratio = timeSpentSec / Math.max(1, expectedSec);
  if (ratio <= 0.6 && answerChanges === 0) return 5;   // เร็วและไม่เปลี่ยนใจ
  if (ratio <= 1.5) return 4;
  return 3;                                            // ถูกแต่ช้ามาก
}

/* ═════════ 3. SM-2 Spaced Repetition ═════════ */
const EF_MIN = 1.3;
/**
 * คำนวณ EF และ interval รอบถัดไป
 *   EF' = EF + (0.1 − (5−q) × (0.08 + (5−q) × 0.02))   , ต่ำสุด 1.3
 *   ตอบถูก (q≥3): n=0→1วัน, n=1→6วัน, n>1→I×EF'
 *   ตอบผิด (q<3): reset n=0, I=1
 */
function sm2({ q, reps = 0, ef = 2.5, intervalDays = 0, now = new Date() }) {
  const d = 5 - q;
  let newEf = ef + (0.1 - d * (0.08 + d * 0.02));
  if (newEf < EF_MIN) newEf = EF_MIN;

  let newReps, newInterval;
  if (q >= 3) {
    if (reps === 0)      newInterval = 1;
    else if (reps === 1) newInterval = 6;
    else                 newInterval = Math.max(1, Math.round(intervalDays * newEf));
    newReps = reps + 1;
  } else {
    newReps = 0;
    newInterval = 1;   // นำกลับมาทบทวนพรุ่งนี้ทันที
  }

  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + newInterval);

  return { ef: Math.round(newEf * 100) / 100, reps: newReps, intervalDays: newInterval, nextReviewDate: next };
}

/* ═════════ 4. Bayesian Knowledge Tracing ═════════ */
const BKT = { P_INIT: 0.15, P_TRANSIT: 0.12, P_SLIP: 0.10, P_GUESS: 0.25 };
/**
 * อัปเดตโอกาสที่ผู้เรียนเข้าใจหัวข้อนี้แล้วจริง
 *   posterior = P(L|obs) จาก slip/guess  →  P(L') = posterior + (1−posterior)×P(T)
 * ถ้าใช้คำใบ้ ให้ถือว่าโอกาสเดาถูกสูงขึ้น (คำใบ้ช่วยตอบ ไม่ใช่ความเข้าใจ)
 */
function bktUpdate({ pKnown = BKT.P_INIT, isCorrect, hintUsed = false }) {
  const pGuess = hintUsed ? Math.min(0.6, BKT.P_GUESS * 2) : BKT.P_GUESS;
  const pL = Math.min(0.999, Math.max(0.001, pKnown));

  const posterior = isCorrect
    ? (pL * (1 - BKT.P_SLIP)) / (pL * (1 - BKT.P_SLIP) + (1 - pL) * pGuess)
    : (pL * BKT.P_SLIP)       / (pL * BKT.P_SLIP       + (1 - pL) * (1 - pGuess));

  const next = posterior + (1 - posterior) * BKT.P_TRANSIT;
  return Math.round(Math.min(0.999, Math.max(0.001, next)) * 1000) / 1000;
}

/* ═════════ 5. ระดับความชำนาญ ═════════ */
/**
 * รวม p_known (BKT) + ตอบถูกติดกัน + จำนวนครั้ง เป็นสถานะที่อ่านเข้าใจง่าย
 * ต้องทำอย่างน้อย 3 ครั้งจึงจะเลื่อนขั้นได้ กันการเดาถูกครั้งเดียวแล้วขึ้น "เชี่ยวชาญ"
 */
function masteryStatus({ pKnown, streak, totalAttempts }) {
  if (totalAttempts === 0) return 'new';
  if (totalAttempts < 3)   return 'learning';
  if (pKnown >= 0.95 && streak >= 4) return 'mastered';
  if (pKnown >= 0.85 && streak >= 2) return 'proficient';
  if (pKnown >= 0.60)                return 'developing';
  return 'learning';
}

/* ═════════ 6. Item Analysis (คุณภาพข้อสอบ) ═════════ */
/**
 * p = ค่าความยาก (สัดส่วนตอบถูก) ยิ่งสูงยิ่งง่าย — เหมาะสมช่วง 0.3–0.8
 * d = อำนาจจำแนก เทียบกลุ่มเก่งสุด 27% กับอ่อนสุด 27% — ควร ≥ 0.2
 * รับ rows = [{ userScore, isCorrect }] (1 แถว = 1 การตอบข้อนี้ ของ 1 คน)
 */
function itemAnalysis(rows) {
  const n = rows.length;
  if (n === 0) return { p: null, d: null, n: 0, quality: 'no_data' };

  const p = rows.filter(r => r.isCorrect).length / n;

  let d = null;
  if (n >= 10) {
    const sorted = [...rows].sort((a, b) => b.userScore - a.userScore);
    const g = Math.max(1, Math.round(n * 0.27));
    const high = sorted.slice(0, g);
    const low  = sorted.slice(-g);
    d = (high.filter(r => r.isCorrect).length / g) - (low.filter(r => r.isCorrect).length / g);
    d = Math.round(d * 100) / 100;
  }

  let quality = 'ok';
  if (n < 10)                    quality = 'insufficient';   // ข้อมูลยังน้อย ตัดสินไม่ได้
  else if (p > 0.95)             quality = 'too_easy';
  else if (p < 0.20)             quality = 'too_hard';
  else if (d !== null && d < 0)  quality = 'reversed';       // คนเก่งตอบผิดมากกว่าคนอ่อน → ข้อน่าจะกำกวม/เฉลยผิด
  else if (d !== null && d < 0.2) quality = 'weak';

  return { p: Math.round(p * 100) / 100, d, n, quality };
}

const ITEM_QUALITY_LABEL = {
  no_data:      { label: 'ยังไม่มีข้อมูล',            color: '#94a3b8' },
  insufficient: { label: 'ข้อมูลยังน้อย (<10 ครั้ง)', color: '#94a3b8' },
  ok:           { label: 'ใช้ได้ดี',                  color: '#4ade80' },
  too_easy:     { label: 'ง่ายเกินไป',                color: '#38bdf8' },
  too_hard:     { label: 'ยากเกินไป',                 color: '#fb923c' },
  weak:         { label: 'จำแนกคนเก่ง-อ่อนได้น้อย',   color: '#fbbf24' },
  reversed:     { label: 'ผิดปกติ — ควรตรวจเฉลย',    color: '#f87171' },
};

/* ═════════ 7. เวลาที่ควรใช้ต่อข้อ (จากความยาก) ═════════ */
// ข้อ Elo 1200 ≈ 40 วิ ; ยากขึ้น 400 แต้ม ให้เวลาเพิ่มเท่าตัว
const expectedSecForItem = (itemElo = 1200, bloom = 'understand') => {
  const base = 40 * Math.pow(2, (itemElo - 1200) / 400);
  const bloomOrder = (BLOOM_LEVELS.find(b => b.key === bloom)?.order) || 2;
  return Math.round(Math.min(300, Math.max(12, base * (1 + (bloomOrder - 2) * 0.2))));
};

/* ═════════ 8. Fluency & Decay ═════════ */
// ความคล่องแคล่ว: เวลาที่ใช้ลดลงกี่ % เทียบช่วงแรกกับช่วงล่าสุด (เฉพาะข้อที่ตอบถูก)
function fluencyTrend(correctTimes) {
  if (correctTimes.length < 6) return null;
  const half = Math.floor(correctTimes.length / 2);
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const early = avg(correctTimes.slice(0, half));
  const late  = avg(correctTimes.slice(-half));
  if (!early) return null;
  return Math.round(((early - late) / early) * 100);   // + = เร็วขึ้น (ดี)
}

/**
 * อัตราการลืม: หัวข้อที่เคยถึง proficient/mastered แล้ว แต่ผลช่วงหลังตกลง
 * และเลยกำหนดทบทวนมานาน → ควรถูกดึงกลับมาซ่อม
 */
function decayRisk({ masteryStatus: status, recentAccuracy, firstAccuracy, nextReviewDate, now = new Date() }) {
  const overdueDays = nextReviewDate
    ? Math.floor((now - new Date(nextReviewDate)) / 86400000)
    : 0;
  const dropped = recentAccuracy != null && firstAccuracy != null && recentAccuracy < firstAccuracy - 15;
  const wasStrong = status === 'proficient' || status === 'mastered';

  let level = 'none';
  if (wasStrong && (dropped || overdueDays > 14)) level = 'high';
  else if (overdueDays > 7 || dropped)            level = 'medium';
  else if (overdueDays > 0)                       level = 'low';
  return { level, overdueDays: Math.max(0, overdueDays), dropped: !!dropped };
}

module.exports = {
  BLOOM_LEVELS, BLOOM_KEYS, MASTERY_LEVELS, ITEM_QUALITY_LABEL, BKT,
  kFactor, expectedScore, eloUpdate,
  gradeQuality, sm2, bktUpdate, masteryStatus,
  itemAnalysis, expectedSecForItem, fluencyTrend, decayRisk,
};
