import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const ROLE_LEVEL = { STUDENT:0, CLASS_ADMIN:1, TEACHER:2, ADMIN:3, SUPER_USER:4 };
const DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

const EVENT_TYPE_META = {
  EVENT:   { label: 'กิจกรรม',        icon: '📌', defaultColor: '#7c3aed' },
  HOLIDAY: { label: 'วันหยุดนักขัตฤกษ์', icon: '🎌', defaultColor: '#ef4444' },
  SCHOOL:  { label: 'ปฎิทินโรงเรียน',  icon: '🏫', defaultColor: '#10b981' },
};

// ── Browser Notification helper ──────────────────────────────────────────────
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const p = await Notification.requestPermission();
    return p === 'granted';
  }
  return false;
}

function scheduleNotification(title, body, fireAt) {
  const delay = new Date(fireAt) - Date.now();
  if (delay <= 0) return;
  setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  }, delay);
}

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const daysUntil = (date) => {
  const diff = new Date(date) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const DeadlineBadge = ({ days }) => {
  if (days < 0) return <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300">เกินกำหนด</span>;
  if (days === 0) return <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300">วันนี้!</span>;
  if (days <= 3) return <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">อีก {days} วัน</span>;
  return null;
};

const COLORS = ['#7c3aed', '#db2777', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

const Calendar = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const today = new Date();

  const [viewMode, setViewMode]       = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [calendarData, setCalendarData] = useState({ events: [], assignments: [] });
  const [loading, setLoading]         = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType]   = useState('ALL'); // ALL | EVENT | HOLIDAY | SCHOOL | ASSIGNMENT
  const [notifPermission, setNotifPermission] = useState(Notification?.permission || 'default');
  const [notifications, setNotifications]     = useState([]);
  const [showNotifPanel, setShowNotifPanel]   = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '', description: '', start_date: '', end_date: '',
    color: '#7c3aed', event_type: 'EVENT', is_all_day: false,
  });
  const [creating, setCreating]   = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/events/calendar', {
        params: { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 },
      });
      setCalendarData(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // โหลด upcoming notifications
  useEffect(() => {
    api.get('/events/upcoming?days=7').then(res => {
      const items = [];
      res.data.events.forEach(e => {
        const d = daysUntil(e.start_date);
        if (d >= 0 && d <= 3)
          items.push({ id: `e-${e.id}`, title: e.title, days: d, type: e.event_type, date: e.start_date, color: e.color });
      });
      res.data.assignments.forEach(a => {
        const d = daysUntil(a.due_date);
        const submitted = a.submissions?.length > 0;
        if (d >= 0 && d <= 3 && !submitted)
          items.push({ id: `a-${a.id}`, title: `📚 ${a.title}`, days: d, type: 'ASSIGNMENT', date: a.due_date, color: '#f59e0b' });
      });
      setNotifications(items.sort((a, b) => a.days - b.days));
    }).catch(() => {});
  }, []);

  // ---- Build calendar grid (month view) ----
  const buildMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  // ---- Build week grid ----
  const buildWeekDays = () => {
    const base = selectedDay || today;
    const day = base.getDay();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - day + i);
      return d;
    });
  };

  const getItemsForDay = (date, typeFilter = 'ALL') => {
    if (!date) return [];
    const items = [];
    if (typeFilter === 'ALL' || typeFilter === 'ASSIGNMENT') {
      calendarData.assignments.forEach(a => {
        if (isSameDay(new Date(a.due_date), date))
          items.push({ itemType: 'assignment', color: '#f59e0b', ...a });
      });
    }
    calendarData.events.forEach(e => {
      if (!isSameDay(new Date(e.start_date), date)) return;
      if (typeFilter !== 'ALL' && typeFilter !== e.event_type) return;
      const meta = EVENT_TYPE_META[e.event_type] || EVENT_TYPE_META.EVENT;
      items.push({ itemType: 'event', ...e, displayIcon: meta.icon });
    });
    return items;
  };

  // check if date is holiday
  const isHoliday = (date) => calendarData.events.some(e =>
    e.event_type === 'HOLIDAY' && isSameDay(new Date(e.start_date), date)
  );

  const handlePrev = () => {
    if (viewMode === 'month') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else {
      const base = selectedDay || today;
      const d = new Date(base);
      d.setDate(d.getDate() - 7);
      setSelectedDay(d);
    }
  };
  const handleNext = () => {
    if (viewMode === 'month') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else {
      const base = selectedDay || today;
      const d = new Date(base);
      d.setDate(d.getDate() + 7);
      setSelectedDay(d);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await api.post('/events', newEvent);
      setShowCreateModal(false);
      setNewEvent({ title: '', description: '', start_date: '', end_date: '', color: '#7c3aed' });
      await fetchData();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!confirm('ลบกิจกรรมนี้?')) return;
    try {
      await api.delete(`/events/${id}`);
      await fetchData();
      setSelectedDay(prev => prev); // re-render
    } catch { /* ignore */ }
  };

  const cells = buildMonthGrid();
  const weekDays = buildWeekDays();

  const selectedItems = selectedDay ? getItemsForDay(selectedDay, 'ALL') : [];

  // Upcoming deadlines (next 7 days)
  const upcoming = calendarData.assignments.filter(a => {
    const d = daysUntil(a.due_date);
    return d >= 0 && d <= 7;
  });

  const headerLabel = viewMode === 'month'
    ? `${MONTHS_TH[currentDate.getMonth()]} ${currentDate.getFullYear() + 543}`
    : (() => {
        const days = buildWeekDays();
        return `สัปดาห์ ${days[0].getDate()} - ${days[6].getDate()} ${MONTHS_TH[days[3].getMonth()]} ${days[3].getFullYear() + 543}`;
      })();

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      {/* Decorative blobs */}
      <div className="fixed top-0 right-0 w-96 h-96 rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(80px)' }} />
      <div className="fixed bottom-0 left-0 w-80 h-80 rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #db2777, transparent)', filter: 'blur(80px)' }} />

      {/* Navbar */}
      <nav className="px-6 py-4 flex justify-between items-center border-b border-white/10 sticky top-0 z-20"
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-white/60 hover:text-white text-sm transition-colors">
            ← Dashboard
          </button>
          <span className="text-white/30">|</span>
          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            📅 ปฏิทิน
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden border border-white/10">
            {['month','week'].map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode===v?'text-white':'text-white/40 hover:text-white/70'}`}
                style={viewMode===v?{background:'rgba(124,58,237,0.4)'}:{}}>
                {v==='month'?'เดือน':'สัปดาห์'}
              </button>
            ))}
          </div>

          {/* Notification bell */}
          <button onClick={async () => {
            if (notifPermission !== 'granted') {
              const ok = await requestNotificationPermission();
              setNotifPermission(ok ? 'granted' : 'denied');
              if (ok) new Notification('🔔 เปิดการแจ้งเตือนแล้ว', { body: 'คุณจะได้รับแจ้งเตือนก่อนกำหนดส่งงานและกิจกรรม' });
            }
            setShowNotifPanel(v => !v);
          }}
            className="relative px-3 py-2 rounded-xl border border-white/10 hover:bg-white/10 transition-all text-base"
            title="การแจ้งเตือน">
            🔔
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                {notifications.length}
              </span>
            )}
          </button>

          {ROLE_LEVEL[user?.role] >= ROLE_LEVEL['TEACHER'] && (
            <button onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              + เพิ่มกิจกรรม
            </button>
          )}
        </div>
      </nav>

      {/* ── Notification Panel ── */}
      {showNotifPanel && (
        <div className="absolute right-4 top-16 z-50 w-80 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ background: 'rgba(15,12,41,0.97)', backdropFilter: 'blur(16px)' }}>
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-semibold text-white text-sm">🔔 การแจ้งเตือน</h3>
            <div className="flex items-center gap-2">
              {notifPermission !== 'granted' && (
                <span className="text-xs text-yellow-400">ยังไม่ได้อนุญาต</span>
              )}
              <button onClick={() => setShowNotifPanel(false)} className="text-white/30 hover:text-white">✕</button>
            </div>
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-white/30 text-sm">ไม่มีกิจกรรมใน 3 วันข้างหน้า 🎉</div>
          ) : (
            <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
              {notifications.map(n => (
                <div key={n.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: n.color }}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{n.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: n.days === 0 ? '#f87171' : n.days === 1 ? '#fcd34d' : '#6ee7b7' }}>
                      {n.days === 0 ? '⚠ วันนี้!' : n.days === 1 ? '⏰ พรุ่งนี้!' : `📅 อีก ${n.days} วัน`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="px-4 py-2 border-b border-white/5 flex gap-2 flex-wrap"
        style={{ background: 'rgba(0,0,0,0.2)' }}>
        {[
          { id: 'ALL',        label: 'ทั้งหมด',            icon: '📅' },
          { id: 'ASSIGNMENT', label: 'การบ้าน',            icon: '📚', color: '#f59e0b' },
          { id: 'EVENT',      label: 'กิจกรรม',            icon: '📌', color: '#7c3aed' },
          { id: 'SCHOOL',     label: 'ปฎิทินโรงเรียน',     icon: '🏫', color: '#10b981' },
          { id: 'HOLIDAY',    label: 'วันหยุด',             icon: '🎌', color: '#ef4444' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilterType(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${filterType===f.id?'border-transparent text-white':'border-white/10 text-white/50 hover:text-white'}`}
            style={filterType===f.id ? { background: f.color ? `${f.color}30` : 'rgba(124,58,237,0.3)', borderColor: f.color || '#7c3aed' } : {}}>
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 flex gap-5" style={{ maxWidth: '100%' }}>
        {/* Main Calendar */}
        <div className="flex-1 min-w-0">
          {/* Month/Week navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={handlePrev}
              className="w-10 h-10 rounded-xl hover:bg-white/10 transition-colors text-white/70 hover:text-white text-2xl flex items-center justify-center">
              ‹
            </button>
            <h2 className="font-bold text-2xl text-white">{headerLabel}</h2>
            <button onClick={handleNext}
              className="w-10 h-10 rounded-xl hover:bg-white/10 transition-colors text-white/70 hover:text-white text-2xl flex items-center justify-center">
              ›
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-2 border-b border-white/10 pb-2">
            {DAYS.map((d, i) => (
              <div key={d} className={`text-center text-sm font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-white/60'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Month Grid */}
          {viewMode === 'month' && (
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((date, idx) => {
                if (!date) return <div key={idx} className="rounded-xl" style={{ minHeight: 110 }}/>;
                const items = getItemsForDay(date, filterType);
                const isToday    = isSameDay(date, today);
                const isSelected = selectedDay && isSameDay(date, selectedDay);
                const holiday    = isHoliday(date);
                const isSunday   = date.getDay() === 0;
                const isSaturday = date.getDay() === 6;
                return (
                  <div key={idx}
                    onClick={() => setSelectedDay(date)}
                    className={`rounded-xl p-2 cursor-pointer transition-all border ${
                      isSelected ? 'border-purple-400/70' : holiday ? 'border-red-500/20' : 'border-white/5 hover:border-white/20'
                    }`}
                    style={{
                      minHeight: 110,
                      background: isSelected ? 'rgba(124,58,237,0.18)'
                        : holiday ? 'rgba(239,68,68,0.06)'
                        : isToday ? 'rgba(255,255,255,0.07)'
                        : 'rgba(255,255,255,0.03)',
                    }}>
                    {/* Date number */}
                    <div className={`text-sm font-bold mb-1.5 w-8 h-8 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/40'
                      : isSunday ? 'text-red-400'
                      : isSaturday ? 'text-blue-400'
                      : 'text-white/80'
                    }`}>
                      {date.getDate()}
                    </div>
                    {/* Events */}
                    <div className="space-y-1">
                      {items.slice(0, 3).map((item, i) => (
                        <div key={i} className="truncate text-xs px-1.5 py-0.5 rounded-md font-medium"
                          style={{ background: `${item.color}28`, color: item.color, fontSize: '11px' }}>
                          {item.itemType === 'assignment' ? '📚' : (item.displayIcon || '📌')} {item.title}
                        </div>
                      ))}
                      {items.length > 3 && (
                        <div className="text-xs text-white/30 px-1.5">+{items.length - 3} อื่นๆ</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Week View */}
          {viewMode === 'week' && (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((date, i) => {
                const items = getItemsForDay(date);
                const isToday = isSameDay(date, today);
                const isSelected = selectedDay && isSameDay(date, selectedDay);
                return (
                  <div key={i}
                    onClick={() => setSelectedDay(date)}
                    className={`rounded-xl p-3 cursor-pointer transition-all border ${
                      isSelected ? 'border-purple-400/60' : 'border-white/5 hover:border-white/20'
                    }`}
                    style={{
                      minHeight: 160,
                      background: isSelected ? 'rgba(124,58,237,0.15)' : isToday ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                    }}>
                    <div className="text-center mb-3">
                      <div className={`text-sm font-semibold mb-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-white/50'}`}>
                        {DAYS[i]}
                      </div>
                      <div className={`text-lg font-bold w-9 h-9 mx-auto flex items-center justify-center rounded-full ${
                        isToday ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/40' : 'text-white'
                      }`}>
                        {date.getDate()}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {items.map((item, j) => (
                        <div key={j} className="text-xs px-1.5 py-1 rounded-lg truncate font-medium"
                          style={{ background: `${item.color}25`, color: item.color, fontSize: '11px' }}>
                          {item.type === 'assignment' ? '📚' : '📌'} {item.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 flex-shrink-0 space-y-4">
          {/* Selected day detail */}
          {selectedDay && (
            <div className="rounded-2xl p-5 border border-white/10"
              style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
              <h3 className="font-bold text-white mb-4 text-base">
                {selectedDay.getDate()} {MONTHS_TH[selectedDay.getMonth()]} {selectedDay.getFullYear() + 543}
              </h3>
              {selectedItems.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-5">ไม่มีกิจกรรมวันนี้</p>
              ) : (
                <div className="space-y-3">
                  {selectedItems.map((item, i) => (
                    <div key={i} className="p-3 rounded-xl border border-white/5"
                      style={{ background: `${item.color}15` }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">
                            {item.type === 'assignment' ? '📚' : '📌'} {item.title}
                          </p>
                          {item.type === 'assignment' && (
                            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                              <DeadlineBadge days={daysUntil(item.due_date)} />
                              <span className="text-xs text-white/40">{item.max_score} คะแนน</span>
                            </div>
                          )}
                          {item.type === 'assignment' && (
                            <button onClick={() => navigate(`/assignments/${item.id}`)}
                              className="mt-2 text-sm text-purple-400 hover:text-purple-300 font-medium">
                              ดูรายละเอียด →
                            </button>
                          )}
                          {item.type === 'event' && item.description && (
                            <p className="text-sm text-white/50 mt-1 line-clamp-2">{item.description}</p>
                          )}
                        </div>
                        {item.type === 'event' && user?.role === 'TEACHER' && item.created_by === user.id && (
                          <button onClick={() => handleDeleteEvent(item.id)}
                            className="text-white/20 hover:text-red-400 transition-colors text-sm flex-shrink-0 p-1">
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="rounded-2xl p-4 border border-white/10"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <h4 className="text-sm font-semibold text-white mb-3">สัญลักษณ์</h4>
            <div className="space-y-2">
              {[
                { color: '#f59e0b', icon: '📚', label: 'การบ้าน/กำหนดส่ง' },
                { color: '#7c3aed', icon: '📌', label: 'กิจกรรมทั่วไป' },
                { color: '#10b981', icon: '🏫', label: 'ปฎิทินโรงเรียน' },
                { color: '#ef4444', icon: '🎌', label: 'วันหยุดนักขัตฤกษ์' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: l.color }}/>
                  <span className="text-xs text-white/60">{l.icon} {l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming deadlines */}
          <div className="rounded-2xl p-5 border border-white/10"
            style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
            <h3 className="font-bold text-white mb-4 text-base">⏰ Deadline ใกล้มา</h3>
            {loading ? (
              <p className="text-white/30 text-sm text-center py-4">กำลังโหลด...</p>
            ) : upcoming.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-4">ไม่มี deadline ใน 7 วันข้างหน้า 🎉</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(a => {
                  const days = daysUntil(a.due_date);
                  return (
                    <div key={a.id}
                      onClick={() => navigate(`/assignments/${a.id}`)}
                      className="p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white truncate flex-1 font-medium">{a.title}</p>
                        <DeadlineBadge days={days} />
                      </div>
                      <p className="text-xs text-white/40 mt-1">
                        {new Date(a.due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="w-full max-w-md rounded-3xl p-6 border border-white/10"
            style={{ background: 'rgba(22,33,62,0.95)', backdropFilter: 'blur(20px)' }}>
            <h3 className="text-lg font-bold text-white mb-1">📅 เพิ่มกิจกรรม</h3>
            <p className="text-white/40 text-sm mb-4">เพิ่มกิจกรรม วันหยุด หรือปฎิทินโรงเรียน</p>

            {/* Event type selector */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {Object.entries(EVENT_TYPE_META).map(([k, m]) => (
                <button key={k} type="button"
                  onClick={() => setNewEvent(e => ({ ...e, event_type: k, color: m.defaultColor }))}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all ${newEvent.event_type===k?'text-white':'text-white/40 hover:text-white/70'}`}
                  style={newEvent.event_type===k
                    ? { background: `${m.defaultColor}25`, borderColor: `${m.defaultColor}60`, color: m.defaultColor }
                    : { borderColor: 'rgba(255,255,255,0.1)', background: 'transparent' }}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            {createError && (
              <div className="mb-4 p-3 rounded-xl text-sm text-red-300 border border-red-500/30 bg-red-500/10">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">ชื่อกิจกรรม *</label>
                <input type="text" required value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="เช่น สอบกลางภาค, วันทัศนศึกษา"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">คำอธิบาย</label>
                <textarea value={newEvent.description}
                  onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                  rows={2} placeholder="รายละเอียดเพิ่มเติม..."
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-400 text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">วันเริ่มต้น *</label>
                  <input type="datetime-local" required value={newEvent.start_date}
                    onChange={e => setNewEvent({ ...newEvent, start_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-400 text-sm"
                    style={{ colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">วันสิ้นสุด</label>
                  <input type="datetime-local" value={newEvent.end_date}
                    onChange={e => setNewEvent({ ...newEvent, end_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-400 text-sm"
                    style={{ colorScheme: 'dark' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-2">สีกิจกรรม</label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c} type="button"
                      onClick={() => setNewEvent({ ...newEvent, color: c })}
                      className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${newEvent.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent scale-110' : ''}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 rounded-xl font-medium text-white text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>
                  {creating ? 'กำลังสร้าง...' : '✨ สร้างกิจกรรม'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
