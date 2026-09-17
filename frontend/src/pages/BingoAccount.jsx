import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const fmt = (n) =>
  `฿${Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const STATUS_LABEL = { waiting: 'รอเล่น', playing: '🎲 กำลังเล่น', finished: '✅ จบแล้ว' };
const STATUS_COLOR = { waiting: '#10b981', playing: '#f59e0b', finished: '#6b7280' };

export default function BingoAccount() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'accounting' ? 'accounting' : 'inventory');

  // ── Inventory state ──────────────────────────────────────────
  const [prizes, setPrizes] = useState([]);
  const [invLoading, setInvLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', image: '', value: '', quantity: '' });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});

  // ── Accounting state ─────────────────────────────────────────
  const [rooms, setRooms] = useState([]);
  const [accLoading, setAccLoading] = useState(false);
  const [expandedRoom, setExpandedRoom] = useState(null);

  const switchTab = (t) => {
    setTab(t);
    setSearchParams(t === 'inventory' ? {} : { tab: t });
  };

  // Load inventory
  const loadPrizes = () => {
    setInvLoading(true);
    api.get('/bingo/prizes').then(r => setPrizes(r.data)).catch(() => {}).finally(() => setInvLoading(false));
  };
  useEffect(() => { loadPrizes(); }, []);

  // Load accounting when tab switches
  const loadAccounting = () => {
    setAccLoading(true);
    api.get('/bingo/accounting').then(r => setRooms(r.data)).catch(() => {}).finally(() => setAccLoading(false));
  };
  useEffect(() => { if (tab === 'accounting') loadAccounting(); }, [tab]);

  // ── Inventory CRUD ───────────────────────────────────────────
  const addPrize = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/bingo/prizes', form);
      setForm({ name: '', image: '', value: '', quantity: '' });
      setShowAdd(false);
      loadPrizes();
    } catch (err) { alert(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/bingo/prizes/${id}`, editData);
      setEditId(null);
      loadPrizes();
    } catch (err) { alert(err.response?.data?.message || 'เกิดข้อผิดพลาด'); }
  };

  const deletePrize = async (id) => {
    if (!window.confirm('ลบรายการนี้?')) return;
    await api.delete(`/bingo/prizes/${id}`);
    loadPrizes();
  };

  const totalValue     = prizes.reduce((s, p) => s + p.value * p.quantity, 0);
  const totalQty       = prizes.reduce((s, p) => s + p.quantity, 0);
  const totalRemaining = prizes.reduce((s, p) => s + p.remaining, 0);
  const totalUsed      = prizes.reduce((s, p) => s + (p.quantity - p.remaining), 0);

  // ── Accounting helpers ───────────────────────────────────────
  const getUniqueAliases = (room) => [...new Set((room.cards || []).map(c => c.alias))].sort();
  const roomRevenue      = (room) => getUniqueAliases(room).length * (room.ticket_price || 0);
  const prizesGiven      = (room) => room.rounds.reduce((s, r) => s + (r.winners?.length || 0), 0);
  const prizeValueGiven  = (room) => room.rounds.reduce((s, r) => {
    if (!r.winners?.length) return s;
    const val = r.prize_inventory?.value || r.prize_value || 0;
    return s + val * r.winners.length;
  }, 0);

  const totalRevenue   = rooms.reduce((s, r) => s + roomRevenue(r), 0);
  const totalPrizesOut = rooms.reduce((s, r) => s + prizesGiven(r), 0);
  const totalPrizeVal  = rooms.reduce((s, r) => s + prizeValueGiven(r), 0);

  const printPlayerList = (room) => {
    const aliases = getUniqueAliases(room);
    const win = document.open('', '_blank');
    win.document.write(`
      <html><head><title>รายชื่อผู้เล่น — ${room.name}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 24px; }
        h2 { margin: 0 0 4px; }
        .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 6px 12px; text-align: left; }
        th { background: #f3f4f6; }
        @media print { button { display: none; } }
      </style></head><body>
      <h2>🎱 ${room.name}</h2>
      <div class="meta">วันที่: ${new Date(room.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })} | ราคาบัตร: ${fmt(room.ticket_price)} | ผู้เล่น: ${aliases.length} คน</div>
      <button onclick="window.print()" style="margin-bottom:12px;padding:6px 16px;cursor:pointer;">🖨️ พิมพ์</button>
      <table>
        <thead><tr><th>#</th><th>รหัสนักเรียน / ชื่อ</th><th>ลายเซ็น</th></tr></thead>
        <tbody>${aliases.map((a, i) => `<tr><td>${i + 1}</td><td>${a}</td><td></td></tr>`).join('')}</tbody>
      </table>
      </body></html>`);
    win.document.close();
  };

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg,#0f172a,#1e1b4b)', fontFamily: "'Segoe UI',sans-serif" }}>
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between gap-4"
        style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bingo')} className="text-white/40 hover:text-white text-sm transition-colors">← Bingo</button>
          <span className="text-white/20">|</span>
          <h1 className="text-xl font-black">💰 บัญชี Bingo</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <button onClick={() => switchTab('inventory')}
            className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
            style={tab === 'inventory'
              ? { background: 'rgba(52,211,153,0.25)', color: '#34d399', border: '1px solid rgba(52,211,153,0.4)' }
              : { color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }}>
            🎁 คลังรางวัล
          </button>
          <button onClick={() => switchTab('accounting')}
            className="px-4 py-1.5 rounded-lg text-sm font-bold transition-all"
            style={tab === 'accounting'
              ? { background: 'rgba(96,165,250,0.25)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.4)' }
              : { color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }}>
            📊 บัญชีเกม
          </button>
        </div>

        {tab === 'inventory' && (
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            ➕ เพิ่มของรางวัล
          </button>
        )}
        {tab === 'accounting' && (
          <button onClick={loadAccounting}
            className="px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}>
            🔄 รีโหลด
          </button>
        )}
      </div>

      {/* ── INVENTORY TAB ─────────────────────────────────────── */}
      {tab === 'inventory' && (
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
          {invLoading ? (
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
                    <td colSpan={2} className="px-5 py-3 text-white/60">รวมทั้งหมด</td>
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
      )}

      {/* ── ACCOUNTING TAB ─────────────────────────────────────── */}
      {tab === 'accounting' && (
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'รายรับรวม (ทุกห้อง)', value: fmt(totalRevenue), color: '#10b981', icon: '💵' },
              { label: 'ของรางวัลที่จ่ายแล้ว', value: `${totalPrizesOut} รางวัล`, color: '#f87171', icon: '🎁' },
              { label: 'มูลค่ารางวัลรวม', value: fmt(totalPrizeVal), color: '#fbbf24', icon: '💎' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="rounded-2xl p-4 border border-white/10 text-center"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="text-2xl mb-1">{icon}</div>
                <div className="text-xl font-black" style={{ color }}>{value}</div>
                <div className="text-xs text-white/40 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Room list */}
          {accLoading ? (
            <div className="text-center py-16 text-white/30 animate-pulse">⏳ กำลังโหลด...</div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-white/30">ยังไม่มีประวัติเกม</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map(room => {
                const aliases = getUniqueAliases(room);
                const rev = aliases.length * (room.ticket_price || 0);
                const given = prizesGiven(room);
                const prizeVal = prizeValueGiven(room);
                const isExpanded = expandedRoom === room.id;
                const color = STATUS_COLOR[room.status] || '#6b7280';

                return (
                  <div key={room.id} className="rounded-2xl border border-white/10 overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {/* Room header row */}
                    <div
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setExpandedRoom(isExpanded ? null : room.id)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base">{room.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
                            {STATUS_LABEL[room.status] || room.status}
                          </span>
                        </div>
                        <div className="text-xs text-white/35 mt-0.5">
                          {new Date(room.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {' · '}{room.total_rounds} รอบ
                        </div>
                      </div>
                      {/* Quick stats */}
                      <div className="flex items-center gap-6 flex-shrink-0 text-sm">
                        <div className="text-center">
                          <div className="font-bold text-white">{aliases.length}</div>
                          <div className="text-xs text-white/30">ผู้เล่น</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-white">{fmt(room.ticket_price || 0)}</div>
                          <div className="text-xs text-white/30">ราคาบัตร</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-emerald-400">{fmt(rev)}</div>
                          <div className="text-xs text-white/30">รายรับ</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-orange-400">{given}</div>
                          <div className="text-xs text-white/30">รางวัลจ่าย</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-yellow-400">{fmt(prizeVal)}</div>
                          <div className="text-xs text-white/30">มูลค่ารางวัล</div>
                        </div>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>{isExpanded ? '▲' : '▼'}</div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-white/8 px-5 py-4 space-y-4">
                        {/* Action buttons */}
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => printPlayerList(room)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                            style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}>
                            🖨️ พิมพ์รายชื่อผู้เล่น ({aliases.length} คน)
                          </button>
                        </div>

                        {/* Round breakdown */}
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-wide mb-2">สรุปแต่ละรอบ</p>
                          <div className="space-y-2">
                            {room.rounds.map(rnd => (
                              <div key={rnd.id} className="rounded-xl px-4 py-3 border border-white/6"
                                style={{ background: 'rgba(255,255,255,0.03)' }}>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-bold text-purple-300">รอบ {rnd.round_number} {rnd.is_golden ? '⚡' : ''}</span>
                                  <span className="text-xs text-white/40">{rnd.pattern}</span>
                                  {rnd.prize && <span className="text-xs text-yellow-400">🎁 {rnd.prize}</span>}
                                  {rnd.prize_inventory && <span className="text-xs text-orange-400">📦 {rnd.prize_inventory.name} ({fmt(rnd.prize_inventory.value)})</span>}
                                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${rnd.status === 'finished' ? 'text-gray-400 bg-white/5' : rnd.status === 'active' ? 'text-green-400 bg-green-500/10' : 'text-white/30 bg-white/4'}`}>
                                    {rnd.status === 'finished' ? '✅ จบ' : rnd.status === 'active' ? '🟢 เล่น' : '⏳ รอ'}
                                  </span>
                                </div>
                                {rnd.winners?.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {rnd.winners.map((w, i) => (
                                      <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
                                        🏆 {w.alias}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {(!rnd.winners || rnd.winners.length === 0) && rnd.status === 'finished' && (
                                  <p className="text-xs text-white/20 mt-1">ไม่มีผู้ชนะ</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Player list preview */}
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-wide mb-2">รายชื่อผู้เล่น ({aliases.length} คน)</p>
                          <div className="flex flex-wrap gap-1">
                            {aliases.map((a, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
                                {a}
                              </span>
                            ))}
                            {aliases.length === 0 && <span className="text-xs text-white/20">ยังไม่มีผู้เล่น</span>}
                          </div>
                        </div>

                        {/* Revenue summary */}
                        <div className="rounded-xl px-4 py-3 border border-white/8 text-sm"
                          style={{ background: 'rgba(16,185,129,0.06)' }}>
                          <div className="flex justify-between items-center">
                            <span className="text-white/50">รายรับบัตร ({aliases.length} × {fmt(room.ticket_price || 0)})</span>
                            <span className="font-bold text-emerald-400">{fmt(rev)}</span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-white/50">มูลค่ารางวัลที่จ่าย</span>
                            <span className="font-bold text-orange-400">- {fmt(prizeVal)}</span>
                          </div>
                          <div className="border-t border-white/10 mt-2 pt-2 flex justify-between items-center">
                            <span className="font-bold text-white/70">กำไร/ขาดทุน</span>
                            <span className={`font-black text-lg ${rev - prizeVal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {fmt(rev - prizeVal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ADD PRIZE MODAL ──────────────────────────────────── */}
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
