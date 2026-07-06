import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const fmtTime = (s) => s >= 60 ? `${Math.floor(s/60)} นาที` : `${s} วินาที`;

const QuizList = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isTeacher = ['TEACHER','ADMIN','SUPER_USER'].includes(user?.role);
  const isLearner = ['STUDENT','CLASS_ADMIN','PARENT','STAFF'].includes(user?.role);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try { const r = await api.get('/quiz'); setQuizzes(r.data); }
    catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const handleToggle = async (id) => {
    await api.put(`/quiz/${id}/toggle`);
    fetch();
  };
  const handleDelete = async (id) => {
    if (!confirm('ลบแบบฝึกหัดนี้?')) return;
    await api.delete(`/quiz/${id}`);
    fetch();
  };

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <div className="fixed top-0 left-0 w-96 h-96 rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(80px)' }} />

      <nav className="px-6 py-4 flex justify-between items-center border-b border-white/10 sticky top-0 z-20" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-white/60 hover:text-white text-sm transition-colors">← Dashboard</button>
          <span className="text-white/30">|</span>
          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">🎯 แบบฝึกหัด</h1>
        </div>
        {isTeacher && (
          <button onClick={() => navigate('/quiz/create')}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white hover:scale-105 transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>
            + สร้างแบบฝึกหัด
          </button>
        )}
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {loading ? <p className="text-center text-white/30 py-12">กำลังโหลด...</p>
          : quizzes.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-3">📭</p>
              <p className="text-white/40">ยังไม่มีแบบฝึกหัด</p>
            </div>
          ) : quizzes.map(q => {
            const myAttempts = q.attempts || [];
            const bestScore = myAttempts.length ? Math.max(...myAttempts.map(a => a.score)) : null;
            const attemptsLeft = q.max_attempts === 0 ? '∞' : q.max_attempts - myAttempts.length;
            const canTake = isLearner && (q.max_attempts === 0 || myAttempts.length < q.max_attempts);

            return (
              <div key={q.id} className="rounded-2xl p-5 border border-white/10 transition-all hover:border-white/20"
                style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-white">{q.title}</h3>
                      {!q.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">ปิดอยู่</span>}
                    </div>
                    {q.description && <p className="text-sm text-white/50 mb-3">{q.description}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-white/40">
                      <span>📝 {q._count.questions} ข้อ</span>
                      <span>⏱ {q.time_limit ? fmtTime(q.time_limit) : 'ไม่จำกัด'}</span>
                      <span>🏆 {q.points_per_q} แต้ม/ข้อ</span>
                      <span>🔁 {q.max_attempts === 0 ? 'ไม่จำกัด' : `${q.max_attempts} ครั้ง`}</span>
                      {isTeacher && <span>👥 {q._count.attempts} attempts</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {isLearner && bestScore !== null && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-400">{bestScore} <span className="text-xs text-white/30">pt</span></p>
                        <p className="text-xs text-white/30">คะแนนสูงสุด</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {isTeacher ? (
                        <>
                          <button onClick={() => navigate(`/quiz/${q.id}/leaderboard`)}
                            className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-white/60 hover:text-white transition-all">
                            📊 อันดับ
                          </button>
                          <button onClick={() => navigate(`/quiz/${q.id}/edit`)}
                            className="px-3 py-1.5 rounded-lg text-xs border border-blue-500/20 text-blue-400/70 hover:text-blue-300 transition-all">
                            ✏️ แก้ไข
                          </button>
                          <button onClick={() => handleToggle(q.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${q.is_active ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10' : 'border-green-500/30 text-green-400 hover:bg-green-500/10'}`}>
                            {q.is_active ? '⏸ ปิด' : '▶ เปิด'}
                          </button>
                          <button onClick={() => handleDelete(q.id)}
                            className="px-3 py-1.5 rounded-lg text-xs border border-red-500/20 text-red-400/60 hover:text-red-400 transition-all">
                            🗑️
                          </button>
                        </>
                      ) : (
                        <>
                          {myAttempts.length > 0 && (
                            <button onClick={() => navigate(`/quiz/${q.id}/result`)}
                              className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-white/50 hover:text-white transition-all">
                              📋 ผลย้อนหลัง
                            </button>
                          )}
                          {canTake ? (
                            <button onClick={() => navigate(`/quiz/${q.id}/take`)}
                              className="px-4 py-1.5 rounded-lg text-xs font-medium text-white hover:scale-105 transition-all"
                              style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>
                              {myAttempts.length > 0 ? `ทำอีกครั้ง (เหลือ ${attemptsLeft})` : '🎯 เริ่มทำ'}
                            </button>
                          ) : (
                            <span className="px-3 py-1.5 rounded-lg text-xs bg-gray-500/10 text-gray-500 border border-gray-500/20">
                              ครบจำนวนครั้งแล้ว
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </main>
    </div>
  );
};
export default QuizList;
