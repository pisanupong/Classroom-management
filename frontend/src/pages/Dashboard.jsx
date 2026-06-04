import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

// ─── Constants ───────────────────────────────────────────────────────────────
const ROLE_META = {
  STUDENT:     { label: 'นักเรียน',       icon: '🎒', color: '#0ea5e9' },
  CLASS_ADMIN: { label: 'ประธานนักเรียน', icon: '📋', color: '#10b981' },
  TEACHER:     { label: 'ครู',            icon: '👩‍🏫', color: '#7c3aed' },
  ADMIN:       { label: 'Admin',          icon: '🛡️',  color: '#f59e0b' },
  SUPER_USER:  { label: 'Super User',     icon: '👑',  color: '#ef4444' },
};
const ROLE_LEVEL = { STUDENT: 0, CLASS_ADMIN: 1, TEACHER: 2, ADMIN: 3, SUPER_USER: 4 };
const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const DAYS_SHORT = ['อา','จ','อ','พ','พฤ','ศ','ส'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const daysUntil = d => Math.ceil((new Date(d) - new Date()) / 86400000);
const isSameDay = (a, b) => {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};
const avatarColor = (name, role) => {
  const colors = { STUDENT: ['#0ea5e9','#38bdf8'], TEACHER: ['#7c3aed','#a855f7'], ADMIN: ['#f59e0b','#fbbf24'], SUPER_USER: ['#ef4444','#f87171'] };
  return colors[role] || colors.STUDENT;
};
const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'เมื่อกี้';
  if (s < 3600) return `${Math.floor(s/60)} นาทีที่แล้ว`;
  return `${Math.floor(s/3600)} ชม.ที่แล้ว`;
};

// ─── Sub-components ──────────────────────────────────────────────────────────
const Avatar = ({ name, role, size = 36, online = false }) => {
  const [c1, c2] = avatarColor(name, role);
  return (
    <div className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full flex items-center justify-center font-bold text-white select-none"
        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, fontSize: size * 0.38 }}>
        {name?.charAt(0)?.toUpperCase()}
      </div>
      {online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#16213e]" />}
    </div>
  );
};

const DeadlinePill = ({ days }) => {
  if (days < 0)  return <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-300 border border-red-500/30">เกินกำหนด</span>;
  if (days === 0) return <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 animate-pulse">วันนี้!</span>;
  if (days <= 3)  return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">อีก {days} วัน</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/40">อีก {days} วัน</span>;
};

