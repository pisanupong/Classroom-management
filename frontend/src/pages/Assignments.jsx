import React, { useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const ROLE_LEVEL = { STUDENT: 0, PARENT: 0, STAFF: 1, CLASS_ADMIN: 1, TEACHER: 2, ADMIN: 3, SUPER_USER: 4 };

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const daysLeft = (due) => {
  const diff = new Date(due) - new Date();
  return Math.ceil(diff / 86400000);
};
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

/* ─── MISSION COMPLETE overlay ───────────────────────────────────────────── */
const MissionComplete = ({ score, maxScore }) => (
  <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center z-10 overflow-hidden"
    style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.92),rgba(5,150,105,0.95))', backdropFilter: 'blur(2px)' }}>
    {/* Scan lines */}
    <div className="absolute inset-0 opacity-10 pointer-events-none"
      style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.5) 2px,rgba(0,0,0,0.5) 4px)' }}/>
    <div className="relative text-center px-4">
      <div className="text-3xl mb-1">✅</div>
      <div className="font-extrabold tracking-widest uppercase"
        style={{ fontSize: 18, color: '#fff', letterSpacing: 4,
          textShadow: '0 0 16px rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
        ✅ ส่งแล้ว!
      </div>
      <div className="font-bold mt-1" style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', letterSpacing: 2 }}>
        MISSION COMPLETE
      </div>
      {score !== undefined && score !== null && (
        <div className="mt-2 px-3 py-1 rounded-full inline-block font-bold"
          style={{ background: 'rgba(255,255,255,0.25)', fontSize: 13, color: '#fff' }}>
          {score} / {maxScore} คะแนน
        </div>
      )}
    </div>
  </div>
);

/* ─── Urgent blink indicator ─────────────────────────────────────────────── */
const UrgentPill = ({ days, overdue }) => {
  if (overdue) return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold border animate-pulse"
      style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.5)',
        fontFamily: '"Press Start 2P",monospace', fontSize: 7 }}>
      ⚠ OVERDUE
    </span>
  );
  if (days <= 1) return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold border animate-pulse"
      style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.5)',
        fontFamily: '"Press Start 2P",monospace', fontSize: 7 }}>
      🔥 {days === 0 ? 'วันนี้!' : 'พรุ่งนี้!'}
    </span>
  );
  if (days <= 2) return (
    <span className="px-2.5 py-1 rounded-full text-xs font-bold border animate-pulse"
      style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d', borderColor: 'rgba(245,158,11,0.5)',
        fontFamily: '"Press Start 2P",monospace', fontSize: 7 }}>
      ⏰ {days} วัน!
    </span>
  );
  return (
    <span className="px-2.5 py-1 rounded-full text-xs border"
      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', borderColor: 'rgba(255,255,255,0.1)',
        fontFamily: '"Press Start 2P",monospace', fontSize: 7 }}>
      {days} วัน
    </span>
  );
};

/* ─── Submission Count Bar (ทั้ง teacher และ student เห็น) ──────────────── */
const SubmissionCountBar = ({ submissionCount, totalStudents }) => {
  const pct = totalStudents > 0 ? Math.round((submissionCount / totalStudents) * 100) : 0;
  const barColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>👥</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg,${barColor},${barColor}bb)` }}/>
      </div>
      <span style={{ fontFamily: '"Press Start 2P",monospace', fontSize: 7, color: barColor, whiteSpace: 'nowrap' }}>
        {submissionCount}/{totalStudents} คน
      </span>
    </div>
  );
};

/* ─── Submission Avatar Row (teacher full view) ───────────────────────────── */
const SubmitterRow = ({ submissions, totalStudents }) => {
  const pct = totalStudents > 0 ? Math.round((submissions.length / totalStudents) * 100) : 0;
  const barColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="mt-3">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg,${barColor},${barColor}cc)` }}/>
        </div>
        <span style={{ fontFamily: '"Press Start 2P",monospace', fontSize: 8, color: barColor }}>{pct}%</span>
      </div>
      {/* Avatars */}
      <div className="flex items-center gap-1 flex-wrap">
        {submissions.slice(0, 8).map((s, i) => (
          <div key={s.id} title={`${s.student?.name} ${s.status === 'GRADED' ? `(${s.score_given} คะแนน)` : '(รอตรวจ)'}`}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
            style={{
              background: `linear-gradient(135deg,${s.status === 'GRADED' ? '#10b981,#059669' : '#7c3aed,#6d28d9'})`,
              borderColor: s.status === 'GRADED' ? '#10b981' : '#7c3aed',
              color: '#fff', fontSize: 10,
            }}>
            {(s.student?.name || '?').charAt(0)}
          </div>
        ))}
        {submissions.length > 8 && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 9 }}>
            +{submissions.length - 8}
          </div>
        )}
        <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
          {submissions.length}/{totalStudents} คน
        </span>
      </div>
    </div>
  );
};

