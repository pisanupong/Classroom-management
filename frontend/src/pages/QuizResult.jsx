import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';

const QuizResult = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(location.state?.result || null);
  const [quiz, setQuiz] = useState(location.state?.quiz || null);
  const [attempts, setAttempts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tab, setTab] = useState('result');
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [attRes, lbRes] = await Promise.all([
          api.get(`/quiz/${id}/my-attempts`),
          api.get(`/quiz/${id}/leaderboard`),
        ]);
        setAttempts(attRes.data);
        setLeaderboard(lbRes.data);
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchAll();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f0c29, #1a1a2e)' }}>
      <p className="text-white/40">กำลังโหลด...</p>
    </div>
  );

  const pct = data ? Math.round((data.correct / data.total) * 100) : 0;
  const grade = pct >= 80 ? { label:'ยอดเยี่ยม!', color:'#10b981', emoji:'🎉' }
    : pct >= 60 ? { label:'ดีมาก', color:'#7c3aed', emoji:'👍' }
    : pct >= 40 ? { label:'พอใช้', color:'#f59e0b', emoji:'💪' }
    : { label:'ต้องฝึกเพิ่ม', color:'#ef4444', emoji:'📚' };

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)' }}>
      <nav className="px-6 py-4 flex items-center gap-3 border-b border-white/10 sticky top-0 z-10" style={{ background: 'rgba(15,12,41,0.9)', backdropFilter: 'blur(10px)' }}>
        <button onClick={() => navigate('/quiz')} className="text-white/60 hover:text-white text-sm">← แบบฝึกหัด</button>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-2xl border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {[['result','📊 ผลลัพธ์'],['history','📋 ประวัติ'],['ranking','🏆 อันดับ']].map(([t,l]) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: tab === t ? 'rgba(124,58,237,0.4)' : 'transparent', color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)' }}>
              {l}
            </button>
          ))}
        </div>

        {/* ── Result tab ── */}
        {tab === 'result' && data && (
          <div className="space-y-5">
            {/* Score card */}
            <div className="rounded-2xl p-6 border text-center" style={{ background: `${grade.color}15`, borderColor: `${grade.color}40` }}>
              <p className="text-5xl mb-2">{grade.emoji}</p>
              <p className="text-3xl font-bold" style={{ color: grade.color }}>{data.score} แต้ม</p>
              <p className="text-white/50 text-sm mt-1">{grade.label} — {data.correct}/{data.total} ข้อถูก ({pct}%)</p>
              {/* Circle progress */}
              <div className="flex justify-center mt-4">
                <svg viewBox="0 0 80 80" style={{ width: 80, height: 80 }}>
                  <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"/>
                  <circle cx="40" cy="40" r="32" fill="none" stroke={grade.color} strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 32 * pct / 100} ${2 * Math.PI * 32}`}
                    strokeLinecap="round" transform="rotate(-90 40 40)" style={{ transition: 'stroke-dasharray 1s ease' }}/>
                  <text x="40" y="45" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{pct}%</text>
                </svg>
              </div>
              {data.time_taken > 0 && <p className="text-white/30 text-xs mt-2">⏱ ใช้เวลา {Math.floor(data.time_taken/60)}:{String(data.time_taken%60).padStart(2,'0')} นาที</p>}
            </div>

            {/* Answer review */}
            <div className="space-y-3">
              <h3 className="font-semibold text-white">เฉลยคำตอบ</h3>
              {data.result.map((r, i) => (
                <div key={r.id} className="rounded-2xl p-4 border" style={{
                  background: r.isCorrect ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                  borderColor: r.isCorrect ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                }}>
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">{r.isCorrect ? '✅' : '❌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white mb-2">ข้อ {i+1}: {r.question_text}</p>
                      {!r.isCorrect && r.chosen && (
                        <p className="text-xs text-red-300 mb-1">คำตอบของคุณ: {r.chosen}</p>
                      )}
                      {!r.isCorrect && !r.chosen && (
                        <p className="text-xs text-gray-400 mb-1">ไม่ได้ตอบ</p>
                      )}
                      <p className="text-xs text-emerald-300">✓ คำตอบที่ถูก: {r.correct_answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── History tab ── */}
        {tab === 'history' && (
          <div className="space-y-3">
            {!attempts.length ? (
              <p className="text-center text-white/30 py-8">ยังไม่มีประวัติ</p>
            ) : attempts.map((a, i) => (
              <div key={a.id} className="rounded-2xl p-4 border border-white/10" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">ครั้งที่ {attempts.length - i} — {a.correct}/{a.total_q} ข้อถูก</p>
                    <p className="text-xs text-white/30 mt-1">
                      {new Date(a.completed_at).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      {a.time_taken > 0 && ` · ${Math.floor(a.time_taken/60)}:${String(a.time_taken%60).padStart(2,'0')} นาที`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-emerald-400">{a.score}</p>
                    <p className="text-xs text-white/30">แต้ม</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Ranking tab ── */}
        {tab === 'ranking' && (
          <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="px-5 py-3 border-b border-white/10 bg-white/5">
              <p className="text-sm font-semibold text-white">🏆 อันดับในแบบฝึกหัดนี้</p>
            </div>
            {!leaderboard.length ? (
              <p className="text-center text-white/30 py-8 text-sm">ยังไม่มีข้อมูล</p>
            ) : leaderboard.map((a, i) => {
              const medals = ['🥇','🥈','🥉'];
              return (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                  <span className="w-6 text-center">{medals[i] || <span className="text-white/30 text-sm">{i+1}</span>}</span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(124,58,237,0.3)' }}>
                    {a.student?.name?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{a.student?.name}</p>
                    <p className="text-xs text-white/30">{a.correct}/{a.total_q} ข้อถูก · {Math.floor(a.time_taken/60)}:{String(a.time_taken%60).padStart(2,'0')} นาที</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-400">{a.score}</p>
                    <p className="text-xs text-white/30">แต้ม</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={() => navigate('/quiz')} className="w-full mt-6 py-3 rounded-2xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
          ← กลับไปหน้าแบบฝึกหัด
        </button>
      </main>
    </div>
  );
};
export default QuizResult;