// Mini Calendar
const MiniCalendar = ({ assignments, events }) => {
  const today = new Date();
  const [cur, setCur] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = cur.getFullYear(), month = cur.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))];
  while (cells.length % 7) cells.push(null);

  const getDots = (date) => {
    if (!date) return [];
    const dots = [];
    if (assignments?.some(a => isSameDay(a.due_date, date))) dots.push('#f59e0b');
    if (events?.some(e => isSameDay(e.start_date, date))) dots.push('#7c3aed');
    return dots;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCur(new Date(year, month - 1, 1))} className="text-white/40 hover:text-white px-1">‹</button>
        <span className="text-xs font-semibold text-white">{MONTHS_TH[month]} {year + 543}</span>
        <button onClick={() => setCur(new Date(year, month + 1, 1))} className="text-white/40 hover:text-white px-1">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_SHORT.map((d, i) => (
          <div key={d} className={`text-center text-xs pb-1 ${i === 0 ? 'text-red-400' : 'text-white/30'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date, i) => {
          const dots = getDots(date);
          const isToday = date && isSameDay(date, today);
          return (
            <div key={i} className="aspect-square flex flex-col items-center justify-center rounded-lg relative">
              {date && (
                <>
                  <span className={`text-xs leading-none ${isToday ? 'w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold' : 'text-white/60'}`}>
                    {date.getDate()}
                  </span>
                  {dots.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dots.slice(0, 2).map((c, j) => (
                        <span key={j} className="w-1 h-1 rounded-full" style={{ background: c }} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 text-xs text-white/30">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> การบ้าน</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> กิจกรรม</span>
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const isTeacher = ROLE_LEVEL[user?.role] >= ROLE_LEVEL['TEACHER'];

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedAssignment, setExpandedAssignment] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const NAV_ITEMS = [
    { path: '/assignments', icon: '📚', label: 'การบ้าน', roles: ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'] },
    { path: '/calendar', icon: '📅', label: 'ปฏิทิน', roles: ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'] },
    { path: '/daily-homework', icon: '📖', label: 'จดการบ้าน', roles: ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'] },
    { path: '/admin/users', icon: '👥', label: 'จัดการ User', roles: ['ADMIN','SUPER_USER'] },
    { path: '/quiz', icon: '🎯', label: 'แบบฝึกหัด', roles: ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'] },
    { path: '/character', icon: '🎨', label: 'ตัวละคร', roles: ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'] },
    { path: '/chat', icon: '💬', label: 'สนทนา', roles: ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'] },
    { path: '/treasury', icon: '💰', label: 'เงินห้อง', roles: ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'] },
    { path: '/rewards', icon: '🎁', label: 'ของรางวัล', roles: ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'] },
    { path: '/vocab-battle', icon: '⚔️', label: 'Vocab Battle', roles: ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'] },
    { path: '/leaderboard', icon: '🕹️', label: 'Ranking', roles: ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'] },
  ].filter(n => n.roles.includes(user?.role));

  const rm = ROLE_META[user?.role] || ROLE_META.STUDENT;

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 40%, #16213e 100%)' }}>
      {/* Decorative blobs */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(120px)' }} />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #db2777, transparent)', filter: 'blur(100px)' }} />

      {/* ── Topbar ── */}
      <nav className="px-5 py-0 flex items-stretch justify-between border-b border-white/10 sticky top-0 z-30"
        style={{ background: 'rgba(15,12,41,0.92)', backdropFilter: 'blur(20px)', minHeight: 56 }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 pr-4 border-r border-white/10 flex-shrink-0">
          <span className="text-2xl">🏫</span>
          <span className="font-extrabold text-white text-base tracking-wide hidden sm:block">Classroom</span>
        </div>

        {/* Nav — scrollable on small screens */}
        <div className="flex items-stretch gap-0 overflow-x-auto flex-1 px-2 scrollbar-hide">
          {NAV_ITEMS.map(n => (
            <button key={n.path} onClick={() => navigate(n.path)}
              className="flex items-center gap-1.5 px-3 py-0 text-sm font-medium whitespace-nowrap transition-all border-b-2 border-transparent hover:border-purple-400 hover:text-white flex-shrink-0"
              style={{ color: 'rgba(255,255,255,0.65)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}>
              <span className="text-base">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </div>

        {/* User */}
        <div className="flex items-center gap-3 pl-4 border-l border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Avatar name={user?.name} role={user?.role} size={36} online />
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-white leading-none">{user?.name}</p>
              <p className="text-xs leading-none mt-1 font-medium" style={{ color: rm.color }}>
                {rm.icon} {rm.label}
              </p>
            </div>
          </div>
          <button onClick={logout}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20">
            ออก
          </button>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto px-4 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-white/30">กำลังโหลด...</div>
        ) : (
          <div className="grid grid-cols-12 gap-4">

            {/* ═══ LEFT COLUMN ═══ */}
            <div className="col-span-12 lg:col-span-8 space-y-4">

              {/* Welcome + Stats */}
              <div className="rounded-2xl p-5 border border-white/10"
                style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-white">สวัสดี, {user?.name} {rm.icon}</h2>
                    <p className="text-white/40 text-sm mt-0.5">
                      {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {[
                      { label: 'การบ้านทั้งหมด', value: data?.stats?.totalAssignments ?? 0, color: '#7c3aed' },
                      { label: 'ส่งแล้ว', value: data?.stats?.totalSubmissions ?? 0, color: '#10b981' },
                      { label: 'ออนไลน์', value: data?.stats?.onlineCount ?? 0, color: '#f59e0b' },
                      ...(!isTeacher ? [{ label: 'คะแนนรวม', value: user?.total_points ?? 0, color: '#0ea5e9' }] : []),
                    ].map((s, i) => (
                      <div key={i} className="text-center px-4 py-2 rounded-xl border border-white/10"
                        style={{ background: `${s.color}15` }}>
                        <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs text-white/40">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Deadline Alerts ── */}
              {data?.upcomingDeadlines?.length > 0 && (
                <div className="rounded-2xl p-4 border border-yellow-500/30"
                  style={{ background: 'rgba(245,158,11,0.08)', backdropFilter: 'blur(10px)' }}>
                  <h3 className="text-sm font-semibold text-yellow-300 mb-3 flex items-center gap-2">
                    ⏰ กำหนดส่งใกล้มา ({data.upcomingDeadlines.length} รายการ)
                  </h3>
                  <div className="space-y-2">
                    {data.upcomingDeadlines.map(a => {
                      const days = daysUntil(a.due_date);
                      const mySubmit = a.submissions?.find(s => s.student_id === user?.id);
                      return (
                        <div key={a.id} onClick={() => navigate(`/assignments/${a.id}`)}
                          className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                          <div>
                            <p className="text-sm font-medium text-white">{a.title}</p>
                            <p className="text-xs text-white/40">{a.teacher?.name} · {a.max_score} คะแนน</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isTeacher && mySubmit && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">ส่งแล้ว</span>
                            )}
                            {!isTeacher && !mySubmit && <DeadlinePill days={days} />}
                            {isTeacher && <DeadlinePill days={days} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Assignment Submissions ── */}
              <div className="rounded-2xl border border-white/10 overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}>
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    📚 สถานะการส่งการบ้าน
                  </h3>
                  <button onClick={() => navigate('/assignments')} className="text-xs text-purple-400 hover:text-purple-300">
                    ดูทั้งหมด →
                  </button>
                </div>

                {!data?.assignments?.length ? (
                  <div className="py-10 text-center text-white/30 text-sm">ยังไม่มีการบ้าน</div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {data.assignments.map(a => {
                      const isExpanded = expandedAssignment === a.id;
                      const submitted = a.submissions?.length ?? 0;
                      const graded = a.submissions?.filter(s => s.status === 'GRADED').length ?? 0;
                      const days = daysUntil(a.due_date);
                      const mySubmit = a.submissions?.find(s => s.student_id === user?.id);

                      return (
                        <div key={a.id}>
                          <div onClick={() => setExpandedAssignment(isExpanded ? null : a.id)}
                            className="px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-white truncate">{a.title}</span>
                                  <DeadlinePill days={days} />
                                  {!isTeacher && mySubmit && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                      mySubmit.status === 'GRADED'
                                        ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                        : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                                    }`}>
                                      {mySubmit.status === 'GRADED' ? `✓ ${mySubmit.score_given}/${a.max_score}` : 'รอตรวจ'}
                                    </span>
                                  )}
                                  {!isTeacher && !mySubmit && days >= 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/40 border border-white/10">ยังไม่ส่ง</span>
                                  )}
                                </div>
                                <p className="text-xs text-white/30 mt-0.5">
                                  {a.teacher?.name} · กำหนดส่ง {new Date(a.due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>

                              {isTeacher && (
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-white">{submitted}</p>
                                    <p className="text-xs text-white/30">ส่งแล้ว</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-green-400">{graded}</p>
                                    <p className="text-xs text-white/30">ตรวจแล้ว</p>
                                  </div>
                                  <span className="text-white/20">{isExpanded ? '▲' : '▼'}</span>
                                </div>
                              )}
                            </div>

                            {/* Submission progress bar (teacher) */}
                            {isTeacher && submitted > 0 && (
                              <div className="mt-2 flex gap-1 items-center">
                                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all"
                                    style={{ width: `${(graded / submitted) * 100}%`, background: 'linear-gradient(90deg, #7c3aed, #10b981)' }} />
                                </div>
                                <span className="text-xs text-white/30">{graded}/{submitted}</span>
                              </div>
                            )}
                          </div>

                          {/* Expanded: show who submitted */}
                          {isExpanded && isTeacher && (
                            <div className="px-5 pb-4 bg-white/3">
                              {!a.submissions?.length ? (
                                <p className="text-xs text-white/30 text-center py-3">ยังไม่มีนักเรียนส่งงาน</p>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {a.submissions.map(s => (
                                    <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg"
                                      style={{ background: 'rgba(255,255,255,0.04)' }}>
                                      <Avatar name={s.student?.name} role="STUDENT" size={28} />
                                      <div className="min-w-0">
                                        <p className="text-xs text-white truncate">{s.student?.name}</p>
                                        <p className="text-xs text-white/30">{s.student?.student_number || '—'}</p>
                                      </div>
                                      <span className={`ml-auto text-xs font-bold flex-shrink-0 ${s.status === 'GRADED' ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {s.status === 'GRADED' ? s.score_given : '⏳'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button onClick={() => navigate(`/assignments/${a.id}`)}
                                className="mt-3 text-xs text-purple-400 hover:text-purple-300 w-full text-center">
                                จัดการการบ้าน →
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ RIGHT COLUMN ═══ */}
            <div className="col-span-12 lg:col-span-4 space-y-4">

              {/* Mini Calendar */}
              <div className="rounded-2xl p-4 border border-white/10"
                style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  📅 ปฏิทิน
                  <button onClick={() => navigate('/calendar')} className="ml-auto text-xs text-purple-400 hover:text-purple-300 font-normal">
                    ขยาย →
                  </button>
                </h3>
                <MiniCalendar assignments={data?.assignments} events={data?.calendarEvents} />
              </div>

              {/* Online Users */}
              <div className="rounded-2xl p-4 border border-white/10"
                style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  🟢 ออนไลน์ตอนนี้
                  <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                    {data?.onlineUsers?.length ?? 0} คน
                  </span>
                </h3>
                {!data?.onlineUsers?.length ? (
                  <p className="text-xs text-white/30 text-center py-3">ไม่มีผู้ใช้ออนไลน์</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {data.onlineUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-2.5">
                        <Avatar name={u.name} role={u.role} size={28} online />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{u.name}</p>
                          <p className="text-xs text-white/30">{ROLE_META[u.role]?.label}</p>
                        </div>
                        <span className="text-xs text-white/20 flex-shrink-0">{timeAgo(u.last_active)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Leaderboard */}
              <div className="rounded-2xl p-4 border border-white/10"
                style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  🏆 อันดับคะแนน
                </h3>
                {!data?.leaderboard?.length ? (
                  <p className="text-xs text-white/30 text-center py-3">ยังไม่มีข้อมูล</p>
                ) : (
                  <div className="space-y-2">
                    {data.leaderboard.map((u, i) => {
                      const medals = ['🥇', '🥈', '🥉'];
                      const isMe = u.id === user?.id;
                      return (
                        <div key={u.id}
                          className={`flex items-center gap-2.5 p-2 rounded-xl transition-colors ${isMe ? 'border border-purple-400/30' : ''}`}
                          style={isMe ? { background: 'rgba(124,58,237,0.1)' } : {}}>
                          <span className="text-base w-5 text-center flex-shrink-0">
                            {medals[i] || <span className="text-xs text-white/30">{i + 1}</span>}
                          </span>
                          <Avatar name={u.name} role="STUDENT" size={28} online={data?.onlineUsers?.some(o => o.id === u.id)} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${isMe ? 'text-purple-300' : 'text-white'}`}>
                              {u.name} {isMe && '(คุณ)'}
                            </p>
                            <p className="text-xs text-white/30">{u.student_number || '—'}</p>
                          </div>
                          <span className="text-sm font-bold text-emerald-400 flex-shrink-0">{u.total_points}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