/* ─── Top Scorer Chip ─────────────────────────────────────────────────────── */
const TopScorerChip = ({ topScorer, maxScore }) => {
  if (!topScorer) return null;
  const pct = maxScore > 0 ? Math.round((topScorer.score / maxScore) * 100) : 0;
  const color = pct >= 90 ? '#fbbf24' : pct >= 70 ? '#34d399' : '#60a5fa';
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
      style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
      <span style={{ fontSize: 12 }}>🏅</span>
      <div className="min-w-0">
        <span style={{ fontFamily: '"Press Start 2P",monospace', fontSize: 7, color: 'rgba(255,255,255,0.5)' }}>
          TOP SCORE
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span style={{ fontSize: 11, color, fontWeight: 700 }}>{topScorer.score}</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>/{maxScore}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
            · {topScorer.name.split(' ')[0]}
          </span>
        </div>
      </div>
    </div>
  );
};

/* ─── Bonus Points Badge ──────────────────────────────────────────────────── */
const BonusBadge = ({ points }) => {
  if (!points || points <= 0) return null;
  return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-bold"
      style={{
        background: 'linear-gradient(135deg,rgba(251,191,36,0.2),rgba(245,158,11,0.15))',
        border: '1px solid rgba(251,191,36,0.5)',
        fontFamily: '"Press Start 2P",monospace', fontSize: 7, color: '#fbbf24',
        boxShadow: '0 0 8px rgba(251,191,36,0.2)',
        animation: 'bonusGlow 2s ease-in-out infinite',
      }}>
      ⭐ BONUS +{points}
    </span>
  );
};

/* ─── Not Started Badge ───────────────────────────────────────────────────── */
const NotStartedBadge = () => (
  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full font-bold"
    style={{
      background: 'rgba(99,102,241,0.2)',
      border: '1px solid rgba(99,102,241,0.5)',
      fontFamily: '"Press Start 2P",monospace', fontSize: 7, color: '#a5b4fc',
    }}>
    🆕 ยังไม่ได้เริ่ม
  </span>
);

