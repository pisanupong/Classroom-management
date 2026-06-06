import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const DAYS_TH   = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

const toDateStr     = (d) => d.toISOString().slice(0, 10);
const formatDisplay = (d) => `${DAYS_TH[d.getDay()]} ${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
const formatShort   = (d) => `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${(d.getFullYear()+543).toString().slice(2)}`;

const SUBJECT_COLORS = {
  'คณิตศาสตร์':'#7c3aed','ภาษาไทย':'#db2777','ภาษาอังกฤษ':'#0ea5e9',
  'วิทยาศาสตร์':'#10b981','สังคมศึกษา':'#f59e0b','ศิลปะ':'#ef4444',
  'พลศึกษา':'#f97316','คอมพิวเตอร์':'#6366f1',
};
const SUBJECT_LIST = Object.keys(SUBJECT_COLORS);
const getColor = (s) => SUBJECT_COLORS[s] || '#7c3aed';

/* ── homework type config ── */
const HW_TYPES = [
  { value:'หนังสือ', icon:'📕', color:'#ef4444', bg:'rgba(239,68,68,0.15)',   border:'rgba(239,68,68,0.3)'   },
  { value:'สมุด',    icon:'📒', color:'#f59e0b', bg:'rgba(245,158,11,0.15)',  border:'rgba(245,158,11,0.3)'  },
  { value:'รายงาน', icon:'📄', color:'#0ea5e9', bg:'rgba(14,165,233,0.15)',   border:'rgba(14,165,233,0.3)'  },
  { value:'อื่นๆ',  icon:'📝', color:'#a78bfa', bg:'rgba(167,139,250,0.15)', border:'rgba(167,139,250,0.3)' },
];
const getHwType = (v) => HW_TYPES.find(t => t.value === v) || HW_TYPES[3];

/* ── submit location config ── */
const LOCATIONS = [
  { value:'classroom',    icon:'💻', label:'Classroom (ออนไลน์)', color:'#34d399', bg:'rgba(52,211,153,0.15)',  border:'rgba(52,211,153,0.3)'  },
  { value:'ในห้องเรียน', icon:'🏫', label:'ในห้องเรียน',          color:'#60a5fa', bg:'rgba(96,165,250,0.15)',  border:'rgba(96,165,250,0.3)'  },
  { value:'โต๊ะครู',     icon:'🪑', label:'โต๊ะครู',              color:'#f472b6', bg:'rgba(244,114,182,0.15)', border:'rgba(244,114,182,0.3)' },
];
const getLocation = (v) => LOCATIONS.find(l => l.value === v) || LOCATIONS[1];

/* ══ Edit Modal ══ */
const EditHomeworkModal = ({ item, onClose, onSaved }) => {
  const [form, setForm] = useState({
    subject:         item.subject,
    detail:          item.detail || '',
    homework_type:   item.homework_type || 'อื่นๆ',
    due_date:        item.due_date ? item.due_date.slice(0,10) : '',
    submit_location: item.submit_location || 'ในห้องเรียน',
  });
  const [customSubject, setCustomSubject] = useState(!SUBJECT_LIST.includes(item.subject));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res = await api.put(`/daily-homework/${item.id}`, form);
      onSaved(res.data);
      onClose();
    } catch (err) { setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.8)', backdropFilter:'blur(6px)' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-3xl p-5 border text-white max-h-[90vh] overflow-y-auto"
        style={{ background:'rgba(15,20,50,0.98)', borderColor:'rgba(255,255,255,0.1)' }}>
        <h3 className="font-bold text-lg mb-4">✏️ แก้ไขการบ้าน</h3>
        {error && <div className="mb-3 p-3 rounded-xl text-sm text-red-300 bg-red-500/10 border border-red-500/30">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Subject */}
          <div>
            <label className="block text-xs text-white/50 mb-2">วิชา *</label>
            {!customSubject ? (
              <div className="flex flex-wrap gap-2">
                {SUBJECT_LIST.map(s => (
                  <button key={s} type="button" onClick={()=>setForm({...form,subject:s})}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: form.subject===s?`${getColor(s)}40`:'rgba(255,255,255,0.07)',
                      color:      form.subject===s?getColor(s):'rgba(255,255,255,0.5)',
                      border:     `1px solid ${form.subject===s?getColor(s)+'60':'transparent'}`,
                    }}>{s}</button>
                ))}
                <button type="button" onClick={()=>{ setCustomSubject(true); }}
                  className="px-3 py-1.5 rounded-xl text-xs text-white/30 hover:text-white/60 border border-white/10">+ พิมพ์เอง</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input autoFocus type="text" value={form.subject}
                  onChange={e=>setForm({...form,subject:e.target.value})}
                  className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400"/>
                <button type="button" onClick={()=>setCustomSubject(false)}
                  className="px-3 py-2 rounded-xl text-white/40 border border-white/10 text-xs">รายการ</button>
              </div>
            )}
          </div>

          {/* Homework type */}
          <div>
            <label className="block text-xs text-white/50 mb-2">ประเภทงาน</label>
            <div className="grid grid-cols-4 gap-2">
              {HW_TYPES.map(t => {
                const active = form.homework_type === t.value;
                return (
                  <button key={t.value} type="button" onClick={()=>setForm({...form,homework_type:t.value})}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all border"
                    style={{ background:active?t.bg:'rgba(255,255,255,0.05)', color:active?t.color:'rgba(255,255,255,0.4)', borderColor:active?t.border:'transparent' }}>
                    <span className="text-xl">{t.icon}</span>{t.value}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit location */}
          <div>
            <label className="block text-xs text-white/50 mb-2">สถานที่ส่ง</label>
            <div className="grid grid-cols-3 gap-2">
              {LOCATIONS.map(l => {
                const active = form.submit_location === l.value;
                return (
                  <button key={l.value} type="button" onClick={()=>setForm({...form,submit_location:l.value})}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all border"
                    style={{ background:active?l.bg:'rgba(255,255,255,0.05)', color:active?l.color:'rgba(255,255,255,0.4)', borderColor:active?l.border:'transparent' }}>
                    <span className="text-xl">{l.icon}</span>
                    <span className="text-center leading-tight">{l.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due date */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">กำหนดส่ง</label>
            <input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}
              className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400"
              style={{ colorScheme:'dark' }}/>
          </div>

          {/* Detail */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">รายละเอียด</label>
            <input type="text" value={form.detail} onChange={e=>setForm({...form,detail:e.target.value})}
              placeholder="เช่น แบบฝึกหัดหน้า 45-50"
              className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-400"/>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm">ยกเลิก</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl font-medium text-white text-sm disabled:opacity-50"
              style={{ background:'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DailyHomework = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const canEdit  = user?.role && user.role !== 'STUDENT';

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [items, setItems]     = useState([]);
  const [summary, setSummary] = useState({ byDate:{}, total:0, done:0 });
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    subject: '', detail: '',
    homework_type: 'อื่นๆ',
    due_date: '',
    submit_location: 'ในห้องเรียน',
  });
  const [customSubject, setCustomSubject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        api.get('/daily-homework', { params: { date: toDateStr(selectedDate) } }),
        api.get('/daily-homework/summary', { params: { days: 7 } }),
      ]);
      setItems(r1.data);
      setSummary(r2.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [selectedDate]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleToggle = async (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
    try {
      await api.patch(`/daily-homework/${id}/toggle`);
      setItems(prev => [...prev].sort((a,b) => Number(a.done)-Number(b.done)));
      const r = await api.get('/daily-homework/summary', { params:{ days:7 } });
      setSummary(r.data);
    } catch { fetchItems(); }
  };

  const handleDelete = async (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      await api.delete(`/daily-homework/${id}`);
      const r = await api.get('/daily-homework/summary', { params:{ days:7 } });
      setSummary(r.data);
    } catch { fetchItems(); }
  };

  const handleEditSaved = (updated) => {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  };

  const resetForm = () => {
    setForm({ subject:'', detail:'', homework_type:'อื่นๆ', due_date:'', submit_location:'ในห้องเรียน' });
    setCustomSubject(false); setFormError('');
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setFormError('');
    if (!form.subject.trim()) { setFormError('กรุณากรอกวิชา'); return; }
    setSubmitting(true);
    try {
      await api.post('/daily-homework', { ...form, date: toDateStr(selectedDate) });
      resetForm(); setShowForm(false);
      await fetchItems();
    } catch (err) { setFormError(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSubmitting(false); }
  };

  const changeDay = (offset) => {
    const d = new Date(selectedDate); d.setDate(d.getDate() + offset); setSelectedDate(d);
  };

  const isToday    = toDateStr(selectedDate) === toDateStr(new Date());
  const doneCount  = items.filter(i => i.done).length;
  const totalCount = items.length;
  const progress   = totalCount > 0 ? Math.round((doneCount/totalCount)*100) : 0;

  const last7 = Array.from({ length:7 }, (_,i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i);
    const key = toDateStr(d);
    return { date:d, key, stat: summary.byDate[key] };
  });

  return (
    <div className="min-h-screen text-white" style={{ background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)' }}>
      <div className="fixed top-0 left-1/2 w-96 h-96 -translate-x-1/2 rounded-full opacity-10 pointer-events-none"
        style={{ background:'radial-gradient(circle,#7c3aed,transparent)', filter:'blur(100px)' }}/>

      {/* Navbar */}
      <nav className="px-6 py-4 flex justify-between items-center border-b border-white/10 sticky top-0 z-20"
        style={{ background:'rgba(255,255,255,0.05)', backdropFilter:'blur(10px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={()=>navigate('/dashboard')} className="text-white/60 hover:text-white text-sm transition-colors">
            ← Dashboard
          </button>
          <span className="text-white/30">|</span>
          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            📖 การบ้านประจำวัน
          </h1>
        </div>
        <button onClick={()=>navigate('/calendar')} className="text-white/40 hover:text-white text-sm transition-colors">
          📅 ปฏิทิน
        </button>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Date navigator */}
        <div className="flex items-center justify-between">
          <button onClick={()=>changeDay(-1)}
            className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors text-xl">‹</button>
          <div className="text-center">
            <p className="font-bold text-white text-lg">{formatDisplay(selectedDate)}</p>
            {isToday && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300">วันนี้</span>}
          </div>
          <button onClick={()=>changeDay(1)} disabled={isToday}
            className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors text-xl disabled:opacity-30">›</button>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="rounded-2xl p-4 border border-white/10"
            style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(10px)' }}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-white/70">ความคืบหน้าวันนี้</span>
              <span className="text-sm font-bold text-white">{doneCount}/{totalCount} วิชา</span>
            </div>
            <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width:`${progress}%`, background: progress===100 ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,#7c3aed,#db2777)' }}/>
            </div>
            {progress===100 && <p className="text-center text-xs text-emerald-400 mt-2 font-medium">🎉 เสร็จหมดแล้ว! ยอดเยี่ยมมาก</p>}
          </div>
        )}

        {/* 7-day streak */}
        <div className="rounded-2xl p-4 border border-white/10"
          style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(10px)' }}>
          <p className="text-xs text-white/40 mb-3">7 วันย้อนหลัง</p>
          <div className="flex justify-between gap-1">
            {last7.map(({ date, key, stat }) => {
              const pct = stat ? (stat.done/stat.total) : null;
              const isSelected = toDateStr(selectedDate) === key;
              return (
                <button key={key} onClick={()=>setSelectedDate(new Date(date))}
                  className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full h-8 rounded-lg transition-all" style={{
                    background: pct===null?'rgba(255,255,255,0.05)':pct===1?'rgba(16,185,129,0.4)':pct>0?'rgba(124,58,237,0.3)':'rgba(239,68,68,0.2)',
                    outline: isSelected?'2px solid rgba(124,58,237,0.8)':'none',
                  }}/>
                  <span className="text-xs text-white/40">{date.getDate()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Homework list */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-center text-white/30 py-6">กำลังโหลด...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">📭</p>
              <p className="text-white/40 text-sm">ยังไม่มีการบ้านวันนี้</p>
            </div>
          ) : items.map(item => {
            const hwType = getHwType(item.homework_type);
            const loc    = getLocation(item.submit_location);
            const dueD   = item.due_date ? new Date(item.due_date) : null;
            const isOverdue = dueD && !item.done && dueD < new Date();

            return (
              <div key={item.id}
                className={`p-4 rounded-2xl border transition-all ${item.done?'border-white/5 opacity-60':'border-white/10'}`}
                style={{ background: item.done?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.07)', backdropFilter:'blur(10px)' }}>

                {/* Row 1: checkbox + subject + type badge */}
                <div className="flex items-center gap-3">
                  <button onClick={()=>handleToggle(item.id)}
                    className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{ borderColor: item.done?'#10b981':getColor(item.subject), background: item.done?'#10b981':'transparent' }}>
                    {item.done && <span className="text-white text-xs font-bold">✓</span>}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${item.done?'line-through text-white/30':'text-white'}`}>
                        {item.subject}
                      </span>
                      {/* homework type badge */}
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1"
                        style={{ background:hwType.bg, color:hwType.color, border:`1px solid ${hwType.border}` }}>
                        {hwType.icon} {hwType.value}
                      </span>
                    </div>
                    {item.detail && (
                      <p className={`text-xs mt-0.5 ${item.done?'text-white/20':'text-white/50'}`}>{item.detail}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canEdit && (
                      <button onClick={()=>setEditTarget(item)}
                        className="text-white/20 hover:text-purple-400 transition-colors text-sm p-1">✏️</button>
                    )}
                    <button onClick={()=>handleDelete(item.id)}
                      className="text-white/20 hover:text-red-400 transition-colors text-sm p-1">✕</button>
                  </div>
                </div>

                {/* Row 2: due date + location */}
                <div className="flex items-center gap-3 mt-2.5 ml-9 flex-wrap">
                  {/* Submit location */}
                  <span className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                    style={{ background:loc.bg, color:loc.color, border:`1px solid ${loc.border}` }}>
                    {loc.icon} {loc.label}
                  </span>
                  {/* Due date */}
                  {dueD && (
                    <span className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${isOverdue?'animate-pulse':''}`}
                      style={{
                        background: isOverdue?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.06)',
                        color:      isOverdue?'#f87171':'rgba(255,255,255,0.45)',
                        border:     `1px solid ${isOverdue?'rgba(239,68,68,0.3)':'rgba(255,255,255,0.1)'}`,
                      }}>
                      {isOverdue ? '⏰' : '📅'} ส่ง {formatShort(dueD)}
                      {isOverdue && ' (เลยกำหนด!)'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add form */}
        {showForm ? (
          <div className="rounded-2xl p-5 border border-purple-400/30"
            style={{ background:'rgba(124,58,237,0.1)', backdropFilter:'blur(10px)' }}>
            <form onSubmit={handleAdd} className="space-y-4">
              {formError && <p className="text-red-300 text-xs">{formError}</p>}

              {/* Subject */}
              <div>
                <label className="block text-xs text-white/50 mb-2">วิชา *</label>
                {!customSubject ? (
                  <div className="flex flex-wrap gap-2">
                    {SUBJECT_LIST.map(s => (
                      <button key={s} type="button" onClick={()=>setForm({...form,subject:s})}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                        style={{
                          background: form.subject===s?`${getColor(s)}40`:'rgba(255,255,255,0.07)',
                          color:      form.subject===s?getColor(s):'rgba(255,255,255,0.5)',
                          border:     `1px solid ${form.subject===s?getColor(s)+'60':'transparent'}`,
                        }}>{s}</button>
                    ))}
                    <button type="button" onClick={()=>{ setCustomSubject(true); setForm({...form,subject:''}); }}
                      className="px-3 py-1.5 rounded-xl text-xs text-white/30 hover:text-white/60 border border-white/10 transition-colors">
                      + พิมพ์เอง
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input autoFocus type="text" value={form.subject}
                      onChange={e=>setForm({...form,subject:e.target.value})}
                      placeholder="ชื่อวิชา..."
                      className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-400"/>
                    <button type="button" onClick={()=>{ setCustomSubject(false); setForm({...form,subject:''}); }}
                      className="px-3 py-2 rounded-xl text-white/40 hover:text-white border border-white/10 text-xs">รายการ</button>
                  </div>
                )}
              </div>

              {/* Homework type */}
              <div>
                <label className="block text-xs text-white/50 mb-2">ประเภทงาน</label>
                <div className="grid grid-cols-4 gap-2">
                  {HW_TYPES.map(t => {
                    const active = form.homework_type === t.value;
                    return (
                      <button key={t.value} type="button" onClick={()=>setForm({...form,homework_type:t.value})}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all border"
                        style={{
                          background:   active ? t.bg : 'rgba(255,255,255,0.05)',
                          color:        active ? t.color : 'rgba(255,255,255,0.4)',
                          borderColor:  active ? t.border : 'transparent',
                        }}>
                        <span className="text-xl">{t.icon}</span>
                        {t.value}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit location */}
              <div>
                <label className="block text-xs text-white/50 mb-2">สถานที่ส่ง</label>
                <div className="grid grid-cols-3 gap-2">
                  {LOCATIONS.map(l => {
                    const active = form.submit_location === l.value;
                    return (
                      <button key={l.value} type="button" onClick={()=>setForm({...form,submit_location:l.value})}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all border"
                        style={{
                          background:  active ? l.bg : 'rgba(255,255,255,0.05)',
                          color:       active ? l.color : 'rgba(255,255,255,0.4)',
                          borderColor: active ? l.border : 'transparent',
                        }}>
                        <span className="text-xl">{l.icon}</span>
                        <span className="text-center leading-tight">{l.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Due date */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">กำหนดส่ง (ไม่บังคับ)</label>
                <input type="date" value={form.due_date}
                  onChange={e=>setForm({...form,due_date:e.target.value})}
                  min={toDateStr(new Date())}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400"
                  style={{ colorScheme:'dark' }}/>
              </div>

              {/* Detail */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">รายละเอียดเพิ่มเติม (ไม่บังคับ)</label>
                <input type="text" value={form.detail}
                  onChange={e=>setForm({...form,detail:e.target.value})}
                  placeholder="เช่น แบบฝึกหัดหน้า 45-50"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-400"/>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={()=>{ setShowForm(false); resetForm(); }}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl font-medium text-white text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ background:'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                  {submitting ? 'กำลังเพิ่ม...' : '+ เพิ่มการบ้าน'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button onClick={()=>setShowForm(true)}
            className="w-full py-3.5 rounded-2xl border border-dashed border-white/20 text-white/40 hover:text-white/70 hover:border-white/30 text-sm transition-all">
            + เพิ่มการบ้าน
          </button>
        )}
      </main>

      {/* Edit Modal */}
      {editTarget && (
        <EditHomeworkModal
          item={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  );
};

export default DailyHomework;
