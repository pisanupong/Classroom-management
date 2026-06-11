import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const ROLE_LEVEL = { STUDENT: 0, PARENT: 0, STAFF: 1, CLASS_ADMIN: 1, TEACHER: 2, ADMIN: 3, SUPER_USER: 4 };

const ROLE_META = {
  STUDENT:     { label: 'นักเรียน',       icon: '🎒', color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)',  border: 'rgba(14,165,233,0.3)'  },
  CLASS_ADMIN: { label: 'ประธานนักเรียน', icon: '📋', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)' },
  TEACHER:     { label: 'ครู',            icon: '👩‍🏫', color: '#7c3aed', bg: 'rgba(124,58,237,0.15)', border: 'rgba(124,58,237,0.3)' },
  ADMIN:       { label: 'Admin',          icon: '🛡️',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' },
  SUPER_USER:  { label: 'Super User',     icon: '👑',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.3)'  },
};

const RoleBadge = ({ role }) => {
  const m = ROLE_META[role] || ROLE_META.STUDENT;
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium border inline-flex items-center gap-1"
      style={{ background: m.bg, color: m.color, borderColor: m.border }}>
      {m.icon} {m.label}
    </span>
  );
};

const EditModal = ({ target, actorRole, onClose, onSave }) => {
  const actorLevel = ROLE_LEVEL[actorRole] ?? 0;
  const [form, setForm] = useState({
    name: target.name,
    role: target.role,
    student_number: target.student_number || '',
    password: target.role === 'PARENT' ? 'acp123' : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Roles this actor can assign (must be strictly below actor's own level)
  const assignableRoles = Object.keys(ROLE_META).filter(r => ROLE_LEVEL[r] < actorLevel);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { name: form.name, role: form.role, student_number: form.student_number };
      if (form.password) payload.password = form.password;
      await onSave(target.id, payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-3xl p-6 border border-white/10 text-white"
        style={{ background: 'rgba(15,28,60,0.98)', backdropFilter: 'blur(20px)' }}>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg"
            style={{ background: ROLE_META[target.role]?.bg }}>
            {target.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-white">✏️ แก้ไขผู้ใช้</h3>
            <p className="text-white/40 text-xs">@{target.username}</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 rounded-xl text-sm text-red-300 bg-red-500/10 border border-red-500/30">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5">ชื่อ-นามสกุล</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400" />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-2">กำหนด Role</label>
            <div className="grid grid-cols-2 gap-2">
              {assignableRoles.map(r => {
                const m = ROLE_META[r];
                const active = form.role === r;
                return (
                  <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border"
                    style={{
                      background: active ? m.bg : 'rgba(255,255,255,0.05)',
                      color: active ? m.color : 'rgba(255,255,255,0.4)',
                      borderColor: active ? m.border : 'transparent',
                    }}>
                    <span>{m.icon}</span> {m.label}
                  </button>
                );
              })}
            </div>
            {assignableRoles.length === 0 && (
              <p className="text-xs text-white/30 italic">ไม่สามารถเปลี่ยน role ได้</p>
            )}
          </div>

          {form.role === 'STUDENT' && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5">รหัสนักเรียน</label>
              <input type="text" value={form.student_number}
                onChange={e => setForm({ ...form, student_number: e.target.value })}
                placeholder="เช่น 12345"
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400 placeholder-white/20" />
            </div>
          )}

          <div>
            <label className="block text-xs text-white/50 mb-1.5">รีเซ็ตรหัสผ่าน (เว้นว่างถ้าไม่เปลี่ยน)</label>
            <input type="password" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="รหัสผ่านใหม่..."
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400 placeholder-white/20" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl font-medium text-white text-sm disabled:opacity-50 hover:scale-[1.02] transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>
              {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UserManagement = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const actorLevel = ROLE_LEVEL[user?.role] ?? 0;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // unused but kept for state compat
  const [msg, setMsg] = useState({ text: '', type: 'ok' });

  useEffect(() => {
    if (user && actorLevel < ROLE_LEVEL['ADMIN']) navigate('/dashboard');
  }, [user, actorLevel, navigate]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users', { params: { search: search || undefined, role: roleFilter || undefined } });
      setUsers(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [search, roleFilter]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const flash = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 3000);
  };

  const handleUpdate = async (id, data) => {
    const res = await api.put(`/admin/users/${id}`, data);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...res.data } : u));
    flash('อัปเดตสำเร็จ ✅');
  };

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers(prev => prev.filter(u => u.id !== id));
      setDeleteConfirm(null);
      flash('ลบผู้ใช้สำเร็จ');
    } catch (err) {
      flash(err.response?.data?.message || 'เกิดข้อผิดพลาด', 'err');
    } finally { setDeleting(false); }
  };

  // Count per role
  const counts = Object.keys(ROLE_META).reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {});

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <div className="fixed top-0 right-0 w-96 h-96 rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(80px)' }} />

      {/* Navbar */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-white/10 sticky top-0 z-20"
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-white/60 hover:text-white text-sm transition-colors">
            ← Dashboard
          </button>
          <span className="text-white/30">|</span>
          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            👥 จัดการผู้ใช้
          </h1>
        </div>
        <RoleBadge role={user?.role} />
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(ROLE_META).map(([role, m]) => (
            <div key={role} className="rounded-2xl p-4 border border-white/10 text-center"
              style={{ background: m.bg }}>
              <p className="text-2xl">{m.icon}</p>
              <p className="text-xl font-bold mt-1" style={{ color: m.color }}>{counts[role] || 0}</p>
              <p className="text-xs text-white/50 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Feedback */}
        {msg.text && (
          <div className={`p-3 rounded-xl text-sm border ${msg.type === 'err'
            ? 'bg-red-500/10 border-red-500/30 text-red-300'
            : 'bg-green-500/10 border-green-500/30 text-green-300'}`}>
            {msg.text}
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, username, รหัสนักเรียน..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-400" />
          </div>
          <div className="flex rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
            {[['', 'ทั้งหมด'], ...Object.entries(ROLE_META).map(([r, m]) => [r, `${m.icon} ${m.label}`])].map(([val, label]) => (
              <button key={val} onClick={() => setRoleFilter(val)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${roleFilter === val ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
                style={roleFilter === val ? { background: 'rgba(124,58,237,0.35)' } : {}}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
          <div className="grid grid-cols-12 px-5 py-3 border-b border-white/5 text-xs text-white/30 font-medium uppercase tracking-wide">
            <div className="col-span-4">ชื่อ / Username</div>
            <div className="col-span-3">Role</div>
            <div className="col-span-2">รหัสนักเรียน</div>
            <div className="col-span-1 text-center">คะแนน</div>
            <div className="col-span-2 text-right">จัดการ</div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-white/30 text-sm">กำลังโหลด...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-white/30 text-sm">ไม่พบผู้ใช้</div>
          ) : (
            users.map((u, idx) => {
              const m = ROLE_META[u.role] || ROLE_META.STUDENT;
              const canManage = ROLE_LEVEL[u.role] < actorLevel && u.id !== user?.id;
              return (
                <div key={u.id}
                  className={`grid grid-cols-12 px-5 py-4 items-center hover:bg-white/5 transition-colors ${idx !== users.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ background: m.bg, color: m.color }}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{u.name}</p>
                      <p className="text-xs text-white/30">@{u.username}</p>
                    </div>
                  </div>

                  <div className="col-span-3"><RoleBadge role={u.role} /></div>

                  <div className="col-span-2">
                    <span className="text-sm text-white/40">{u.student_number || '—'}</span>
                  </div>

                  <div className="col-span-1 text-center">
                    <span className="text-sm font-bold text-emerald-400">{u.total_points}</span>
                  </div>

                  <div className="col-span-2 flex justify-end gap-1.5">
                    {canManage ? (
                      <>
                        <button onClick={() => setEditTarget(u)}
                          className="px-2.5 py-1.5 rounded-lg text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 transition-all">
                          ✏️
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-white/20 italic">
                        {u.id === user?.id ? 'คุณ' : 'ไม่มีสิทธิ์'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Permission hint */}
        <div className="rounded-2xl p-4 border border-white/5 text-xs text-white/30"
          style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="font-medium text-white/40 mb-2">ตารางสิทธิ์การจัดการ</p>
          <div className="grid grid-cols-2 gap-1">
            <span>👑 Super User → จัดการได้ทุก role</span>
            <span>🛡️ Admin → จัดการ Teacher ลงไป</span>
            <span>👩‍🏫 Teacher → ไม่มีสิทธิ์จัดการ User</span>
            <span>🎒 Student → ไม่มีสิทธิ์จัดการ User</span>
          </div>
        </div>
      </main>

      {editTarget && (
        <EditModal target={editTarget} actorRole={user?.role}
          onClose={() => setEditTarget(null)} onSave={handleUpdate} />
      )}

    </div>
  );
};

export default UserManagement;
