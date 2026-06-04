import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import api from '../services/api';

const ROLE_LEVEL = { STUDENT:0, CLASS_ADMIN:1, TEACHER:2, ADMIN:3, SUPER_USER:4 };
const ROLE_META  = {
  STUDENT:     { label:'นักเรียน',        icon:'🎒', color:'#0ea5e9', bg:'rgba(14,165,233,0.15)',  border:'rgba(14,165,233,0.3)'  },
  CLASS_ADMIN: { label:'ประธานนักเรียน',  icon:'📋', color:'#10b981', bg:'rgba(16,185,129,0.15)', border:'rgba(16,185,129,0.3)' },
  TEACHER:     { label:'ครู',             icon:'👩‍🏫', color:'#7c3aed', bg:'rgba(124,58,237,0.15)', border:'rgba(124,58,237,0.3)' },
  ADMIN:       { label:'Admin',           icon:'🛡️',  color:'#f59e0b', bg:'rgba(245,158,11,0.15)', border:'rgba(245,158,11,0.3)' },
  SUPER_USER:  { label:'Super User',      icon:'👑',  color:'#ef4444', bg:'rgba(239,68,68,0.15)',  border:'rgba(239,68,68,0.3)'  },
};

const ALL_ROLES   = ['STUDENT','CLASS_ADMIN','TEACHER','ADMIN','SUPER_USER'];
const MENU_DEFS   = [
  { key:'assignments',    icon:'📚', label:'การบ้าน'       },
  { key:'calendar',       icon:'📅', label:'ปฏิทิน'        },
  { key:'daily_homework', icon:'📖', label:'จดการบ้าน'     },
  { key:'quiz',           icon:'🎯', label:'แบบฝึกหัด'     },
  { key:'character',      icon:'🎨', label:'ตัวละคร'       },
  { key:'chat',           icon:'💬', label:'สนทนา'         },
  { key:'treasury',       icon:'💰', label:'เงินห้อง'      },
  { key:'rewards',        icon:'🎁', label:'ของรางวัล'     },
  { key:'vocab_battle',   icon:'⚔️', label:'Vocab Battle'  },
  { key:'leaderboard',    icon:'🕹️', label:'Ranking'       },
];

