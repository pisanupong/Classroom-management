import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const emptyQ = () => ({ question_text: '', choices: ['', '', '', ''], correct_answer: '' });

const EditQuiz = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { id } = useParams();
  const [meta, setMeta] = useState({ title: '', description: '', time_limit: 600, max_attempts: 1, points_per_q: 10 });
  const [questions, setQuestions] = useState([emptyQ()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isTeacher = ['TEACHER', 'ADMIN', 'SUPER_USER'].includes(user?.role);

  useEffect(() => {
    if (!isTeacher) { navigate('/quiz'); return; }
    api.get(`/quiz/${id}`).then(r => {
      const q = r.data;
      setMeta({
        title: q.title,
        description: q.description || '',
        time_limit: q.time_limit,
        max_attempts: q.max_attempts,
        points_per_q: q.points_per_q,
      });
      setQuestions(q.questions.map(qq => ({
        question_text: qq.question_text,
        choices: Array.isArray(qq.choices) ? qq.choices : [],
        correct_answer: qq.correct_answer,
      })));
    }).catch(() => navigate('/quiz'))
      .finally(() => setLoading(false));
  }, [id]);

  const setQ = (i, key, val) => setQuestions(qs => qs.map((q, j) => j === i ? { ...q, [key]: val } : q));
  const setChoice = (i, ci, val) => setQuestions(qs => qs.map((q, j) => j === i ? { ...q, choices: q.choices.map((c, k) => k === ci ? val : c) } : q));
  const addChoice = (i) => setQuestions(qs => qs.map((q, j) => j === i && q.choices.length < 6 ? { ...q, choices: [...q.choices, ''] } : q));
  const removeChoice = (i, ci) => setQuestions(qs => qs.map((q, j) => j === i && q.choices.length > 2 ? { ...q, choices: q.choices.filter((_, k) => k !== ci), correct_answer: q.choices[ci] === q.correct_answer ? '' : q.correct_answer } : q));
  const addQ = () => setQuestions(qs => [...qs, emptyQ()]);
  const removeQ = (i) => questions.length > 1 && setQuestions(qs => qs.filter((_, j) => j !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) { setError(`ข้อ ${i + 1}: กรุณาใส่คำถาม`); return; }
      if (q.choices.filter(c => c.trim()).length < 2) { setError(`ข้อ ${i + 1}: ต้องมีตัวเลือกอย่างน้อย 2 ตัว`); return; }
      if (!q.correct_answer) { setError(`ข้อ ${i + 1}: กรุณาเลือกคำตอบที่ถูกต้อง`); return; }
    }
    setSaving(true);
    try {
      await api.put(`/quiz/${id}`, {
        ...meta,
        questions: questions.map(q => ({ ...q, choices: q.choices.filter(c => c.trim()) })),
      });
      navigate('/quiz');
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <p className="text-white/40">กำลังโหลด...</p>
    </div>
  );

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <div className="fixed top-0 right-0 w-80 h-80 rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(80px)' }} />

      <nav className="px-6 py-4 flex items-center gap-3 border-b border-white/10 sticky top-0 z-20" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
        <button onClick={() => navigate('/quiz')} className="text-white/60 hover:text-white text-sm">← กลับ</button>
        <span className="text-white/30">|</span>
        <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">✏️ แก้ไขแบบฝึกหัด</h1>
      </nav>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && <div className="p-3 rounded-xl text-sm text-red-300 bg-red-500/10 border border-red-500/30">{error}</div>}

        {/* Quiz metadata */}
        <div className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
          <h2 className="font-semibold text-white mb-4">ข้อมูลแบบฝึกหัด</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">ชื่อแบบฝึกหัด *</label>
              <input value={meta.title} onChange={e => setMeta({ ...meta, title: e.target.value })} required
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">คำอธิบาย</label>
              <textarea value={meta.description} onChange={e => setMeta({ ...meta, description: e.target.value })} rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400 resize-none" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">⏱ เวลา (วินาที)</label>
                <input type="number" value={meta.time_limit} onChange={e => setMeta({ ...meta, time_limit: parseInt(e.target.value) || 0 })} min="0"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400" />
                <p className="text-xs text-white/20 mt-1">0 = ไม่จำกัด</p>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">🔁 จำนวนครั้ง</label>
                <input type="number" value={meta.max_attempts} onChange={e => setMeta({ ...meta, max_attempts: parseInt(e.target.value) || 0 })} min="0"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400" />
                <p className="text-xs text-white/20 mt-1">0 = ไม่จำกัด</p>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">🏆 แต้ม/ข้อ</label>
                <input type="number" value={meta.points_per_q} onChange={e => setMeta({ ...meta, points_per_q: parseInt(e.target.value) || 1 })} min="1"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-white">ข้อที่ {i + 1}</span>
                {questions.length > 1 && (
                  <button type="button" onClick={() => removeQ(i)} className="text-red-400/50 hover:text-red-400 text-xs transition-colors">ลบข้อนี้</button>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-xs text-white/50 mb-1.5">คำถาม *</label>
                <textarea value={q.question_text} onChange={e => setQ(i, 'question_text', e.target.value)} rows={2} required
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400 resize-none" />
              </div>

              <label className="block text-xs text-white/50 mb-2">ตัวเลือก (เลือกข้อที่ถูกต้อง 1 ข้อ) *</label>
              <div className="space-y-2 mb-3">
                {q.choices.map((c, ci) => {
                  const letter = ['A', 'B', 'C', 'D', 'E', 'F'][ci];
                  const isCorrect = q.correct_answer === c && c.trim() !== '';
                  return (
                    <div key={ci} className="flex items-center gap-2">
                      <button type="button" onClick={() => c.trim() && setQ(i, 'correct_answer', c)}
                        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border-2 transition-all"
                        style={{
                          background: isCorrect ? '#10b981' : 'transparent',
                          borderColor: isCorrect ? '#10b981' : 'rgba(255,255,255,0.2)',
                          color: isCorrect ? '#fff' : 'rgba(255,255,255,0.4)',
                        }}>
                        {isCorrect ? '✓' : letter}
                      </button>
                      <input value={c} onChange={e => setChoice(i, ci, e.target.value)}
                        placeholder={`ตัวเลือก ${letter}`}
                        className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400"
                        style={isCorrect ? { borderColor: '#10b981', background: 'rgba(16,185,129,0.1)' } : {}} />
                      {q.choices.length > 2 && (
                        <button type="button" onClick={() => removeChoice(i, ci)} className="text-white/20 hover:text-red-400 transition-colors text-sm px-1">✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
              {q.choices.length < 6 && (
                <button type="button" onClick={() => addChoice(i)} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                  + เพิ่มตัวเลือก
                </button>
              )}
              {!q.correct_answer && <p className="text-xs text-yellow-400/60 mt-2">⚠️ กรุณาคลิกวงกลมหน้าตัวเลือกที่ถูกต้อง</p>}
            </div>
          ))}
        </div>

        <button type="button" onClick={addQ}
          className="w-full py-3 rounded-2xl border border-dashed border-white/20 text-white/40 hover:text-white/70 hover:border-white/30 text-sm transition-all">
          + เพิ่มคำถาม ({questions.length} ข้อ)
        </button>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/quiz')} className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">ยกเลิก</button>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 rounded-xl font-semibold text-white text-sm disabled:opacity-50 hover:scale-[1.02] transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>
            {saving ? 'กำลังบันทึก...' : `💾 บันทึกการแก้ไข (${questions.length} ข้อ)`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditQuiz;
