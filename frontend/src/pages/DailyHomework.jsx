import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const DAYS_TH = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const toDateStr = (d) => d.toISOString().slice(0, 10);
const formatDisplay = (d) => `${DAYS_TH[d.getDay()]} ${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;

const SUBJECT_COLORS = {
  'คณิตศาสตร์': '#7c3aed',
  'ภาษาไทย': '#db2777',
  'ภาษาอังกฤษ': '#0ea5e9',
  'วิทยาศาสตร์': '#10b981',
  'สังคมศึกษา': '#f59e0b',
  'ศิลปะ': '#ef4444',
  'พลศึกษา': '#f97316',
  'คอมพิวเตอร์': '#6366f1',
};
const SUBJECT_LIST = Object.keys(SUBJECT_COLORS);
const getColor = (subject) => SUBJECT_COLORS[subject] || '#7c3aed';

const DailyHomework = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ byDate: {}, total: 0, done: 0 });
  const [loading, setLoading] = useState(true);

  // Add form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: '', detail: '' });
  const [customSubject, setCustomSubject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, summaryRes] = await Promise.all([
        api.get('/daily-homework', { params: { date: toDateStr(selectedDate) } }),
        api.get('/daily-homework/summary', { params: { days: 7 } }),
      ]);
      setItems(itemsRes.data);
      setSummary(summaryRes.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [selectedDate]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleToggle = async (id) => {
    // Optimistic update
    setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
    try {
      await api.patch(`/daily-homework/${id}/toggle`);
      // re-sort after toggle
      setItems(prev => [...prev].sort((a, b) => Number(a.done) - Number(b.done)));
      // refresh summary
      const res = await api.get('/daily-homework/summary', { params: { days: 7 } });
      setSummary(res.data);
    } catch { fetchItems(); }
  };

  const handleDelete = async (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      await api.delete(`/daily-homework/${id}`);
      const res = await api.get('/daily-homework/summary', { params: { days: 7 } });
      setSummary(res.data);
    } catch { fetchItems(); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.subject.trim()) { setFormError('กรุณากรอกวิชา'); return; }
    setSubmitting(true);
    try {
      await api.post('/daily-homework', { ...form, date: toDateStr(selectedDate) });
      setForm({ subject: '', detail: '' });
      setCustomSubject(false);
      setShowForm(false);
      await fetchItems();
    } catch (err) {
      setFormError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setSubmitting(false); }
  };

  const changeDay = (offset) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d);
  };

  const isToday = toDateStr(selectedDate) === toDateStr(new Date());
  const doneCount = items.filter(i => i.done).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Last 7 days for mini streak chart
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const key = toDateStr(d);
    const stat = summary.byDate[key];
    return { date: d, key, stat };
  });

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      {/* Decorative */}
      <div className="fixed top-0 left-1/2 w-96 h-96 -translate-x-1/2 rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(100px)' }} />

      {/* Navbar */}
      <nav className="px-6 py-4 flex justify-between items-center border-b border-white/10 sticky top-0 z-20"
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-white/60 hover:text-white text-sm transition-colors">
            ← Dashboard
          </button>
          <span className="text-white/30">|</span>
          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            📖 การบ้านประจำวัน
          </h1>
        </div>
        <button onClick={() => navigate('/calendar')} className="text-white/40 hover:text-white text-sm transition-colors">
          📅 ปฏิทิน
        </button>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Date navigator */}
        <div className="flex items-center justify-between">
          <button onClick={() => changeDay(-1)}
            className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors text-xl">
            ‹
          </button>
          <div className="text-center">
            <p className="font-bold text-white text-lg">{formatDisplay(selectedDate)}</p>
            {isToday && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300">วันนี้</span>}
          </div>
          <button onClick={() => changeDay(1)}
            disabled={isToday}
            className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors text-xl disabled:opacity-30">
            ›
          </button>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="rounded-2xl p-4 border border-white/10"
            style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-white/70">ความคืบหน้าวันนี้</span>
              <span className="text-sm font-bold text-white">{doneCount}/{totalCount} วิชา</span>
            </div>
            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: progress === 100
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : 'linear-gradient(90deg, #7c3aed, #db2777)',
                }} />
            </div>
            {progress === 100 && (
              <p className="text-center text-xs text-emerald-400 mt-2 font-medium">🎉 เสร็จหมดแล้ว! ยอดเยี่ยมมาก</p>
            )}
          </div>
        )}

        {/* 7-day streak */}
        <div className="rounded-2xl p-4 border border-white/10"
          style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
          <p className="text-xs text-white/40 mb-3">7 วันย้อนหลัง</p>
          <div className="flex justify-between gap-1">
            {last7.map(({ date, key, stat }) => {
              const pct = stat ? (stat.done / stat.total) : null;
              const isSelected = toDateStr(selectedDate) === key;
              return (
                <button key={key} onClick={() => setSelectedDate(new Date(date))}
                  className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full h-8 rounded-lg transition-all"
                    style={{
                      background: pct === null ? 'rgba(255,255,255,0.05)'
                        : pct === 1 ? 'rgba(16,185,129,0.4)'
                        : pct > 0 ? 'rgba(124,58,237,0.3)'
                        : 'rgba(239,68,68,0.2)',
                      outline: isSelected ? '2px solid rgba(124,58,237,0.8)' : 'none',
                    }} />
                  <span className="text-xs text-white/40">{date.getDate()}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-white/30 justify-center">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/50 inline-block" /> เสร็จทุกวิชา</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-purple-500/40 inline-block" /> เสร็จบางส่วน</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500/30 inline-block" /> ยังไม่เสร็จ</span>
          </div>
        </div>

        {/* Todo list */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-center text-white/30 py-6">กำลังโหลด...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">📭</p>
              <p className="text-white/40 text-sm">ยังไม่มีการบ้านวันนี้</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                  item.done ? 'border-white/5 opacity-60' : 'border-white/10'
                }`}
                style={{ background: item.done ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>

                {/* Checkbox */}
                <button onClick={() => handleToggle(item.id)}
                  className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                  style={{
                    borderColor: item.done ? '#10b981' : getColor(item.subject),
                    background: item.done ? '#10b981' : 'transparent',
                  }}>
                  {item.done && <span className="text-white text-xs font-bold">✓</span>}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${item.done ? 'line-through text-white/30' : 'text-white'}`}>
                      {item.subject}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${getColor(item.subject)}25`, color: getColor(item.subject) }}>
                      {item.subject}
                    </span>
                  </div>
                  {item.detail && (
                    <p className={`text-xs mt-0.5 ${item.done ? 'text-white/20' : 'text-white/50'}`}>
                      {item.detail}
                    </p>
                  )}
                </div>

                {/* Delete */}
                <button onClick={() => handleDelete(item.id)}
                  className="text-white/20 hover:text-red-400 transition-colors text-sm flex-shrink-0 p-1">
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add form */}
        {showForm ? (
          <div className="rounded-2xl p-5 border border-purple-400/30"
            style={{ background: 'rgba(124,58,237,0.1)', backdropFilter: 'blur(10px)' }}>
            <form onSubmit={handleAdd} className="space-y-3">
              {formError && (
                <p className="text-red-300 text-xs">{formError}</p>
              )}

              {/* Subject selector */}
              <div>
                <label className="block text-xs text-white/50 mb-2">วิชา</label>
                {!customSubject ? (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {SUBJECT_LIST.map(s => (
                      <button key={s} type="button"
                        onClick={() => setForm({ ...form, subject: s })}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                        style={{
                          background: form.subject === s ? `${getColor(s)}40` : 'rgba(255,255,255,0.07)',
                          color: form.subject === s ? getColor(s) : 'rgba(255,255,255,0.5)',
                          border: `1px solid ${form.subject === s ? getColor(s) + '60' : 'transparent'}`,
                        }}>
                        {s}
                      </button>
                    ))}
                    <button type="button" onClick={() => { setCustomSubject(true); setForm({ ...form, subject: '' }); }}
                      className="px-3 py-1.5 rounded-xl text-xs text-white/30 hover:text-white/60 border border-white/10 transition-colors">
                      + อื่นๆ
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input type="text" autoFocus value={form.subject}
                      onChange={e => setForm({ ...form, subject: e.target.value })}
                      placeholder="ชื่อวิชา..."
                      className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-400" />
                    <button type="button" onClick={() => { setCustomSubject(false); setForm({ ...form, subject: '' }); }}
                      className="px-3 py-2 rounded-xl text-white/40 hover:text-white border border-white/10 text-xs transition-colors">
                      รายการ
                    </button>
                  </div>
                )}
              </div>

              {/* Detail */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">รายละเอียด (ไม่บังคับ)</label>
                <input type="text" value={form.detail}
                  onChange={e => setForm({ ...form, detail: e.target.value })}
                  placeholder="เช่น แบบฝึกหัดหน้า 45-50"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-400" />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowForm(false); setForm({ subject: '', detail: '' }); setCustomSubject(false); }}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl font-medium text-white text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>
                  {submitting ? 'กำลังเพิ่ม...' : '+ เพิ่มการบ้าน'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="w-full py-3.5 rounded-2xl border border-dashed border-white/20 text-white/40 hover:text-white/70 hover:border-white/30 text-sm transition-all">
            + เพิ่มการบ้าน
          </button>
        )}
      </main>
    </div>
  );
};

export default DailyHomework;
