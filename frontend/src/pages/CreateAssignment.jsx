import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const ROLE_LEVEL = { STUDENT:0, PARENT:0, STAFF:1, CLASS_ADMIN:1, TEACHER:2, ADMIN:3, SUPER_USER:4 };

const CreateAssignment = () => {
  const { user }  = useContext(AuthContext);
  const navigate  = useNavigate();

  const [form, setForm] = useState({
    title: '', description: '', due_date: '', max_score: '', bonus_points: '',
    subject_id: '', teacher_id: '',
  });
  const [subjects,  setSubjects]  = useState([]);
  const [teachers,  setTeachers]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error,     setError]     = useState('');
  const [showManageSubject, setShowManageSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);

  const isAdmin = ROLE_LEVEL[user?.role] >= ROLE_LEVEL['ADMIN'];

  if (ROLE_LEVEL[user?.role] < ROLE_LEVEL['TEACHER']) {
    navigate('/assignments');
    return null;
  }

  // โหลด subjects + teachers
  useEffect(() => {
    Promise.allSettled([
      api.get('/subjects'),
      api.get('/subjects/teachers'),
    ]).then(([sR, tR]) => {
      if (sR.status === 'fulfilled') setSubjects(sR.value.data || []);
      if (tR.status === 'fulfilled') setTeachers(tR.value.data || []);
    }).finally(() => setLoadingData(false));
  }, []);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  // เมื่อเลือกวิชา → auto-fill teacher
  const handleSubjectChange = (e) => {
    const sid = e.target.value;
    const sub = subjects.find(s => String(s.id) === sid);
    setForm(f => ({
      ...f,
      subject_id: sid,
      teacher_id: sub?.teacher_id ? String(sub.teacher_id) : f.teacher_id,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/assignments', {
        ...form,
        subject_id: form.subject_id || null,
        teacher_id: form.teacher_id || null,
      });
      navigate('/assignments');
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setLoading(false); }
  };

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) return;
    setAddingSubject(true);
    try {
      const res = await api.post('/subjects', {
        name: newSubjectName.trim(),
        teacher_id: form.teacher_id || null,
      });
      setSubjects(s => [...s, res.data]);
      setForm(f => ({ ...f, subject_id: String(res.data.id) }));
      setNewSubjectName('');
      setShowManageSubject(false);
    } catch (err) {
      setError(err.response?.data?.message || 'เพิ่มวิชาไม่สำเร็จ');
    } finally { setAddingSubject(false); }
  };

  const selectedSubject = subjects.find(s => String(s.id) === form.subject_id);
  const selectedTeacher = teachers.find(t => String(t.id) === form.teacher_id)
    || selectedSubject?.teacher;

  return (
    <div className="min-h-screen text-white"
      style={{ background: 'linear-gradient(135deg,#0a0018 0%,#0f0c29 40%,#0a1628 100%)' }}>

      {/* Ambient */}
      <div className="fixed top-0 right-0 w-80 h-80 rounded-full pointer-events-none opacity-10"
        style={{ background: 'radial-gradient(circle,#7c3aed,transparent)', filter: 'blur(80px)' }}/>

      {/* Nav */}
      <nav className="px-6 py-3 flex items-center gap-3 border-b border-white/10 sticky top-0 z-20"
        style={{ background: 'rgba(10,0,24,0.85)', backdropFilter: 'blur(16px)' }}>
        <button onClick={() => navigate('/assignments')} className="text-white/40 hover:text-white transition-colors">←</button>
        <span className="text-white/20">|</span>
        <h1 className="font-bold text-base" style={{ color: '#a78bfa' }}>📋 สร้างการบ้านใหม่</h1>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm text-red-300 border border-red-500/30 bg-red-500/10">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── วิชา ── */}
          <div className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              📚 วิชาและผู้สอน
            </h2>

            {/* วิชา dropdown */}
            <div className="mb-3">
              <label className="block text-sm text-white/60 mb-1.5">วิชา</label>
              {loadingData ? (
                <div className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/30 text-sm">กำลังโหลด...</div>
              ) : (
                <div className="flex gap-2">
                  <select name="subject_id" value={form.subject_id} onChange={handleSubjectChange}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400 transition-colors"
                    style={{ colorScheme: 'dark' }}>
                    <option value="" style={{ background: '#1a1a3a' }}>— เลือกวิชา —</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id} style={{ background: '#1a1a3a' }}>
                        {s.name}{s.teacher ? ` (${s.teacher.name})` : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setShowManageSubject(v => !v)}
                    className="px-3 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 text-sm transition-all"
                    title="เพิ่มวิชาใหม่">
                    +
                  </button>
                </div>
              )}
            </div>

            {/* เพิ่มวิชาใหม่ (inline) */}
            {showManageSubject && (
              <div className="mb-3 p-3 rounded-xl border border-purple-500/20 bg-purple-500/5">
                <p className="text-xs text-white/50 mb-2">เพิ่มวิชาใหม่</p>
                <div className="flex gap-2">
                  <input value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)}
                    placeholder="ชื่อวิชา เช่น คณิตศาสตร์"
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400 placeholder-white/20"/>
                  <button type="button" onClick={handleAddSubject} disabled={addingSubject || !newSubjectName.trim()}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                    {addingSubject ? '...' : 'เพิ่ม'}
                  </button>
                </div>
              </div>
            )}

            {/* ผู้สอน */}
            <div>
              <label className="block text-sm text-white/60 mb-1.5">ผู้สอน</label>
              {isAdmin ? (
                /* Admin เลือกครูได้เอง */
                <select name="teacher_id" value={form.teacher_id} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400"
                  style={{ colorScheme: 'dark' }}>
                  <option value="" style={{ background: '#1a1a3a' }}>— เลือกผู้สอน —</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id} style={{ background: '#1a1a3a' }}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                /* Teacher เห็นแค่ read-only */
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10"
                  style={{ background: 'rgba(124,58,237,0.08)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff' }}>
                    {(selectedTeacher?.name || user?.name || 'T').charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {selectedTeacher?.name || user?.name}
                    </p>
                    <p className="text-xs text-white/40">
                      {selectedSubject ? `ครูประจำวิชา ${selectedSubject.name}` : 'ผู้สอน'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── รายละเอียดการบ้าน ── */}
          <div className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <h2 className="font-semibold text-white mb-4">📝 รายละเอียดการบ้าน</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">ชื่อการบ้าน *</label>
                <input type="text" name="title" value={form.title} onChange={handleChange} required
                  placeholder="เช่น แบบฝึกหัดบทที่ 3 สมการเชิงเส้น"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400"/>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1.5">คำอธิบาย</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={3}
                  placeholder="รายละเอียดเพิ่มเติม..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400 resize-none"/>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">⏰ กำหนดส่ง *</label>
                  <input type="datetime-local" name="due_date" value={form.due_date} onChange={handleChange} required
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400"
                    style={{ colorScheme: 'dark' }}/>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">🏆 คะแนนเต็ม *</label>
                  <input type="number" name="max_score" value={form.max_score} onChange={handleChange} required min="1" max="1000"
                    placeholder="100"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400"/>
                </div>
              </div>

              {/* Bonus points */}
              <div className="rounded-xl p-4 border"
                style={{ background: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.2)' }}>
                <label className="block text-sm font-semibold mb-1.5 flex items-center gap-2"
                  style={{ color: '#fbbf24' }}>
                  ⭐ คะแนนพิเศษ (Bonus)
                  <span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    — ไม่บังคับ
                  </span>
                </label>
                <input type="number" name="bonus_points" value={form.bonus_points} onChange={handleChange} min="0" max="500"
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(251,191,36,0.3)' }}/>
                <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  แบบฝึกหัดที่มี bonus จะแสดงป้าย ⭐ BONUS บนการ์ด
                </p>
              </div>
            </div>
          </div>

          {/* ── Preview card ── */}
          {(form.title || form.subject_id) && (
            <div className="rounded-2xl p-4 border border-purple-500/20" style={{ background: 'rgba(124,58,237,0.08)' }}>
              <p className="text-xs text-white/40 mb-2">Preview</p>
              <div className="flex items-center gap-3">
                <div>
                  {form.subject_id && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 mr-2">
                      {selectedSubject?.name}
                    </span>
                  )}
                  <p className="font-semibold text-white mt-1">{form.title || '(ชื่อการบ้าน)'}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {selectedTeacher?.name || user?.name}
                    {form.max_score && ` · ${form.max_score} คะแนน`}
                    {form.bonus_points > 0 && <span style={{ color: '#fbbf24' }}> ⭐ +{form.bonus_points}</span>}
                    {form.due_date && ` · ส่ง ${new Date(form.due_date).toLocaleDateString('th-TH', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pb-6">
            <button type="button" onClick={() => navigate('/assignments')}
              className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl font-semibold text-white text-sm disabled:opacity-50 transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              {loading ? 'กำลังสร้าง...' : '✨ สร้างการบ้าน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAssignment;