/* ─── Assignment Mission Card ────────────────────────────────────────────── */
const MissionCard = ({ assignment, userRole, userId, onClick }) => {
  const isTeacher = ROLE_LEVEL[userRole] >= ROLE_LEVEL['CLASS_ADMIN'];
  const days      = daysLeft(assignment.due_date);
  const overdue   = days < 0;

  // Student status
  const mySubmission = !isTeacher ? assignment.submissions?.[0] : null;
  const submitted    = !!mySubmission;
  const graded       = mySubmission?.status === 'GRADED';
  const notSubmitted = !submitted;
  const urgentBlink  = notSubmitted && (days <= 2 || overdue);

  // Shared meta
  const totalStud      = assignment.totalStudents || 0;
  const submissionCount = assignment.submissionCount ?? (isTeacher ? assignment.submissions?.length : 0);
  const hasBonus       = (assignment.bonus_points || 0) > 0;
  const topScorer      = assignment.topScorer || null;

  // Card border
  const borderColor = submitted
    ? 'rgba(16,185,129,0.4)'
    : hasBonus ? 'rgba(251,191,36,0.35)'
    : overdue ? 'rgba(239,68,68,0.5)'
    : days <= 2 ? 'rgba(245,158,11,0.5)'
    : 'rgba(255,255,255,0.08)';

  const cardGlow = submitted
    ? 'rgba(16,185,129,0.06)'
    : hasBonus ? 'rgba(251,191,36,0.04)'
    : overdue && notSubmitted ? 'rgba(239,68,68,0.06)'
    : days <= 2 && notSubmitted ? 'rgba(245,158,11,0.05)'
    : 'rgba(255,255,255,0.04)';

  return (
    <div onClick={onClick} className="relative cursor-pointer group"
      style={{ animation: urgentBlink ? 'urgentGlow 1.5s ease-in-out infinite' : 'none' }}>
      <div className="relative rounded-2xl border overflow-hidden transition-all duration-300 group-hover:scale-[1.015] group-hover:shadow-2xl"
        style={{ background: cardGlow, backdropFilter: 'blur(14px)', borderColor }}>

        {/* Completed overlay */}
        {submitted && <MissionComplete score={graded ? mySubmission.score_given : undefined} maxScore={assignment.max_score}/>}

        {/* Content */}
        <div className={`p-5 ${submitted ? 'opacity-0 pointer-events-none' : ''}`}>

          {/* ── Header row ── */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">

              {/* Badge row */}
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs font-bold tracking-widest uppercase"
                  style={{ color: '#8b5cf6', letterSpacing: 3, fontSize: 10 }}>
                  📋 MISSION
                </span>
                {/* 1. ยังไม่ได้เริ่ม (student only) */}
                {!isTeacher && notSubmitted && !overdue && <NotStartedBadge />}
                {/* 3. Bonus badge */}
                {hasBonus && <BonusBadge points={assignment.bonus_points}/>}
                <UrgentPill days={days} overdue={overdue}/>
              </div>

              {/* Title */}
              <h3 className="font-bold text-white leading-snug"
                style={{ fontSize: 16, fontFamily: 'system-ui, sans-serif' }}>
                {assignment.title}
              </h3>
              {assignment.description && (
                <p className="text-sm mt-1.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                  {assignment.description}
                </p>
              )}
            </div>

            {/* Score badge */}
            <div className="flex-shrink-0 text-center px-3 py-2 rounded-xl border"
              style={{ background: 'rgba(124,58,237,0.15)', borderColor: 'rgba(124,58,237,0.3)' }}>
              <p className="text-xl font-bold" style={{ color: '#a78bfa' }}>{assignment.max_score}</p>
              {hasBonus && (
                <p className="text-xs font-bold mt-0.5" style={{ color: '#fbbf24', fontSize: 9 }}>
                  +{assignment.bonus_points}⭐
                </p>
              )}
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>คะแนน</p>
            </div>
          </div>

          {/* ── Teacher info row ── */}
          <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff' }}>
              {(assignment.teacher?.name || 'T').charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>
                {assignment.teacher?.name || '—'}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>ผู้มอบหมาย</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium"
                style={{ color: overdue ? '#f87171' : days <= 2 ? '#fcd34d' : 'rgba(255,255,255,0.5)' }}>
                ⏰ {fmtDate(assignment.due_date)}
              </p>
            </div>
          </div>

          {/* ── 2. จำนวนคนส่ง (ทุก role เห็น) ── */}
          <div className="mb-3">
            <SubmissionCountBar submissionCount={submissionCount} totalStudents={totalStud}/>
          </div>

          {/* ── Teacher: avatar row ── */}
          {isTeacher && (
            <SubmitterRow submissions={assignment.submissions || []} totalStudents={totalStud}/>
          )}

          {/* ── 4. Top Scorer + Student status row ── */}
          <div className="flex items-center justify-between gap-2 flex-wrap mt-2">
            {/* Top scorer chip */}
            <TopScorerChip topScorer={topScorer} maxScore={assignment.max_score}/>

            {/* Student status */}
            {!isTeacher && (
              <div className="flex items-center gap-2 ml-auto">
                <div className="w-2 h-2 rounded-full"
                  style={{ background: notSubmitted ? (overdue ? '#ef4444' : '#f59e0b') : '#10b981' }}/>
                <span className="text-xs font-semibold"
                  style={{ color: notSubmitted ? (overdue ? '#fca5a5' : '#fcd34d') : '#6ee7b7', fontSize: 11 }}>
                  {notSubmitted ? (overdue ? '⚠ เกินกำหนดแล้ว' : 'ยังไม่ส่ง') : 'ส่งแล้ว — รอตรวจ'}
                </span>
              </div>
            )}

            {/* Teacher: tap hint */}
            {isTeacher && (
              <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
                กดดูรายละเอียด →
              </span>
            )}
          </div>
        </div>

        {/* Hover glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: submitted ? 'linear-gradient(90deg,transparent,#10b981,transparent)' : hasBonus ? 'linear-gradient(90deg,transparent,#fbbf24,transparent)' : 'linear-gradient(90deg,transparent,#7c3aed,transparent)' }}/>
      </div>
    </div>
  );
};

/* ─── Stats bar (top of page) ────────────────────────────────────────────── */
const StatsBar = ({ assignments, userRole, userId }) => {
  const isTeacher = ROLE_LEVEL[userRole] >= ROLE_LEVEL['CLASS_ADMIN'];
  if (isTeacher) {
    const total   = assignments.length;
    const active  = assignments.filter(a => daysLeft(a.due_date) >= 0).length;
    const overdue = assignments.filter(a => daysLeft(a.due_date) < 0).length;
    return (
      <div className="flex gap-4 flex-wrap mb-6">
        {[
          { label: 'ทั้งหมด', value: total, color: '#a78bfa', icon: '📋' },
          { label: 'กำลังดำเนินการ', value: active, color: '#34d399', icon: '⚡' },
          { label: 'เกินกำหนด', value: overdue, color: '#f87171', icon: '⚠' },
        ].map(s => (
          <div key={s.label} className="px-4 py-2.5 rounded-xl border flex items-center gap-2"
            style={{ background: `${s.color}12`, borderColor: `${s.color}30` }}>
            <span>{s.icon}</span>
            <div>
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }
  // Student stats
  const submitted = assignments.filter(a => a.submissions?.length > 0).length;
  const total     = assignments.length;
  const xp        = assignments.filter(a => a.submissions?.[0]?.status === 'GRADED')
                              .reduce((s, a) => s + (a.submissions[0].score_given || 0), 0);
  const pct = total > 0 ? Math.round(submitted / total * 100) : 0;
  return (
    <div className="flex gap-3 flex-wrap mb-6">
      {[
        { label: 'งานทั้งหมด', value: `${submitted}/${total}`, color: '#a78bfa', icon: '📋' },
        { label: 'ส่งแล้ว', value: `${pct}%`, color: pct === 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444', icon: '⚡' },
        { label: 'คะแนนที่ได้', value: `${xp} pts`, color: '#fbbf24', icon: '🏆' },
      ].map(s => (
        <div key={s.label} className="px-4 py-2.5 rounded-xl border flex items-center gap-2"
          style={{ background: `${s.color}12`, borderColor: `${s.color}30` }}>
          <span>{s.icon}</span>
          <div>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── Main Page ──────────────────────────────────────────────────────────── */
const Assignments = () => {
  const { user }  = useContext(AuthContext);
  const navigate  = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('all'); // all | pending | done | urgent
  const isTeacher = ROLE_LEVEL[user?.role] >= ROLE_LEVEL['CLASS_ADMIN'];

  useEffect(() => {
    api.get('/assignments')
      .then(r => setAssignments(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Filter logic
  const filtered = assignments.filter(a => {
    if (filter === 'all') return true;
    const sub     = a.submissions?.[0];
    const days    = daysLeft(a.due_date);
    const overdue = days < 0;
    if (filter === 'pending') return !sub;
    if (filter === 'done')    return !!sub;
    if (filter === 'urgent')  return !sub && (days <= 2 || overdue);
    return true;
  });

  const urgentCount = assignments.filter(a => {
    const days = daysLeft(a.due_date);
    return !a.submissions?.[0] && (days <= 2 || days < 0);
  }).length;

  return (
    <div className="min-h-screen text-white"
      style={{ background: 'linear-gradient(135deg,#0a0018 0%,#0f0c29 35%,#0a1628 70%,#000d1a 100%)' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        @keyframes urgentGlow {
          0%,100% { box-shadow: 0 0 0px rgba(239,68,68,0); }
          50% { box-shadow: 0 0 18px rgba(239,68,68,0.35), 0 0 36px rgba(239,68,68,0.1); }
        }
        @keyframes bonusGlow {
          0%,100% { box-shadow: 0 0 0px rgba(251,191,36,0); }
          50% { box-shadow: 0 0 10px rgba(251,191,36,0.4), 0 0 20px rgba(251,191,36,0.15); }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>

      {/* Ambient glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none opacity-8"
        style={{ background: 'radial-gradient(circle,#7c3aed,transparent)', filter: 'blur(100px)' }}/>
      <div className="fixed bottom-0 right-1/4 w-80 h-80 rounded-full pointer-events-none opacity-8"
        style={{ background: 'radial-gradient(circle,#0ea5e9,transparent)', filter: 'blur(80px)' }}/>

      {/* ── Navbar ── */}
      <nav className="px-6 py-3 flex items-center justify-between border-b sticky top-0 z-30"
        style={{ background: 'rgba(10,0,24,0.85)', backdropFilter: 'blur(16px)', borderColor: 'rgba(124,58,237,0.2)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')}
            className="text-white/40 hover:text-white transition-colors">
            ←
          </button>
          <div>
            <h1 className="font-bold text-lg" style={{ color: '#a78bfa' }}>
              📋 กระดาน Mission
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {isTeacher ? 'ตรวจสอบการส่งงาน' : 'เลือก mission ที่จะทำ'}
            </p>
          </div>
        </div>
        {ROLE_LEVEL[user?.role] >= ROLE_LEVEL['TEACHER'] && (
          <button onClick={() => navigate('/assignments/create')}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
            + สร้างการบ้าน
          </button>
        )}
      </nav>

      {/* ── Filter tabs ── */}
      {!isTeacher && (
        <div className="border-b" style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="max-w-4xl mx-auto px-6 flex gap-1 py-2">
            {[
              { id: 'all',    label: '📋 ทั้งหมด',      count: assignments.length },
              { id: 'pending',label: '⏳ ยังไม่ส่ง',    count: assignments.filter(a => !a.submissions?.[0]).length },
              { id: 'done',   label: '✅ ส่งแล้ว',      count: assignments.filter(a => a.submissions?.[0]).length },
              { id: 'urgent', label: '🔥 ด่วน!',        count: urgentCount, alert: urgentCount > 0 },
            ].map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${filter === f.id ? '' : 'hover:bg-white/5'}`}
                style={{
                  background: filter === f.id ? (f.alert ? 'rgba(239,68,68,0.2)' : 'rgba(124,58,237,0.25)') : 'transparent',
                  color: filter === f.id ? (f.alert ? '#fca5a5' : '#c4b5fd') : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${filter === f.id ? (f.alert ? 'rgba(239,68,68,0.4)' : 'rgba(124,58,237,0.4)') : 'transparent'}`,
                  animation: f.alert && f.count > 0 ? 'urgentGlow 1.5s infinite' : 'none',
                }}>
                {f.label}
                <span className="px-1.5 py-0.5 rounded-full text-xs"
                  style={{ background: 'rgba(255,255,255,0.1)', fontSize: 7 }}>{f.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <main className="max-w-4xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="text-lg font-bold animate-pulse" style={{ color: '#7c3aed' }}>กำลังโหลด...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <span className="text-5xl">📭</span>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {filter === 'done' ? 'ยังไม่มีงานที่ส่ง' : filter === 'urgent' ? 'ไม่มีงานด่วน 🎉' : 'ยังไม่มีการบ้าน'}
            </p>
            {ROLE_LEVEL[user?.role] >= ROLE_LEVEL['TEACHER'] && (
              <button onClick={() => navigate('/assignments/create')}
                className="px-5 py-2 rounded-xl text-white text-sm font-semibold mt-2"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                + สร้างการบ้าน
              </button>
            )}
          </div>
        ) : (
          <>
            <StatsBar assignments={assignments} userRole={user?.role} userId={user?.id}/>
            <div className="space-y-4">
              {filtered.map(a => (
                <MissionCard
                  key={a.id}
                  assignment={a}
                  userRole={user?.role}
                  userId={user?.id}
                  onClick={() => navigate(`/assignments/${a.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Assignments;
