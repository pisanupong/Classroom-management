import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const ROLE_LEVEL = { STUDENT: 0, CLASS_ADMIN: 1, TEACHER: 2, ADMIN: 3, SUPER_USER: 4 };

const fmt = (n) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

// ─── Modal บันทึกรายการ ───────────────────────────────────────────────────────
const TxModal = ({ initial, students, onClose, onSave }) => {
  const [form, setForm] = useState({
    type: initial?.type || 'INCOME',
    amount: initial?.amount || '',
    description: initial?.description || '',
    student_id: initial?.student_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return setError('กรุณาระบุจำนวนเงินที่ถูกต้อง');
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, student_id: form.student_id || null });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 border border-white/10" style={{ background: '#1a1a2e' }}>
        <h2 className="text-lg font-bold text-white mb-5">{initial ? 'แก้ไขรายการ' : 'บันทึกรายการใหม่'}</h2>

        {error && <div className="mb-4 px-4 py-2 rounded-xl bg-red-500/20 text-red-300 text-sm border border-red-500/30">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ประเภท */}
          <div className="grid grid-cols-2 gap-2">
            {['INCOME', 'EXPENSE'].map(t => (
              <button key={t} type="button"
                onClick={() => set('type', t)}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  form.type === t
                    ? t === 'INCOME'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-red-500/20 text-red-300 border-red-500/50'
                    : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                }`}>
                {t === 'INCOME' ? '💰 รายรับ' : '💸 รายจ่าย'}
              </button>
            ))}
          </div>

          {/* จำนวนเงิน */}
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">จำนวนเงิน (บาท)</label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="0.00" required
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-400 text-right text-lg font-bold" />
          </div>

          {/* รายละเอียด */}
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">รายละเอียด</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="เช่น เก็บเงินห้องสัปดาห์ที่ 3, ค่าวัสดุ..."
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-400" />
          </div>

          {/* นักเรียน (optional) */}
          <div>
            <label className="text-xs text-white/50 mb-1.5 block">ระบุนักเรียน (ถ้ามี)</label>
            <select value={form.student_id} onChange={e => set('student_id', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-400">
              <option value="">— ไม่ระบุ (รายการส่วนกลาง) —</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.student_number ? `${s.student_number} - ` : ''}{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition-colors">ยกเลิก</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color, icon }) => (
  <div className="rounded-2xl p-5 border border-white/10 flex items-center gap-4"
    style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}>
    <div className="text-3xl">{icon}</div>
    <div>
      <p className="text-xs text-white/40 mb-0.5">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{fmt(value)} ฿</p>
    </div>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const Treasury = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isTeacher    = ROLE_LEVEL[user?.role] >= ROLE_LEVEL['TEACHER'];
  const isClassAdmin = user?.role === 'CLASS_ADMIN';
  const canRecord    = isTeacher || isClassAdmin; // CLASS_ADMIN บันทึกได้ แต่รอ approve

  const [data, setData]           = useState(null);
  const [pending, setPending]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [approving, setApproving] = useState(null);
  const [filter, setFilter]       = useState('ALL');
  const [search, setSearch]       = useState('');
  const [tab, setTab]             = useState('main'); // main | pending

  const fetchData = useCallback(async () => {
    try {
      const endpoint = canRecord ? '/treasury' : '/treasury/my';
      const [res, pRes] = await Promise.all([
        api.get(endpoint),
        isTeacher ? api.get('/treasury/pending') : Promise.resolve({ data: [] }),
      ]);
      setData(res.data);
      setPending(pRes.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [canRecord, isTeacher]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (form) => {
    if (modal && modal !== 'create') {
      await api.put(`/treasury/${modal.id}`, form);
    } else {
      await api.post('/treasury', form);
    }
    await fetchData();
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await api.delete(`/treasury/${id}`);
      await fetchData();
    } finally { setDeleting(null); }
  };

  const transactions = data?.transactions ?? [];
  const filtered = transactions
    .filter(t => filter === 'ALL' || t.type === filter)
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (t.description || '').toLowerCase().includes(q) ||
             (t.student?.name || '').toLowerCase().includes(q) ||
             (t.student?.student_number || '').includes(q);
    });

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 40%, #16213e 100%)' }}>
      <div className="fixed top-0 left-0 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #10b981, transparent)', filter: 'blur(120px)' }} />

      {/* Topbar */}
      <nav className="px-6 py-3 flex items-center gap-4 border-b border-white/10 sticky top-0 z-30"
        style={{ background: 'rgba(15,12,41,0.8)', backdropFilter: 'blur(16px)' }}>
        <button onClick={() => navigate('/dashboard')} className="text-white/40 hover:text-white transition-colors text-lg">←</button>
        <div>
          <h1 className="font-bold text-white text-base leading-none">💰 กระเป๋าเงินห้องเรียน</h1>
          <p className="text-xs text-white/30 mt-0.5">ระบบบัญชีรายรับ-รายจ่าย</p>
        </div>
        {canRecord && (
          <button onClick={() => setModal('create')}
            className="ml-auto px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
            {isClassAdmin ? '+ บันทึก (รออนุมัติ)' : '+ บันทึกรายการ'}
          </button>
        )}
        {/* CLASS_ADMIN badge */}
        {isClassAdmin && (
          <span className="ml-2 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/40 text-emerald-300"
            style={{ background: 'rgba(16,185,129,0.1)' }}>
            📋 ประธานนักเรียน
          </span>
        )}
      </nav>

      {/* Tabs — เฉพาะ TEACHER */}
      {isTeacher && (
        <div className="border-b border-white/10 px-4" style={{ background: 'rgba(15,12,41,0.5)' }}>
          <div className="max-w-4xl mx-auto flex gap-1 pt-2">
            {[['main','💰 รายการเงิน'], ['pending',`⏳ รออนุมัติ${pending.length > 0 ? ` (${pending.length})` : ''}`]].map(([v,l]) => (
              <button key={v} onClick={() => setTab(v)}
                className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-colors border-b-2 ${
                  tab === v ? 'text-white border-purple-500 bg-white/5' : 'text-white/40 border-transparent hover:text-white'
                }`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-white/30">กำลังโหลด...</div>
        ) : tab === 'pending' && isTeacher ? (
          /* ═══ Pending Approval Tab ═══ */
          <div className="rounded-2xl border border-yellow-500/20 overflow-hidden"
            style={{ background: 'rgba(245,158,11,0.05)', backdropFilter: 'blur(12px)' }}>
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="font-semibold text-yellow-300 flex items-center gap-2">
                ⏳ รายการรอการอนุมัติจากประธานนักเรียน
                <span className="ml-auto text-xs text-white/30 font-normal">{pending.length} รายการ</span>
              </h3>
            </div>
            {!pending.length ? (
              <div className="py-12 text-center text-white/30 text-sm">ไม่มีรายการรอการอนุมัติ ✅</div>
            ) : (
              <div className="divide-y divide-white/5">
                {pending.map(tx => (
                  <div key={tx.id} className="px-5 py-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tx.type === 'INCOME' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                      <span className="text-lg">{tx.type === 'INCOME' ? '↑' : '↓'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{tx.description || '(ไม่มีรายละเอียด)'}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          📋 {tx.creator?.name || 'ประธานนักเรียน'}
                        </span>
                        {tx.student && (
                          <span className="text-xs text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                            {tx.student.name}
                          </span>
                        )}
                        <span className="text-xs text-white/30">{fmtDate(tx.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 mr-2">
                      <p className={`text-base font-bold ${tx.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.type === 'INCOME' ? '+' : '-'}{fmt(tx.amount)} ฿
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={async () => {
                          setApproving(tx.id);
                          try { await api.put(`/treasury/${tx.id}/approve`, { action: 'approve' }); await fetchData(); }
                          finally { setApproving(null); }
                        }}
                        disabled={approving === tx.id}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                        {approving === tx.id ? '...' : '✅ อนุมัติ'}
                      </button>
                      <button
                        onClick={async () => {
                          setApproving(tx.id + '_r');
                          try { await api.put(`/treasury/${tx.id}/approve`, { action: 'reject' }); await fetchData(); }
                          finally { setApproving(null); }
                        }}
                        disabled={approving === tx.id + '_r'}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white/60 border border-red-500/30 hover:bg-red-500/10 hover:text-red-300 transition-all disabled:opacity-40">
                        ❌ ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="ยอดคงเหลือ"  value={data?.balance ?? 0}       color="#a78bfa" icon="💼" />
              <StatCard label="รายรับรวม"   value={data?.totalIncome ?? 0}   color="#34d399" icon="💰" />
              <StatCard label="รายจ่ายรวม"  value={data?.totalExpense ?? 0}  color="#f87171" icon="💸" />
            </div>

            {/* Filter + Search */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex rounded-xl overflow-hidden border border-white/10">
                {[['ALL','ทั้งหมด'],['INCOME','รายรับ'],['EXPENSE','รายจ่าย']].map(([v, l]) => (
                  <button key={v} onClick={() => setFilter(v)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${filter === v ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/40 hover:text-white'}`}>
                    {l}
                  </button>
                ))}
              </div>
              {canRecord && (
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="ค้นหาชื่อ, รายละเอียด..."
                  className="flex-1 min-w-0 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-400 text-sm" />
              )}
            </div>

            {/* Transaction List */}
            <div className="rounded-2xl border border-white/10 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
              {!filtered.length ? (
                <div className="py-16 text-center text-white/30">ยังไม่มีรายการ</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filtered.map(tx => (
                    <div key={tx.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors group">
                      {/* icon */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tx.type === 'INCOME' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                        <span className="text-lg">{tx.type === 'INCOME' ? '↑' : '↓'}</span>
                      </div>

                      {/* info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{tx.description || '(ไม่มีรายละเอียด)'}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {tx.student && (
                            <span className="text-xs text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                              {tx.student.student_number ? `${tx.student.student_number} · ` : ''}{tx.student.name}
                            </span>
                          )}
                          <span className="text-xs text-white/30">{fmtDate(tx.created_at)}</span>
                        </div>
                      </div>

                      {/* amount */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-base font-bold ${tx.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tx.type === 'INCOME' ? '+' : '-'}{fmt(tx.amount)} ฿
                        </p>
                      </div>

                      {/* actions (teacher only) */}
                      {isTeacher && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => setModal(tx)}
                            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors">✏️</button>
                          <button onClick={() => handleDelete(tx.id)} disabled={deleting === tx.id}
                            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40">
                            {deleting === tx.id ? '...' : '🗑️'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Student unpaid section — teacher/class_admin */}
            {canRecord && data?.students?.length > 0 && (
              <div className="rounded-2xl border border-white/10 p-5"
                style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  👥 รายชื่อนักเรียนในห้อง
                  <span className="text-xs text-white/30 font-normal">({data.students.length} คน)</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {data.students.map(s => {
                    const paid = transactions
                      .filter(t => t.student_id === s.id && t.type === 'INCOME')
                      .reduce((sum, t) => sum + t.amount, 0);
                    return (
                      <div key={s.id}
                        className="p-3 rounded-xl border border-white/8 flex items-center gap-2"
                        style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: 'white' }}>
                          {s.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-white truncate">{s.name}</p>
                          <p className="text-xs text-emerald-400">{fmt(paid)} ฿</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <TxModal
          initial={modal === 'create' ? null : modal}
          students={data?.students ?? []}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default Treasury;
