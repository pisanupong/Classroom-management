import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const ROLE_LEVEL = { STUDENT: 0, TEACHER: 1, ADMIN: 2, SUPER_USER: 3 };
const fmtDate = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

// ─── Reward Card ─────────────────────────────────────────────────────────────
const RewardCard = ({ reward, myPoints, isTeacher, onRedeem, onEdit, onDelete }) => {
  const canAfford = myPoints >= reward.points_required;
  const outOfStock = reward.stock <= 0;

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden flex flex-col transition-all hover:border-white/20"
      style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}>
      {/* Image */}
      <div className="relative aspect-video bg-white/5 flex items-center justify-center overflow-hidden">
        {reward.image_url ? (
          <img src={reward.image_url} alt={reward.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-5xl opacity-30">🎁</span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white font-bold text-sm bg-red-500/80 px-3 py-1 rounded-full">หมดแล้ว</span>
          </div>
        )}
        <div className="absolute top-2 right-2 px-2 py-1 rounded-lg text-xs font-bold text-white"
          style={{ background: outOfStock ? 'rgba(239,68,68,0.8)' : 'rgba(124,58,237,0.8)' }}>
          คงเหลือ {reward.stock}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div>
          <h3 className="font-semibold text-white text-sm leading-snug">{reward.title}</h3>
          <p className="text-xs text-white/30 mt-0.5">แลกไปแล้ว {reward._count?.reward_logs ?? 0} ครั้ง</p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-yellow-400 text-base">⭐</span>
            <span className="font-bold text-white">{reward.points_required.toLocaleString()}</span>
            <span className="text-xs text-white/30">พอยต์</span>
          </div>

          {isTeacher ? (
            <div className="flex gap-1">
              <button onClick={() => onEdit(reward)}
                className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/10 transition-colors">✏️ แก้ไข</button>
              <button onClick={() => onDelete(reward.id)}
                className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors">🗑️</button>
            </div>
          ) : (
            <button
              onClick={() => !outOfStock && canAfford && onRedeem(reward)}
              disabled={outOfStock || !canAfford}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                outOfStock || !canAfford
                  ? 'bg-white/5 text-white/20 cursor-not-allowed'
                  : 'text-white hover:opacity-90 active:scale-95'
              }`}
              style={!outOfStock && canAfford ? { background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' } : {}}>
              {outOfStock ? 'หมด' : !canAfford ? 'พอยต์ไม่พอ' : '🎁 แลก'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Reward Modal (create/edit) ───────────────────────────────────────────────
const RewardModal = ({ initial, onClose, onSave }) => {
  const [form, setForm] = useState({
    title: initial?.title || '',
    image_url: initial?.image_url || '',
    points_required: initial?.points_required ?? '',
    stock: initial?.stock ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || form.points_required === '') return setError('กรุณากรอกชื่อและพอยต์');
    setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (err) { setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 border border-white/10" style={{ background: '#1a1a2e' }}>
        <h2 className="text-lg font-bold text-white mb-5">{initial ? 'แก้ไขของรางวัล' : 'เพิ่มของรางวัลใหม่'}</h2>
        {error && <div className="mb-4 px-4 py-2 rounded-xl bg-red-500/20 text-red-300 text-sm border border-red-500/30">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">ชื่อของรางวัล *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} required placeholder="เช่น ยกเว้นการบ้าน 1 ครั้ง"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-400" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">URL รูปภาพ (ถ้ามี)</label>
            <input value={form.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">⭐ พอยต์ที่ต้องใช้ *</label>
              <input type="number" min="1" value={form.points_required} onChange={e => set('points_required', e.target.value)} required placeholder="100"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">📦 จำนวนสต็อก</label>
              <input type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="10"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-400" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition-colors">ยกเลิก</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
              {saving ? 'กำลังบันทึก...' : initial ? 'บันทึก' : '+ เพิ่ม'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Adjust Points Modal ──────────────────────────────────────────────────────
const PointsModal = ({ students, onClose, onSave }) => {
  const [studentId, setStudentId] = useState('');
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentId || !delta) return setError('กรุณาเลือกนักเรียนและระบุพอยต์');
    setSaving(true); setError('');
    try { await onSave(studentId, parseInt(delta), reason); onClose(); }
    catch (err) { setError(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 border border-white/10" style={{ background: '#1a1a2e' }}>
        <h2 className="text-lg font-bold text-white mb-5">⭐ ปรับพอยต์นักเรียน</h2>
        {error && <div className="mb-4 px-4 py-2 rounded-xl bg-red-500/20 text-red-300 text-sm border border-red-500/30">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">นักเรียน</label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-400">
              <option value="">— เลือกนักเรียน —</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.student_number ? `${s.student_number} - ` : ''}{s.name} ({s.total_points} pts)</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">จำนวนพอยต์ (ใส่ - เพื่อหัก)</label>
            <input type="number" value={delta} onChange={e => setDelta(e.target.value)} required placeholder="+10 หรือ -5"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-400 text-lg font-bold text-center" />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">เหตุผล (ถ้ามี)</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="เช่น ช่วยงานครู, มีพฤติกรรมดี..."
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-400" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10">ยกเลิก</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              {saving ? 'กำลังบันทึก...' : 'ปรับพอยต์'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Confirm Redeem Modal ─────────────────────────────────────────────────────
const ConfirmModal = ({ reward, myPoints, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 border border-white/10 text-center" style={{ background: '#1a1a2e' }}>
        <div className="text-5xl mb-3">🎁</div>
        <h2 className="text-lg font-bold text-white mb-1">ยืนยันการแลก</h2>
        <p className="text-white/60 text-sm mb-4">{reward.title}</p>
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-yellow-400">⭐</span>
          <span className="text-white font-bold text-xl">{reward.points_required.toLocaleString()}</span>
          <span className="text-white/40 text-sm">จาก {myPoints.toLocaleString()} พอยต์</span>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10">ยกเลิก</button>
          <button onClick={handleConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
            {loading ? 'กำลังแลก...' : 'ยืนยัน'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const RewardStore = () => {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const isTeacher = ROLE_LEVEL[user?.role] >= ROLE_LEVEL['TEACHER'];

  const [rewards, setRewards]   = useState([]);
  const [logs, setLogs]         = useState([]);
  const [myLogs, setMyLogs]     = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('store'); // store | logs
  const [modal, setModal]       = useState(null);    // null | 'create' | reward | 'points' | 'confirm'
  const [confirmReward, setConfirmReward] = useState(null);
  const [toast, setToast]       = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [rRes, lRes] = await Promise.all([
        api.get('/rewards'),
        isTeacher ? api.get('/rewards/logs') : api.get('/rewards/my-logs'),
      ]);
      setRewards(rRes.data);
      isTeacher ? setLogs(lRes.data) : setMyLogs(lRes.data);

      if (isTeacher) {
        const uRes = await api.get('/admin/users?role=STUDENT');
        setStudents(uRes.data);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [isTeacher]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveReward = async (form) => {
    if (modal && modal !== 'create') {
      await api.put(`/rewards/${modal.id}`, form);
      showToast('แก้ไขของรางวัลแล้ว');
    } else {
      await api.post('/rewards', form);
      showToast('เพิ่มของรางวัลแล้ว');
    }
    await fetchAll();
  };

  const handleDelete = async (id) => {
    if (!confirm('ยืนยันลบของรางวัลนี้?')) return;
    await api.delete(`/rewards/${id}`);
    showToast('ลบแล้ว');
    await fetchAll();
  };

  const handleRedeem = async () => {
    try {
      await api.post(`/rewards/${confirmReward.id}/redeem`);
      showToast(`แลก "${confirmReward.title}" สำเร็จ! 🎉`);
      setConfirmReward(null);
      // อัปเดต points ใน context
      if (setUser) setUser(u => ({ ...u, total_points: u.total_points - confirmReward.points_required }));
      await fetchAll();
    } catch (err) {
      showToast(err.response?.data?.message || 'เกิดข้อผิดพลาด', 'error');
      setConfirmReward(null);
    }
  };

  const handleAdjustPoints = async (studentId, delta, reason) => {
    await api.put(`/rewards/points/${studentId}`, { delta, reason });
    showToast(`ปรับพอยต์ ${delta > 0 ? '+' : ''}${delta} แล้ว`);
    await fetchAll();
  };

  const handleClaim = async (logId) => {
    await api.put(`/rewards/logs/${logId}/claim`);
    showToast('ส่งของรางวัลให้นักเรียนแล้ว ✅');
    await fetchAll();
  };

  const myPoints = user?.total_points ?? 0;

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 40%, #16213e 100%)' }}>
      <div className="fixed top-0 right-0 w-[400px] h-[400px] rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle,#f59e0b,transparent)', filter: 'blur(100px)' }} />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-xl text-sm font-medium shadow-lg transition-all border ${
          toast.type === 'error' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Topbar */}
      <nav className="px-6 py-3 flex items-center gap-4 border-b border-white/10 sticky top-0 z-30"
        style={{ background: 'rgba(15,12,41,0.8)', backdropFilter: 'blur(16px)' }}>
        <button onClick={() => navigate('/dashboard')} className="text-white/40 hover:text-white transition-colors text-lg">←</button>
        <div>
          <h1 className="font-bold text-white text-base leading-none">🎁 ร้านของรางวัล</h1>
          <p className="text-xs text-white/30 mt-0.5">แลกพอยต์รับของรางวัล</p>
        </div>
        {/* My Points (student) */}
        {!isTeacher && (
          <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl border border-yellow-500/30"
            style={{ background: 'rgba(245,158,11,0.1)' }}>
            <span className="text-yellow-400">⭐</span>
            <span className="font-bold text-white">{myPoints.toLocaleString()}</span>
            <span className="text-xs text-white/40">พอยต์</span>
          </div>
        )}
        {/* Teacher actions */}
        {isTeacher && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => setModal('points')}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10 transition-all">
              ⭐ ปรับพอยต์
            </button>
            <button onClick={() => setModal('create')}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
              + เพิ่มของรางวัล
            </button>
          </div>
        )}
      </nav>

      {/* Tabs */}
      <div className="border-b border-white/10" style={{ background: 'rgba(15,12,41,0.5)' }}>
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pt-2">
          {[['store','🛍️ ร้านค้า'], ['logs', isTeacher ? '📋 คำขอแลก' : '🕐 ประวัติของฉัน']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-colors border-b-2 ${
                tab === v ? 'text-white border-purple-500 bg-white/5' : 'text-white/40 border-transparent hover:text-white'
              }`}>
              {l}
              {v === 'logs' && isTeacher && logs.filter(l => l.status === 'PENDING').length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-red-500 text-white">
                  {logs.filter(l => l.status === 'PENDING').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-white/30">กำลังโหลด...</div>
        ) : tab === 'store' ? (
          /* ── Store Tab ── */
          !rewards.length ? (
            <div className="flex flex-col items-center justify-center h-64 text-white/30 gap-3">
              <span className="text-5xl">🎁</span>
              <p>{isTeacher ? 'ยังไม่มีของรางวัล กด "+ เพิ่มของรางวัล" เพื่อเริ่มต้น' : 'ยังไม่มีของรางวัลในร้านค้า'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map(r => (
                <RewardCard key={r.id} reward={r} myPoints={myPoints} isTeacher={isTeacher}
                  onRedeem={(reward) => setConfirmReward(reward)}
                  onEdit={(reward) => setModal(reward)}
                  onDelete={handleDelete} />
              ))}
            </div>
          )
        ) : (
          /* ── Logs Tab ── */
          <div className="rounded-2xl border border-white/10 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
            {(isTeacher ? logs : myLogs).length === 0 ? (
              <div className="py-16 text-center text-white/30">ยังไม่มีประวัติการแลก</div>
            ) : (
              <div className="divide-y divide-white/5">
                {(isTeacher ? logs : myLogs).map(log => (
                  <div key={log.id} className="px-5 py-4 flex items-center gap-4">
                    {/* reward image */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 flex items-center justify-center">
                      {log.reward.image_url
                        ? <img src={log.reward.image_url} alt={log.reward.title} className="w-full h-full object-cover" />
                        : <span className="text-2xl">🎁</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{log.reward.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {isTeacher && log.student && (
                          <span className="text-xs text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                            {log.student.student_number ? `${log.student.student_number} · ` : ''}{log.student.name}
                          </span>
                        )}
                        <span className="text-xs text-white/30">{fmtDate(log.redeemed_at)}</span>
                        <span className="flex items-center gap-1 text-xs text-yellow-400">
                          <span>⭐</span>{log.reward.points_required.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* status + action */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        log.status === 'CLAIMED'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                      }`}>
                        {log.status === 'CLAIMED' ? '✅ รับแล้ว' : '⏳ รอรับ'}
                      </span>
                      {isTeacher && log.status === 'PENDING' && (
                        <button onClick={() => handleClaim(log.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                          style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                          ส่งของแล้ว
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {(modal === 'create' || (modal && modal !== 'points')) && modal !== 'create' && typeof modal === 'object' && (
        <RewardModal initial={modal} onClose={() => setModal(null)} onSave={handleSaveReward} />
      )}
      {modal === 'create' && (
        <RewardModal initial={null} onClose={() => setModal(null)} onSave={handleSaveReward} />
      )}
      {modal === 'points' && (
        <PointsModal students={students} onClose={() => setModal(null)} onSave={handleAdjustPoints} />
      )}
      {confirmReward && (
        <ConfirmModal reward={confirmReward} myPoints={myPoints} onClose={() => setConfirmReward(null)} onConfirm={handleRedeem} />
      )}
    </div>
  );
};

export default RewardStore;
