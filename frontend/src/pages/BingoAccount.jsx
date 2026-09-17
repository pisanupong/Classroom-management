import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const fmt = (n) =>
  `฿${Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function BingoAccount() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [prizes, setPrizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', image: '', value: '', quantity: '' });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});

  const load = () => {
    setLoading(true);
    api.get('/bingo/prizes')
      .then(r => setPrizes(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const addPrize = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/bingo/prizes', form);
      setForm({ name: '', image: '', value: '', quantity: '' });
      setShowAdd(false);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/bingo/prizes/${id}`, editData);
      setEditId(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    }
  };

  const deletePrize = async (id) => {
    if (!window.confirm('ลบรายการนี้?')) return;
    await api.delete(`/bingo/prizes/${id}`);
    load();
  };

  const totalValue    = prizes.reduce((s, p) => s + p.value * p.quantity, 0);
  const totalQty      = prizes.reduce((s, p) => s + p.quantity, 0);
  const totalRemaining = prizes.reduce((s, p) => s + p.remaining, 0);
  const totalUsed     = prizes.reduce((s, p) => s + (p.quantity - p.remaining), 0);

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg,#0f172a,#1e1b4b)', fontFamily: "'Segoe UI',sans-serif" }}>
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between"
        style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bingo')} className="text-white/40 hover:text-white text-sm transition-colors">← Bingo</button>
          <span className="text-white/20">|</span>
          <h1 className="text-xl font-black">💰 คลังของรางวัล</h1>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
          ➕ เพิ่มของรางวัล
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'มูลค่ารวม', value: fmt(totalValue), color: '#10b981', icon: '💎' },
            { label: 'จำนวนทั้งหมด', value: totalQty, color: '#60a5fa', icon: '📦' },
            { label: 'คงเหลือ', value: totalRemaining, color: '#fbbf24', icon: '✅' },
            { label: 'จ่ายไปแล้ว', value: totalUsed, color: '#f87171', icon: '🎁' },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="rounded-2xl p-4 border border-white/10 text-center"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-2xl font-black" style={{ color }}>{value}</div>
              <div className="text-xs text-white/40 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-white/30 animate-pulse">⏳ กำลังโหลด...</div>
        ) : prizes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🎁</div>
            <p className="text-white/30 text-lg">ยังไม่มีรายการของรางวัล</p>
            <p className="text-white/20 text-sm mt-2">กด "เพิ่มของรางวัล" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 w-12"></th>
                  <th className="text-left px-5 py-3">ของรางวัล</th>
                  <th className="text-right px-5 py-3">มูลค่า</th>
                  <th className="text-right px-5 py-3">จำนวน</th>
                  <th className="text-right px-5 py-3">คงเหลือ</th>
                  <th className="text-right px-5 py-3">จ่ายไปแล้ว</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {prizes.map(p => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    {editId === p.id ? (
                      <>
                        <td className="px-5 py-3 w-12">
                          {(editData.image ?? p.image)
                            ? <img src={editData.image ?? p.image} alt="" className="w-10 h-10 object-cover rounded-lg" onError={e => e.target.style.display='none'} />
                            : <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white/20 text-xs">🎁</div>}
                        </td>
                        <td className="px-5 py-3">
                          <input value={editData.name ?? p.name}
                            onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                            className="w-full bg-white/10 rounded-lg px-2 py-1 text-white focus:outline-none border border-white/20 mb-1" placeholder="ชื่อ" />
                          <input value={editData.image ?? p.image ?? ''}
                            onChange={e => setEditData(d => ({ ...d, image: e.target.value }))}
                            className="w-full bg-white/10 rounded-lg px-2 py-1 text-white focus:outline-none border border-white/20 text-xs" placeholder="URL รูปภาพ (ถ้ามี)" />
                        </td>
                        <td className="px-5 py-3">
                          <input type="number" min="0" step="0.01" value={editData.value ?? p.value}
                            onChange={e => setEditData(d => ({ ...d, value: e.target.value }))}
                            className="w-24 bg-white/10 rounded-lg px-2 py-1 text-white text-right focus:outline-none border border-white/20 ml-auto block" />
                        </td>
                        <td className="px-5 py-3">
                          <input type="number" min="0" value={editData.quantity ?? p.quantity}
                            onChange={e => setEditData(d => ({ ...d, quantity: e.target.value }))}
                            className="w-20 bg-white/10 rounded-lg px-2 py-1 text-white text-right focus:outline-none border border-white/20 ml-auto block" />
                        </td>
                        <td className="px-5 py-3">
                          <input type="number" min="0" value={editData.remaining ?? p.remaining}
                            onChange={e => setEditData(d => ({ ...d, remaining: e.target.value }))}
                            className="w-20 bg-white/10 rounded-lg px-2 py-1 text-white text-right focus:outline-none border border-white/20 ml-auto block" />
                        </td>
                        <td className="px-5 py-3 text-right text-white/40">
                          {(editData.quantity ?? p.quantity) - (editData.remaining ?? p.remaining)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => saveEdit(p.id)}
                              className="text-xs px-3 py-1 rounded-lg font-bold"
                              style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                              บันทึก
                            </button>
                            <button onClick={() => setEditId(null)}
                              className="text-xs px-3 py-1 rounded-lg text-white/40 hover:text-white border border-white/10">
                              ยกเลิก
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3 w-12">
                          {p.image
                            ? <img src={p.image} alt={p.name} className="w-10 h-10 object-cover rounded-lg" onError={e => e.target.style.display='none'} />
                            : <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white/20">🎁</div>}
                        </td>
                        <td className="px-5 py-3 font-medium">{p.name}</td>
                        <td className="px-5 py-3 text-right text-emerald-400 font-bold">{fmt(p.value)}</td>
                        <td className="px-5 py-3 text-right text-white/70">{p.quantity}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-bold ${p.remaining === 0 ? 'text-red-400' : p.remaining <= 3 ? 'text-yellow-400' : 'text-white'}`}>
                            {p.remaining}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-orange-400">{p.quantity - p.remaining}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditId(p.id); setEditData({}); }}
                              className="text-xs px-3 py-1 rounded-lg text-white/40 hover:text-white border border-white/10 transition-colors">
                              ✏️ แก้ไข
                            </button>
                            <button onClick={() => deletePrize(p.id)}
                              className="text-xs px-3 py-1 rounded-lg text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors">
                              🗑️ ลบ
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10 text-xs font-bold">
                  <td className="px-5 py-3 text-white/60">รวมทั้งหมด</td>
                  <td className="px-5 py-3 text-right text-emerald-400">{fmt(totalValue)}</td>
                  <td className="px-5 py-3 text-right text-white/60">{totalQty}</td>
                  <td className="px-5 py-3 text-right text-white">{totalRemaining}</td>
                  <td className="px-5 py-3 text-right text-orange-400">{totalUsed}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add Prize Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 border border-white/10"
            style={{ background: 'rgba(15,23,42,0.98)' }}>
            <h3 className="font-bold text-lg mb-4">🎁 เพิ่มของรางวัล</h3>
            <form onSubmit={addPrize} className="space-y-4">
              <div>
                <label className="text-xs text-white/50 block mb-1">ชื่อของรางวัล *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  placeholder="เช่น ดินสอสี 12 แท่ง"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-emerald-400 placeholder-white/20" />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">รูปภาพ (URL)</label>
                <input value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                  placeholder="https://... (ถ้ามี)"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-emerald-400 placeholder-white/20" />
                {form.image && (
                  <img src={form.image} alt="" className="mt-2 h-20 rounded-xl object-cover w-full"
                    onError={e => e.target.style.display='none'} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1">มูลค่า (฿)</label>
                  <input type="number" min="0" step="0.01" value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-emerald-400 placeholder-white/20" />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">จำนวน (ชิ้น)</label>
                  <input type="number" min="0" value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-emerald-400 placeholder-white/20" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                  {saving ? '⏳...' : '✅ เพิ่ม'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
