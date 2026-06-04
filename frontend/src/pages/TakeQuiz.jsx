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
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

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
    if (quiz.time_limit > 0) {
      setTimeLeft(quiz.time_limit);
    }
  };

  // Countdown timer
  useEffect(() => {
    if (!started || timeLeft === null) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [started, timeLeft]);

  const handleAnswer = (qId, choice) => setAnswers(a => ({ ...a, [qId]: choice }));

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    clearTimeout(timerRef.current);
    setSubmitting(true);
    const timeTaken = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    try {
      const res = await api.post(`/quiz/${id}/submit`, { answers, time_taken: timeTaken });
      navigate(`/quiz/${id}/result`, { state: { result: res.data, quiz } });
    } catch (err) {
      setError(err.response?.data?.message || 'ส่งคำตอบไม่ได้');
      setSubmitting(false);
    }
  }, [answers, id, quiz, submitting, navigate]);

  const fmtTimer = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const answered = Object.keys(answers).length;
  const total = quiz?.questions?.length || 0;

  if (loading) return <FullScreen><p className="text-white/40">กำลังโหลด...</p></FullScreen>;
  if (error) return <FullScreen><div className="text-center"><p className="text-red-400 mb-4">{error}</p><button onClick={() => navigate('/quiz')} className="text-white/50 hover:text-white text-sm">← กลับ</button></div></FullScreen>;
  if (!quiz) return null;

  // Start screen
  if (!started) {
    return (
      <FullScreen>
        <div className="max-w-md w-full rounded-3xl p-8 border border-white/10 text-center" style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
          <p className="text-4xl mb-4">🎯</p>
          <h2 className="text-2xl font-bold text-white mb-2">{quiz.title}</h2>
          {quiz.description && <p className="text-white/50 text-sm mb-6">{quiz.description}</p>}
          <div className="grid grid-cols-2 gap-3 mb-8 text-sm">
            {[
              ['📝 จำนวนข้อ', `${total} ข้อ`],
              ['⏱ เวลา', quiz.time_limit ? `${Math.floor(quiz.time_limit/60)} นาที` : 'ไม่จำกัด'],
              ['🏆 แต้ม/ข้อ', `${quiz.points_per_q} แต้ม`],
              ['🔀 คำตอบ', 'สุ่มลำดับ'],
            ].map(([k,v]) => (
              <div key={k} className="p-3 rounded-xl border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-white/40 text-xs mb-1">{k}</p>
                <p className="font-semibold text-white">{v}</p>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-xl mb-6 border border-yellow-500/30 text-left" style={{ background: 'rgba(245,158,11,0.08)' }}>
            <p className="text-yellow-300 text-xs font-medium">⚠️ หมายเหตุ</p>
            <p className="text-white/50 text-xs mt-1">ลำดับตัวเลือกถูกสุ่มแตกต่างกันในแต่ละครั้ง เพื่อป้องกันการลอกคำตอบ</p>
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
      <div className="px-6 py-3 border-b border-white/10 flex items-center gap-4 sticky top-0 z-10" style={{ background: 'rgba(15,12,41,0.9)', backdropFilter: 'blur(10px)' }}>
        <span className="text-sm text-white/50 flex-shrink-0">ข้อ {current+1}/{total}</span>

        {/* Progress */}
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${((current+1)/total)*100}%`, background: 'linear-gradient(90deg,#7c3aed,#db2777)' }} />
        </div>

        {/* Quick nav dots */}
        <div className="flex gap-1 flex-shrink-0">
          {quiz.questions.map((qq, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className="w-5 h-5 rounded-full text-xs transition-all"
              style={{
                background: i === current ? '#7c3aed' : answers[qq.id] ? '#10b981' : 'rgba(255,255,255,0.1)',
                border: i === current ? '2px solid #a855f7' : '1px solid transparent',
              }} />
          ))}
        </div>

        {/* Timer */}
        {timeLeft !== null && (
          <div className={`flex-shrink-0 px-3 py-1 rounded-lg font-mono text-sm font-bold border ${
            timeLeft <= 30 ? 'bg-red-500/20 border-red-500/40 text-red-300' :
            timeLeft <= 60 ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' :
            'bg-white/10 border-white/10 text-white'
          }`}>
            {fmtTimer(timeLeft)}
          </div>
        )}
      </div>

      {/* Question */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {/* Question card */}
          <div className="rounded-2xl p-6 mb-6 border border-white/10" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}>
            <p className="text-xs text-white/40 mb-3">ข้อที่ {current + 1}</p>
            <p className="text-lg font-semibold text-white leading-relaxed">{q.question_text}</p>
          </div>

          {/* Choices */}
          <div className="space-y-3">
            {q.choices.map((choice, ci) => {
              const selected = answers[q.id] === choice;
              const letter = ['A','B','C','D','E'][ci];
              return (
                <button key={ci} onClick={() => handleAnswer(q.id, choice)}
                  className="w-full text-left p-4 rounded-2xl border transition-all hover:scale-[1.01]"
                  style={{
                    background: selected ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                    borderColor: selected ? '#7c3aed' : 'rgba(255,255,255,0.1)',
                    boxShadow: selected ? '0 0 20px rgba(124,58,237,0.2)' : 'none',
                  }}>
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: selected ? '#7c3aed' : 'rgba(255,255,255,0.1)', color: selected ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                      {letter}
                    </span>
                    <span className="text-white text-sm">{choice}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            <button onClick={() => setCurrent(c => c - 1)} disabled={current === 0}
              className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white disabled:opacity-30 text-sm transition-colors">
              ← ข้อก่อน
            </button>

            {current < total - 1 ? (
              <button onClick={() => setCurrent(c => c + 1)}
                className="flex-1 py-3 rounded-xl font-medium text-white text-sm hover:scale-[1.02] transition-all"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>
                ข้อถัดไป →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-3 rounded-xl font-semibold text-white text-sm hover:scale-[1.02] transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                {submitting ? 'กำลังส่ง...' : `✅ ส่งคำตอบ (${answered}/${total})`}
              </button>
            )}
          </div>

          {answered < total && current === total - 1 && (
            <p className="text-center text-yellow-400/70 text-xs mt-3">
              ⚠️ ยังมี {total - answered} ข้อที่ยังไม่ได้ตอบ — สามารถส่งได้แต่จะได้ 0 คะแนนในข้อที่ไม่ได้ตอบ
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const FullScreen = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #0f0c29, #1a1a2e, #16213e)' }}>
    {children}
  </div>
);

export default TakeQuiz;
