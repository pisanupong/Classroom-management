import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const TakeQuiz = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [justAnswered, setJustAnswered] = useState(false);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const advanceRef = useRef(null);

  useEffect(() => {
    api.get(`/quiz/${id}`)
      .then(r => { setQuiz(r.data); setLoading(false); })
      .catch(err => {
        setError(err.response?.data?.message || 'โหลดไม่ได้');
        setLoading(false);
      });
  }, [id]);

  const handleStart = () => {
    setStarted(true);
    startTimeRef.current = Date.now();
    if (quiz.time_limit > 0) setTimeLeft(quiz.time_limit);
  };

  // Countdown
  useEffect(() => {
    if (!started || timeLeft === null) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [started, timeLeft]);

  const handleAnswer = (qId, choice) => {
    setAnswers(a => ({ ...a, [qId]: choice }));
    const total = quiz?.questions?.length || 0;
    if (current < total - 1) {
      setJustAnswered(true);
      clearTimeout(advanceRef.current);
      advanceRef.current = setTimeout(() => {
        setCurrent(c => c + 1);
        setJustAnswered(false);
      }, 600);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!started || !quiz) return;
    const q = quiz.questions[current];
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= q.choices.length) {
        handleAnswer(q.id, q.choices[num - 1]);
      }
      if (e.key === 'ArrowRight' && current < quiz.questions.length - 1) setCurrent(c => c + 1);
      if (e.key === 'ArrowLeft' && current > 0) setCurrent(c => c - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [started, quiz, current, answers]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    clearTimeout(timerRef.current);
    setSubmitting(true);
    setShowConfirm(false);
    const timeTaken = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    try {
      const res = await api.post(`/quiz/${id}/submit`, { answers, time_taken: timeTaken });
      navigate(`/quiz/${id}/result`, { state: { result: res.data, quiz } });
    } catch (err) {
      setError(err.response?.data?.message || 'ส่งคำตอบไม่ได้');
      setSubmitting(false);
    }
  }, [answers, id, quiz, submitting, navigate]);

  const fmtTimer = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const answered = Object.keys(answers).length;
  const total = quiz?.questions?.length || 0;

  if (loading) return <FullScreen><p className="text-white/40">กำลังโหลด...</p></FullScreen>;
  if (error) return (
    <FullScreen>
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate('/quiz')} className="text-white/50 hover:text-white text-sm">← กลับ</button>
      </div>
    </FullScreen>
  );
  if (!quiz) return null;

  // Start screen
  if (!started) {
    return (
      <FullScreen>
        <div className="max-w-md w-full rounded-3xl p-8 border border-white/10 text-center" style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
          <p className="text-4xl mb-4">🎯</p>
          <h2 className="text-2xl font-bold text-white mb-2">{quiz.title}</h2>
          {quiz.description && <p className="text-white/50 text-sm mb-6">{quiz.description}</p>}
          <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
            {[
              ['📝 จำนวนข้อ', `${total} ข้อ`],
              ['⏱ เวลา', quiz.time_limit ? `${Math.floor(quiz.time_limit / 60)} นาที` : 'ไม่จำกัด'],
              ['🏆 แต้ม/ข้อ', `${quiz.points_per_q} แต้ม`],
              ['🔀 ลำดับตัวเลือก', 'สุ่มทุกครั้ง'],
            ].map(([k, v]) => (
              <div key={k} className="p-3 rounded-xl border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-white/40 text-xs mb-1">{k}</p>
                <p className="font-semibold text-white">{v}</p>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl mb-4 border border-blue-500/20 text-left" style={{ background: 'rgba(59,130,246,0.07)' }}>
            <p className="text-blue-300 text-xs font-medium">⌨️ ทางลัด</p>
            <p className="text-white/40 text-xs mt-1">กด 1–4 เลือกคำตอบ · ← → เปลี่ยนข้อ</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/quiz')} className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">← กลับ</button>
            <button onClick={handleStart} className="flex-1 py-3 rounded-xl font-semibold text-white text-sm hover:scale-[1.02] transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>
              🚀 เริ่มทำแบบฝึกหัด
            </button>
          </div>
        </div>
      </FullScreen>
    );
  }

  const q = quiz.questions[current];

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)' }}>

      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3 sticky top-0 z-10"
        style={{ background: 'rgba(15,12,41,0.92)', backdropFilter: 'blur(10px)' }}>

        <span className="text-sm text-white/50 flex-shrink-0 font-mono">{current + 1}/{total}</span>

        {/* Progress bar */}
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${(answered / total) * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#10b981)' }} />
        </div>

        <span className="text-xs text-emerald-400 font-semibold flex-shrink-0">{answered}/{total} ตอบแล้ว</span>

        {/* Timer */}
        {timeLeft !== null && (
          <div className={`flex-shrink-0 px-3 py-1 rounded-lg font-mono text-sm font-bold border transition-colors ${timeLeft <= 30 ? 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse' :
            timeLeft <= 60 ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' :
              'bg-white/10 border-white/10 text-white'}`}>
            {fmtTimer(timeLeft)}
          </div>
        )}
      </div>

      {/* Question nav dots */}
      <div className="px-4 py-2 flex gap-1.5 overflow-x-auto" style={{ background: 'rgba(255,255,255,0.02)' }}>
        {quiz.questions.map((qq, i) => (
          <button key={i} onClick={() => { clearTimeout(advanceRef.current); setJustAnswered(false); setCurrent(i); }}
            title={`ข้อ ${i + 1}`}
            className="w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 transition-all"
            style={{
              background: i === current ? '#7c3aed' : answers[qq.id] ? '#10b981' : 'rgba(255,255,255,0.08)',
              color: (i === current || answers[qq.id]) ? '#fff' : 'rgba(255,255,255,0.4)',
              border: i === current ? '2px solid #a855f7' : '2px solid transparent',
              transform: i === current ? 'scale(1.15)' : 'scale(1)',
            }}>
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question */}
      <div className="flex-1 flex items-start justify-center p-4 pt-6">
        <div className="w-full max-w-2xl">
          {/* Question card */}
          <div className="rounded-2xl p-6 mb-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}>
            <p className="text-xs text-purple-400/70 font-semibold mb-3 uppercase tracking-widest">ข้อที่ {current + 1}</p>
            <p className="text-lg font-semibold text-white leading-relaxed">{q.question_text}</p>
          </div>

          {/* Choices */}
          <div className="space-y-3">
            {q.choices.map((choice, ci) => {
              const selected = answers[q.id] === choice;
              const letter = ['A', 'B', 'C', 'D', 'E'][ci];
              return (
                <button key={ci} onClick={() => handleAnswer(q.id, choice)}
                  className="w-full text-left p-4 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: selected ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                    borderColor: selected ? '#7c3aed' : 'rgba(255,255,255,0.1)',
                    boxShadow: selected ? '0 0 20px rgba(124,58,237,0.2)' : 'none',
                  }}>
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all"
                      style={{ background: selected ? '#7c3aed' : 'rgba(255,255,255,0.1)', color: selected ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                      {selected ? '✓' : letter}
                    </span>
                    <span className="text-white text-sm">{choice}</span>
                    <span className="ml-auto text-white/20 text-xs">{ci + 1}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Auto-advance hint */}
          {justAnswered && current < total - 1 && (
            <p className="text-center text-purple-400/60 text-xs mt-3 animate-pulse">กำลังไปข้อถัดไป...</p>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            <button onClick={() => { clearTimeout(advanceRef.current); setJustAnswered(false); setCurrent(c => c - 1); }}
              disabled={current === 0}
              className="px-6 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white disabled:opacity-30 text-sm transition-colors">
              ←
            </button>

            <div className="flex-1" />

            {current < total - 1 ? (
              <button onClick={() => { clearTimeout(advanceRef.current); setJustAnswered(false); setCurrent(c => c + 1); }}
                className="px-6 py-3 rounded-xl font-medium text-white text-sm hover:scale-[1.02] transition-all"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                ถัดไป →
              </button>
            ) : (
              <button onClick={() => setShowConfirm(true)} disabled={submitting}
                className="px-6 py-3 rounded-xl font-semibold text-white text-sm hover:scale-[1.02] transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                ✅ ส่งคำตอบ
              </button>
            )}
          </div>

          {answered > 0 && current !== total - 1 && (
            <div className="flex justify-center mt-4">
              <button onClick={() => setShowConfirm(true)} disabled={submitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold border border-emerald-500/30 text-emerald-400/70 hover:text-emerald-300 hover:border-emerald-400/50 transition-all">
                ส่งคำตอบเลย ({answered}/{total})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm submit modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 border border-white/10 text-center"
            style={{ background: '#1a1a2e' }}>
            <p className="text-3xl mb-3">📋</p>
            <h3 className="text-lg font-bold text-white mb-2">ยืนยันการส่ง</h3>
            <p className="text-white/50 text-sm mb-2">ตอบแล้ว <span className="text-emerald-400 font-bold">{answered}</span> / {total} ข้อ</p>
            {answered < total && (
              <p className="text-yellow-400/80 text-xs mb-4">
                ⚠️ ยังมี {total - answered} ข้อที่ยังไม่ตอบ จะได้ 0 คะแนนในข้อเหล่านั้น
              </p>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
                ยังไม่ส่ง
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                {submitting ? 'กำลังส่ง...' : '✅ ส่งเลย'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FullScreen = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #0f0c29, #1a1a2e, #16213e)' }}>
    {children}
  </div>
);

export default TakeQuiz;