const GRADIENT_PRESETS = [
  { label:'Purple Dream',  value:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' },
  { label:'Ocean Blue',    value:'linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%)' },
  { label:'Sunset',        value:'linear-gradient(135deg,#f59e0b 0%,#ef4444 100%)' },
  { label:'Forest',        value:'linear-gradient(135deg,#10b981 0%,#059669 100%)' },
  { label:'Midnight',      value:'linear-gradient(135deg,#1e1b4b 0%,#0f172a 100%)' },
  { label:'Rose Gold',     value:'linear-gradient(135deg,#f472b6 0%,#db2777 50%,#9333ea 100%)' },
  { label:'Aurora',        value:'linear-gradient(135deg,#0ea5e9 0%,#6366f1 50%,#ec4899 100%)' },
  { label:'Charcoal',      value:'linear-gradient(135deg,#374151 0%,#111827 100%)' },
];

/* ══════════════════ CREATE USER MODAL ══════════════════ */
const CreateUserModal = ({ actorLevel, onClose, onCreated }) => {
  const assignableRoles = Object.keys(ROLE_META).filter(r => ROLE_LEVEL[r] < actorLevel);
  const [form, setForm]   = useState({ username:'', name:'', password:'', role:'STUDENT', student_number:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res = await api.post('/admin/users', form);
      onCreated(res.data);
      onClose();
    } catch (err) { setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.8)', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-3xl p-6 border text-white"
        style={{ background:'rgba(15,28,60,0.98)', borderColor:'rgba(255,255,255,0.1)' }}>
        <h3 className="font-bold text-lg mb-4">➕ สร้างผู้ใช้ใหม่</h3>
        {error && <div className="mb-4 p-3 rounded-xl text-sm text-red-300 bg-red-500/10 border border-red-500/30">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color:'rgba(255,255,255,0.5)' }}>Username *</label>
              <input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} required
                className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none"
                style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}/>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color:'rgba(255,255,255,0.5)' }}>รหัสนักเรียน</label>
              <input value={form.student_number} onChange={e=>setForm({...form,student_number:e.target.value})}
                placeholder="ถ้ามี"
                className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none placeholder-white/20"
                style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}/>
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color:'rgba(255,255,255,0.5)' }}>ชื่อ-นามสกุล *</label>
            <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required
              className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none"
              style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}/>
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color:'rgba(255,255,255,0.5)' }}>รหัสผ่าน *</label>
            <input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required
              className="w-full px-3 py-2.5 rounded-xl text-white text-sm focus:outline-none"
              style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}/>
          </div>
          <div>
            <label className="block text-xs mb-2" style={{ color:'rgba(255,255,255,0.5)' }}>Role</label>
            <div className="grid grid-cols-2 gap-2">
              {assignableRoles.map(r => {
                const m = ROLE_META[r]; const active = form.role === r;
                return (
                  <button key={r} type="button" onClick={() => setForm({...form, role:r})}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all"
                    style={{ background:active?m.bg:'rgba(255,255,255,0.05)', color:active?m.color:'rgba(255,255,255,0.4)', borderColor:active?m.border:'transparent' }}>
                    {m.icon} {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm border border-white/10 text-white/50 hover:text-white">ยกเลิก</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl font-medium text-white text-sm disabled:opacity-50"
              style={{ background:'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              {saving ? 'กำลังสร้าง...' : '➕ สร้างผู้ใช้'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════ IMPORT EXCEL MODAL ══════════════════ */
const ImportModal = ({ onClose, onImported }) => {
  const fileRef             = React.useRef(null);
  const [file, setFile]     = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError]   = useState('');

  const handleFile = f => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls','csv'].includes(ext)) { setError('รองรับเฉพาะ .xlsx, .xls, .csv'); return; }
    setFile(f); setError(''); setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/admin/users/import', form, { headers:{ 'Content-Type':'multipart/form-data' } });
      setResult(res.data);
      onImported();
    } catch (err) { setError(err.response?.data?.message || 'นำเข้าไม่สำเร็จ'); }
    finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.8)', backdropFilter:'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-3xl p-6 border text-white"
        style={{ background:'rgba(15,28,60,0.98)', borderColor:'rgba(255,255,255,0.1)' }}>
        <h3 className="font-bold text-lg mb-1">📥 Import จาก Excel</h3>
        <p className="text-xs mb-4" style={{ color:'rgba(255,255,255,0.4)' }}>
          คอลัมน์: <code className="bg-white/10 px-1 rounded">username</code> <code className="bg-white/10 px-1 rounded">name</code> <code className="bg-white/10 px-1 rounded">password</code> <code className="bg-white/10 px-1 rounded">role</code> <code className="bg-white/10 px-1 rounded">student_number</code>
          <br/>ถ้าไม่ใส่ password จะใช้ username เป็น password เริ่มต้น
        </p>

        {error && <div className="mb-4 p-3 rounded-xl text-sm text-red-300 bg-red-500/10 border border-red-500/30">{error}</div>}

        {!result ? (
          <>
            {/* Drop zone */}
            <div
              onDragOver={e=>{ e.preventDefault(); setDragOver(true); }}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{ e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={()=>fileRef.current?.click()}
              className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all mb-4"
              style={{ height:120, border:`2px dashed ${dragOver?'#a78bfa':'rgba(255,255,255,0.15)'}`, background:dragOver?'rgba(124,58,237,0.15)':'rgba(255,255,255,0.04)' }}>
              {file ? (
                <>
                  <span className="text-3xl">📊</span>
                  <p className="text-sm font-medium text-green-400">{file.name}</p>
                  <p className="text-xs" style={{ color:'rgba(255,255,255,0.35)' }}>{(file.size/1024).toFixed(1)} KB — คลิกเพื่อเปลี่ยน</p>
                </>
              ) : (
                <>
                  <span className="text-3xl">📂</span>
                  <p className="text-sm font-medium text-white">คลิกหรือลากไฟล์ Excel มาวาง</p>
                  <p className="text-xs" style={{ color:'rgba(255,255,255,0.35)' }}>.xlsx, .xls, .csv — ไม่เกิน 5 MB</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e=>handleFile(e.target.files[0])}/>

            {/* Template download hint */}
            <p className="text-xs mb-4 text-center" style={{ color:'rgba(255,255,255,0.3)' }}>
              💡 ดาวน์โหลด{' '}
              <button onClick={downloadTemplate} className="underline" style={{ color:'#a78bfa' }}>Template Excel</button>
            </p>

            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm border border-white/10 text-white/50 hover:text-white">ยกเลิก</button>
              <button onClick={handleImport} disabled={!file || importing}
                className="flex-1 py-2.5 rounded-xl font-medium text-white text-sm disabled:opacity-40"
                style={{ background:'linear-gradient(135deg,#059669,#0d9488)' }}>
                {importing ? 'กำลังนำเข้า...' : '📥 นำเข้า'}
              </button>
            </div>
          </>
        ) : (
          /* Result summary */
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[['✅ สร้างแล้ว', result.created.length, '#34d399'],
                ['⏭️ ซ้ำ ข้าม', result.skipped.length, '#fbbf24'],
                ['❌ ผิดพลาด',  result.errors.length,  '#f87171']].map(([label, count, color]) => (
                <div key={label} className="rounded-xl p-3 text-center" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-2xl font-bold" style={{ color }}>{count}</p>
                  <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.5)' }}>{label}</p>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-xl p-3 text-xs space-y-1 max-h-32 overflow-y-auto" style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}>
                {result.errors.map((e,i) => (
                  <p key={i} className="text-red-300">• {e.row}: {e.reason}</p>
                ))}
              </div>
            )}
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl font-medium text-white text-sm"
              style={{ background:'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              ✓ ปิด
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* download blank template */
const downloadTemplate = () => {
  const header = [['username','name','password','role','student_number']];
  const example = [
    ['student001','นักเรียน ทดสอบ','password123','STUDENT','12345'],
    ['teacher001','ครู ทดสอบ','password123','TEACHER',''],
  ];
  const csv = [...header, ...example].map(r=>r.join(',')).join('\n');
  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'users_template.csv'; a.click();
  URL.revokeObjectURL(url);
};

/* ══════════════════ TAB 1: USER MANAGEMENT ══════════════════ */
const TabUsers = ({ actorRole }) => {
  const navigate = useNavigate();
  const actorLevel = ROLE_LEVEL[actorRole] ?? 0;
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting]   = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [msg, setMsg]             = useState({ text:'', type:'ok' });

  const flash = (text, type='ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text:'', type:'ok' }), 3000);
  };

  const handleCreated = (newUser) => {
    setUsers(prev => [newUser, ...prev]);
    flash('สร้างผู้ใช้สำเร็จ ✅');
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users', { params: { search: search||undefined, role: roleFilter||undefined } });
      setUsers(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [search, roleFilter]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const handleUpdate = async (id, data) => {
    const res = await api.put(`/admin/users/${id}`, data);
    setUsers(prev => prev.map(u => u.id===id ? {...u,...res.data} : u));
    flash('อัปเดตสำเร็จ ✅');
  };
  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers(prev => prev.filter(u => u.id!==id));
      setDeleteConfirm(null);
      flash('ลบผู้ใช้สำเร็จ');
    } catch (err) { flash(err.response?.data?.message||'เกิดข้อผิดพลาด','err'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {Object.entries(ROLE_META).map(([role, m]) => (
          <div key={role} className="rounded-xl p-3 border text-center" style={{ background:m.bg, borderColor:m.border }}>
            <p className="text-xl">{m.icon}</p>
            <p className="text-lg font-bold mt-0.5" style={{ color:m.color }}>
              {users.filter(u=>u.role===role).length}
            </p>
            <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.5)' }}>{m.label}</p>
          </div>
        ))}
      </div>

      {msg.text && (
        <div className={`p-3 rounded-xl text-sm border ${msg.type==='err'?'bg-red-500/10 border-red-500/30 text-red-300':'bg-green-500/10 border-green-500/30 text-green-300'}`}>
          {msg.text}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={()=>setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
          style={{ background:'linear-gradient(135deg,#7c3aed,#db2777)', color:'#fff' }}>
          ➕ สร้างผู้ใช้
        </button>
        <button onClick={()=>setShowImport(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
          style={{ background:'linear-gradient(135deg,#059669,#0d9488)', color:'#fff' }}>
          📥 Import Excel
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-40 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, username..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-white text-sm focus:outline-none"
            style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}/>
        </div>
        <div className="flex rounded-xl overflow-hidden" style={{ border:'1px solid rgba(255,255,255,0.1)' }}>
          {[['','ทั้งหมด'],...Object.entries(ROLE_META).map(([r,m])=>[r,`${m.icon}`])].map(([val,label])=>(
            <button key={val} onClick={()=>setRoleFilter(val)}
              className="px-3 py-2 text-xs font-medium transition-colors"
              style={{ background:roleFilter===val?'rgba(124,58,237,0.35)':'transparent', color:roleFilter===val?'#fff':'rgba(255,255,255,0.4)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)' }}>
        <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-medium uppercase tracking-wide"
          style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.3)' }}>
          <div className="col-span-4">ชื่อ / Username</div>
          <div className="col-span-3">Role</div>
          <div className="col-span-2">รหัส</div>
          <div className="col-span-1 text-center">คะแนน</div>
          <div className="col-span-2 text-right">จัดการ</div>
        </div>
        {loading ? <div className="text-center py-10 text-white/30 text-sm">กำลังโหลด...</div>
        : users.length===0 ? <div className="text-center py-10 text-white/30 text-sm">ไม่พบผู้ใช้</div>
        : users.map((u,idx) => {
            const m = ROLE_META[u.role]||ROLE_META.STUDENT;
            const canManage = ROLE_LEVEL[u.role] < actorLevel;
            return (
              <div key={u.id} className="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/5 transition-colors"
                style={{ borderTop: idx===0?'none':'1px solid rgba(255,255,255,0.04)' }}>
                <div className="col-span-4 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                    style={{ background:m.bg, color:m.color }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{u.name}</p>
                    <p className="text-xs" style={{ color:'rgba(255,255,255,0.3)' }}>@{u.username}</p>
                  </div>
                </div>
                <div className="col-span-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border inline-flex items-center gap-1"
                    style={{ background:m.bg, color:m.color, borderColor:m.border }}>
                    {m.icon} {m.label}
                  </span>
                </div>
                <div className="col-span-2 text-sm" style={{ color:'rgba(255,255,255,0.4)' }}>{u.student_number||'—'}</div>
                <div className="col-span-1 text-center text-sm font-bold" style={{ color:'#34d399' }}>{u.total_points}</div>
                <div className="col-span-2 flex justify-end gap-1.5">
                  {canManage ? (
                    <>
                      <button onClick={()=>setEditTarget(u)}
                        className="px-2.5 py-1.5 rounded-lg text-xs border transition-all hover:border-white/30"
                        style={{ color:'rgba(255,255,255,0.5)', borderColor:'rgba(255,255,255,0.1)' }}>✏️</button>
                      <button onClick={()=>setDeleteConfirm(u)}
                        className="px-2.5 py-1.5 rounded-lg text-xs border transition-all"
                        style={{ color:'rgba(239,68,68,0.5)', borderColor:'rgba(239,68,68,0.15)' }}>🗑️</button>
                    </>
                  ) : <span className="text-xs italic" style={{ color:'rgba(255,255,255,0.2)' }}>—</span>}
                </div>
              </div>
            );
          })}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateUserModal actorLevel={actorLevel}
          onClose={()=>setShowCreate(false)} onCreated={handleCreated}/>
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onClose={()=>setShowImport(false)} onImported={fetchUsers}/>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <EditUserModal target={editTarget} actorLevel={actorLevel}
          onClose={()=>setEditTarget(null)} onSave={handleUpdate}/>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,0.8)', backdropFilter:'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-3xl p-6 border text-white"
            style={{ background:'rgba(15,28,60,0.98)', borderColor:'rgba(255,255,255,0.1)' }}>
            <p className="text-4xl text-center mb-3">⚠️</p>
            <h3 className="text-center font-bold text-lg mb-1">ยืนยันการลบ</h3>
            <p className="text-center text-sm mb-5" style={{ color:'rgba(255,255,255,0.5)' }}>
              ลบ <span className="text-white font-medium">{deleteConfirm.name}</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteConfirm(null)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm border border-white/10 text-white/50 hover:text-white">ยกเลิก</button>
              <button onClick={()=>handleDelete(deleteConfirm.id)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ background:'linear-gradient(135deg,#ef4444,#b91c1c)' }}>
                {deleting?'กำลังลบ...':'🗑️ ลบเลย'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EditUserModal = ({ target, actorLevel, onClose, onSave }) => {
  const assignableRoles = Object.keys(ROLE_META).filter(r=>ROLE_LEVEL[r]<actorLevel);
  const [form, setForm] = useState({ name:target.name, role:target.role, student_number:target.student_number||'', password:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { name:form.name, role:form.role, student_number:form.student_number };
      if (form.password) payload.password = form.password;
      await onSave(target.id, payload);
      onClose();
    } catch (err) { setError(err.response?.data?.message||'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.8)', backdropFilter:'blur(4px)' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="w-full max-w-md rounded-3xl p-6 border text-white"
        style={{ background:'rgba(15,28,60,0.98)', borderColor:'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
            style={{ background:ROLE_META[target.role]?.bg, color:ROLE_META[target.role]?.color }}>
            {target.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold">✏️ แก้ไขผู้ใช้</h3>
            <p className="text-xs" style={{ color:'rgba(255,255,255,0.4)' }}>@{target.username}</p>
          </div>
        </div>
        {error && <div className="mb-4 p-3 rounded-xl text-sm text-red-300 bg-red-500/10 border border-red-500/30">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color:'rgba(255,255,255,0.5)' }}>ชื่อ-นามสกุล</label>
            <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}
              className="w-full px-4 py-2.5 rounded-xl text-white text-sm focus:outline-none"
              style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}/>
          </div>
          <div>
            <label className="block text-xs mb-2" style={{ color:'rgba(255,255,255,0.5)' }}>Role</label>
            <div className="grid grid-cols-2 gap-2">
              {assignableRoles.map(r=>{
                const m=ROLE_META[r]; const active=form.role===r;
                return (
                  <button key={r} type="button" onClick={()=>setForm({...form,role:r})}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={{ background:active?m.bg:'rgba(255,255,255,0.05)', color:active?m.color:'rgba(255,255,255,0.4)', borderColor:active?m.border:'transparent' }}>
                    <span>{m.icon}</span> {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          {form.role==='STUDENT' && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color:'rgba(255,255,255,0.5)' }}>รหัสนักเรียน</label>
              <input value={form.student_number} onChange={e=>setForm({...form,student_number:e.target.value})}
                placeholder="เช่น 12345"
                className="w-full px-4 py-2.5 rounded-xl text-white text-sm focus:outline-none placeholder-white/20"
                style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}/>
            </div>
          )}
          <div>
            <label className="block text-xs mb-1.5" style={{ color:'rgba(255,255,255,0.5)' }}>รีเซ็ตรหัสผ่าน (เว้นว่างถ้าไม่เปลี่ยน)</label>
            <input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}
              placeholder="รหัสผ่านใหม่..."
              className="w-full px-4 py-2.5 rounded-xl text-white text-sm focus:outline-none placeholder-white/20"
              style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}/>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm border border-white/10 text-white/50 hover:text-white">ยกเลิก</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl font-medium text-white text-sm disabled:opacity-50"
              style={{ background:'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              {saving?'กำลังบันทึก...':'💾 บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════ TAB 2: MENU PERMISSIONS ══════════════════ */
const TabPermissions = ({ settings, onSaved }) => {
  const [perms, setPerms] = useState(settings.menuPermissions || {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');

  useEffect(() => { setPerms(settings.menuPermissions || {}); }, [settings]);

  const toggle = (menuKey, role) => {
    setPerms(prev => {
      const current = prev[menuKey] || [];
      const next = current.includes(role)
        ? current.filter(r => r !== role)
        : [...current, role];
      return { ...prev, [menuKey]: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', { menuPermissions: perms });
      setMsg('บันทึกสำเร็จ ✅');
      onSaved();
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg('เกิดข้อผิดพลาด ❌'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color:'rgba(255,255,255,0.5)' }}>
        กำหนดว่า role ใดสามารถเห็นเมนูไหนบน Dashboard ได้
      </p>

      {msg && (
        <div className={`p-3 rounded-xl text-sm border ${msg.includes('❌')?'bg-red-500/10 border-red-500/30 text-red-300':'bg-green-500/10 border-green-500/30 text-green-300'}`}>
          {msg}
        </div>
      )}

      {/* Header row */}
      <div className="rounded-2xl overflow-hidden" style={{ border:'1px solid rgba(255,255,255,0.08)' }}>
        <div className="grid px-4 py-3 text-xs font-medium uppercase tracking-wide"
          style={{ gridTemplateColumns:'1fr repeat(5,56px)', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.4)' }}>
          <div>เมนู</div>
          {ALL_ROLES.map(r => (
            <div key={r} className="text-center" style={{ color:ROLE_META[r].color }}>{ROLE_META[r].icon}</div>
          ))}
        </div>

        {MENU_DEFS.map((menu, idx) => {
          const rolePerm = perms[menu.key] || [];
          return (
            <div key={menu.key}
              className="grid px-4 py-3 items-center hover:bg-white/5 transition-colors"
              style={{ gridTemplateColumns:'1fr repeat(5,56px)', borderTop: idx===0?'none':'1px solid rgba(255,255,255,0.04)' }}>
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{menu.icon}</span>
                <span className="text-sm font-medium text-white">{menu.label}</span>
              </div>
              {ALL_ROLES.map(role => {
                const active = rolePerm.includes(role);
                const m = ROLE_META[role];
                return (
                  <div key={role} className="flex justify-center">
                    <button onClick={() => toggle(menu.key, role)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all hover:scale-110"
                      style={{
                        background: active ? m.bg : 'rgba(255,255,255,0.05)',
                        border: `2px solid ${active ? m.border : 'transparent'}`,
                        color: active ? m.color : 'rgba(255,255,255,0.2)',
                      }}
                      title={`${active?'ซ่อน':'แสดง'} ${menu.label} สำหรับ ${m.label}`}>
                      {active ? '✓' : '×'}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs" style={{ color:'rgba(255,255,255,0.4)' }}>
        {ALL_ROLES.map(r => (
          <span key={r} className="flex items-center gap-1.5">
            <span style={{ color:ROLE_META[r].color }}>{ROLE_META[r].icon}</span> {ROLE_META[r].label}
          </span>
        ))}
      </div>

      <button onClick={handleSave} disabled={saving}
        className="px-6 py-3 rounded-xl font-semibold text-white text-sm disabled:opacity-50 transition-all hover:scale-[1.02]"
        style={{ background:'linear-gradient(135deg,#7c3aed,#db2777)' }}>
        {saving ? 'กำลังบันทึก...' : '💾 บันทึกสิทธิ์เมนู'}
      </button>
    </div>
  );
};

/* ══════════════════ TAB 3: LOGIN BACKGROUND ══════════════════ */
const TabLoginBg = ({ settings, onSaved }) => {
  const current = settings.loginBackground || { type:'gradient', value:GRADIENT_PRESETS[0].value };
  const [type, setType]         = useState(current.type || 'gradient');
  const [gradient, setGradient] = useState(
    current.type==='gradient' ? current.value : GRADIENT_PRESETS[0].value
  );
  const [imageUrl, setImageUrl]     = useState(current.type==='image' ? current.value : '');
  const [dragOver, setDragOver]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [saving,    setSaving]      = useState(false);
  const [msg, setMsg]               = useState('');
  const fileInputRef                = React.useRef(null);

  const flash = (text) => { setMsg(text); setTimeout(()=>setMsg(''), 4000); };

  const preview = type==='gradient' ? gradient : (imageUrl || GRADIENT_PRESETS[0].value);
  const previewStyle = type==='gradient'
    ? { background: preview }
    : { backgroundImage:`url(${preview})`, backgroundSize:'cover', backgroundPosition:'center' };

  /* upload file → return URL */
  const uploadFile = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { flash('❌ ไฟล์ใหญ่เกิน 10 MB'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await api.post('/upload/background', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImageUrl(res.data.url);
      setType('image');
      flash('✅ อัปโหลดสำเร็จ');
    } catch (err) {
      flash(`❌ ${err.response?.data?.message || 'อัปโหลดไม่สำเร็จ'}`);
    } finally { setUploading(false); }
  };

  const handleFileChange = (e) => uploadFile(e.target.files[0]);
  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    uploadFile(e.dataTransfer.files[0]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const value = type==='gradient' ? gradient : imageUrl;
      await api.put('/settings', { loginBackground: { type, value } });
      flash('✅ บันทึกสำเร็จ');
      onSaved();
    } catch { flash('❌ เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`p-3 rounded-xl text-sm border ${msg.includes('❌')?'bg-red-500/10 border-red-500/30 text-red-300':'bg-green-500/10 border-green-500/30 text-green-300'}`}>
          {msg}
        </div>
      )}

      {/* Preview */}
      <div className="rounded-2xl overflow-hidden relative" style={{ height:160, ...previewStyle }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="backdrop-blur-md bg-white/20 rounded-2xl px-8 py-4 border border-white/30 text-center">
            <p className="text-white font-bold text-lg">Preview</p>
            <p className="text-white/70 text-sm">หน้า Login</p>
          </div>
        </div>
      </div>

      {/* Type toggle */}
      <div className="flex rounded-xl overflow-hidden p-1 gap-1" style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)' }}>
        {[['gradient','🎨 Gradient สี'],['image','🖼️ รูปภาพ']].map(([t,label])=>(
          <button key={t} onClick={()=>setType(t)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background:type===t?'rgba(124,58,237,0.4)':'transparent', color:type===t?'#c4b5fd':'rgba(255,255,255,0.4)' }}>
            {label}
          </button>
        ))}
      </div>

      {type==='gradient' ? (
        /* ── GRADIENT TAB ── */
        <div className="space-y-3">
          <p className="text-sm font-medium text-white">เลือก Preset</p>
          <div className="grid grid-cols-4 gap-2">
            {GRADIENT_PRESETS.map(p => (
              <button key={p.value} onClick={()=>setGradient(p.value)}
                className="relative rounded-xl overflow-hidden transition-all hover:scale-105"
                style={{ height:60, background:p.value, outline: gradient===p.value ? '2px solid #a78bfa' : 'none', outlineOffset:2 }}>
                {gradient===p.value && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-lg">✓</span>
                  </div>
                )}
                <div className="absolute bottom-1 left-0 right-0 text-center text-white/70 text-xs">{p.label}</div>
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color:'rgba(255,255,255,0.5)' }}>หรือใส่ CSS Gradient เอง</label>
            <input value={gradient} onChange={e=>setGradient(e.target.value)}
              placeholder="linear-gradient(135deg, #667eea, #764ba2)"
              className="w-full px-4 py-2.5 rounded-xl text-white text-sm focus:outline-none placeholder-white/20"
              style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)' }}/>
          </div>
        </div>
      ) : (
        /* ── IMAGE UPLOAD TAB ── */
        <div className="space-y-3">
          {/* Drop zone */}
          <div
            onDragOver={e=>{ e.preventDefault(); setDragOver(true); }}
            onDragLeave={()=>setDragOver(false)}
            onDrop={handleDrop}
            onClick={()=>fileInputRef.current?.click()}
            className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all select-none"
            style={{
              height: 140,
              border: `2px dashed ${dragOver ? '#a78bfa' : 'rgba(255,255,255,0.15)'}`,
              background: dragOver ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
            }}>
            {uploading ? (
              <>
                <div className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent animate-spin"/>
                <p className="text-sm" style={{ color:'rgba(255,255,255,0.5)' }}>กำลังอัปโหลด...</p>
              </>
            ) : (
              <>
                <span className="text-4xl">📁</span>
                <p className="text-sm font-medium text-white">คลิกหรือลากไฟล์รูปมาวางที่นี่</p>
                <p className="text-xs" style={{ color:'rgba(255,255,255,0.35)' }}>PNG, JPG, WEBP — ไม่เกิน 10 MB</p>
              </>
            )}
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange}/>

          {/* Current URL display */}
          {imageUrl && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }}>
              <span className="text-green-400 text-sm">✓</span>
              <p className="text-xs truncate flex-1" style={{ color:'rgba(255,255,255,0.5)' }}>{imageUrl}</p>
              <button onClick={()=>setImageUrl('')}
                className="text-xs px-2 py-1 rounded-lg transition-colors hover:bg-red-500/20 flex-shrink-0"
                style={{ color:'rgba(239,68,68,0.6)' }}>✕ ลบ</button>
            </div>
          )}

          <p className="text-xs" style={{ color:'rgba(255,255,255,0.3)' }}>
            💡 แนะนำขนาด 1920×1080px ขึ้นไป เพื่อความคมชัด
          </p>
        </div>
      )}

      <button onClick={handleSave} disabled={saving || uploading}
        className="px-6 py-3 rounded-xl font-semibold text-white text-sm disabled:opacity-50 transition-all hover:scale-[1.02]"
        style={{ background:'linear-gradient(135deg,#7c3aed,#db2777)' }}>
        {saving ? 'กำลังบันทึก...' : '💾 บันทึก Background'}
      </button>
    </div>
  );
};

/* ══════════════════ MAIN SETTINGS PAGE ══════════════════ */
const TABS = [
  { id:'users',       icon:'👥', label:'จัดการผู้ใช้'     },
  { id:'permissions', icon:'🔐', label:'สิทธิ์เมนู'       },
  { id:'appearance',  icon:'🎨', label:'หน้า Login'       },
];

const Settings = () => {
  const { user }                      = useContext(AuthContext);
  const { settings, reloadSettings }  = useSettings();
  const navigate                      = useNavigate();
  const [activeTab, setActiveTab]     = useState('users');

  useEffect(() => {
    if (user && ROLE_LEVEL[user.role] < ROLE_LEVEL['ADMIN']) navigate('/dashboard');
  }, [user, navigate]);

  return (
    <div className="min-h-screen text-white" style={{ background:'linear-gradient(135deg,#0a0018 0%,#0f0c29 40%,#0a1628 100%)' }}>
      {/* Ambient */}
      <div className="fixed top-0 right-0 w-96 h-96 rounded-full opacity-10 pointer-events-none"
        style={{ background:'radial-gradient(circle,#7c3aed,transparent)', filter:'blur(80px)' }}/>
      <div className="fixed bottom-0 left-0 w-80 h-80 rounded-full opacity-10 pointer-events-none"
        style={{ background:'radial-gradient(circle,#db2777,transparent)', filter:'blur(80px)' }}/>

      {/* Navbar */}
      <nav className="px-6 py-3 flex items-center justify-between border-b sticky top-0 z-30"
        style={{ background:'rgba(10,0,24,0.9)', backdropFilter:'blur(16px)', borderColor:'rgba(124,58,237,0.2)' }}>
        <div className="flex items-center gap-3">
          <button onClick={()=>navigate('/dashboard')} style={{ color:'rgba(255,255,255,0.4)' }}
            className="hover:text-white transition-colors">←</button>
          <span style={{ color:'rgba(255,255,255,0.2)' }}>|</span>
          <div>
            <h1 className="font-bold text-lg" style={{ color:'#a78bfa' }}>⚙️ Settings</h1>
            <p className="text-xs mt-0.5" style={{ color:'rgba(255,255,255,0.35)' }}>ระบบตั้งค่าและจัดการ</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-medium border"
          style={{ background:'rgba(239,68,68,0.15)', color:'#f87171', borderColor:'rgba(239,68,68,0.3)' }}>
          👑 Super User
        </span>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-2xl mb-6"
          style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all"
              style={{
                background: activeTab===tab.id ? 'linear-gradient(135deg,rgba(124,58,237,0.4),rgba(219,39,119,0.3))' : 'transparent',
                color: activeTab===tab.id ? '#e9d5ff' : 'rgba(255,255,255,0.4)',
                boxShadow: activeTab===tab.id ? '0 2px 12px rgba(124,58,237,0.2)' : 'none',
                border: activeTab===tab.id ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
              }}>
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="rounded-2xl p-5 border" style={{ background:'rgba(255,255,255,0.03)', borderColor:'rgba(255,255,255,0.08)' }}>
          {activeTab==='users'       && <TabUsers actorRole={user?.role}/>}
          {activeTab==='permissions' && <TabPermissions settings={settings} onSaved={reloadSettings}/>}
          {activeTab==='appearance'  && <TabLoginBg    settings={settings} onSaved={reloadSettings}/>}
        </div>
      </div>
    </div>
  );
};

export default Settings;
