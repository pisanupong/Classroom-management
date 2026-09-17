import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const ROLE_LEVEL = { STUDENT: 0, TEACHER: 1, ADMIN: 2, SUPER_USER: 3 };
const PATTERN_OPTIONS = [
  { value: 'line',    label: '📏 เส้นตรง' },
  { value: 'full',    label: '🟩 เต็มบอร์ด' },
  { value: 'corners', label: '🔲 4 มุม' },
  { value: 'T',       label: '🔠 ตัว T' },
  { value: 'L',       label: '🔡 ตัว L' },
];

const STATUS_BADGE = {
  waiting: { text: 'รอเล่น', color: '#10b981' },
  playing: { text: '🎲 กำลังเล่น', color: '#f59e0b' },
  finished: { text: 'จบแล้ว', color: '#6b7280' },
};

export default function BingoLobby() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isTeacher = (ROLE_LEVEL[user?.role] ?? 0) >= ROLE_LEVEL['TEACHER'];

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [prizes, setPrizes] = useState([]);

  const [form, setForm] = useState({
    name: '',
    total_rounds: 3,
    rounds_config: [
      { pattern: 'line', prize: '', is_golden: false, prize_inventory_id: null },
      { pattern: 'line', prize: '', is_golden: false, prize_inventory_id: null },
      { pattern: 'full', prize: '', is_golden: true,  prize_inventory_id: null },
    ],
  });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/bingo/rooms').then(r => setRooms(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  const openCreate = () => {
    if (isTeacher) api.get('/bingo/prizes').then(r => setPrizes(r.data)).catch(() => {});
    setShowCreate(true);
  };

  useEffect(() => { load(); }, []);

  const updateRoundsCount = (count) => {
    const n = Math.max(1, Math.min(10, parseInt(count) || 1));
    const current = form.rounds_config;
    const newConfig = Array.from({ length: n }, (_, i) => current[i] || { pattern: 'line', prize: '', is_golden: false, prize_inventory_id: null });
    setForm(f => ({ ...f, total_rounds: n, rounds_config: newConfig }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateErr('');
    setCreating(true);
    try {
      const r = await api.post('/bingo/rooms', {
        name: form.name,
        total_rounds: form.total_rounds,
        rounds_config: form.rounds_config,
      });
      navigate(`/bingo/host/${r.data.id}`);
    } catch (e) {
      setCreateErr(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setCreating(false);
    }
  };

  const deleteRoom = async (id) => {
    if (!window.confirm('ลบห้องนี้?')) return;
    await api.delete(`/bingo/rooms/${id}`);
    setRooms(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg,#0f172a,#1e1b4b)', fontFamily: "'Segoe UI',sans-serif" }}>
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between"
        style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-white/40 hover:text-white text-sm transition-colors">← Dashboard</button>
          <span className="text-white/20">|</span>
          <h1 className="text-xl font-black">🎱 Bingo Online</h1>
        </div>
        {isTeacher && (
          <div className="flex gap-2">
            <button onClick={() => navigate('/bingo/account')}
              className="px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' }}>
              💰 คลังรางวัล
            </button>
            <button onClick={openCreate}
              className="px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
              ➕ สร้างห้องใหม่
            </button>
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-20 text-white/30 text-lg animate-pulse">⏳ กำลังโหลด...</div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎱</div>
            <p className="text-white/30 text-lg">ยังไม่มีห้อง Bingo</p>
            {isTeacher && <p className="text-white/20 text-sm mt-2">กด "สร้างห้องใหม่" เพื่อเริ่มเกม</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map(room => {
              const badge = STATUS_BADGE[room.status] || STATUS_BADGE.waiting;
              return (
                <div key={room.id} className="rounded-2xl p-5 border border-white/10 transition-all hover:border-white/20"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="font-black text-lg">{room.name}</h2>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{ background: `${badge.color}22`, color: badge.color, border: `1px solid ${badge.color}44` }}>
                          {badge.text}
                        </span>
                        {room.rounds?.some(r => r.is_golden) && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>⚡ มีรอบทอง</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-white/40 flex-wrap">
                        <span>📋 {room.total_rounds} รอบ</span>
                        <span>👥 {room._count?.cards || 0} ผู้เล่น</span>
                        <span>🕐 {new Date(room.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {/* Round previews */}
                      {room.rounds?.length > 0 && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {room.rounds.map(rnd => (
                            <span key={rnd.id} className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                              {rnd.is_golden ? '⚡' : '•'} รอบ{rnd.round_number} {rnd.prize ? `🎁${rnd.prize}` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {isTeacher && room.status !== 'finished' && (
                        <button onClick={() => navigate(`/bingo/host/${room.id}`)}
                          className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)' }}>
                          🎛️ ควบคุม
                        </button>
                      )}
                      <button onClick={() => navigate(`/bingo/play/${room.id}`)}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                        🎲 เล่น
                      </button>
                      {isTeacher && (
                        <button onClick={() => deleteRoom(room.id)}
                          className="px-3 py-1.5 rounded-xl text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                          🗑️ ลบ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="w-full max-w-lg rounded-2xl p-6 border border-white/10 max-h-[90vh] overflow-y-auto"
            style={{ background: 'rgba(15,23,42,0.98)' }}>
            <h3 className="font-bold text-xl mb-5">🎱 สร้างห้อง Bingo</h3>
            {createErr && <p className="text-red-400 text-sm mb-3">{createErr}</p>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-white/50 block mb-1">ชื่อห้อง *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                  placeholder="เช่น Bingo ป.5/1 เทอม 1"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-400 placeholder-white/20" />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">จำนวนรอบ</label>
                <input type="number" min={1} max={10} value={form.total_rounds}
                  onChange={e => updateRoundsCount(e.target.value)}
                  className="w-24 px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-400" />
              </div>

              {/* Per-round config */}
              <div className="space-y-3">
                <p className="text-xs text-white/50">ตั้งค่าแต่ละรอบ</p>
                {form.rounds_config.map((rnd, i) => (
                  <div key={i} className="rounded-xl p-3 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-sm text-purple-300">รอบ {i + 1}</span>
                      <label className="flex items-center gap-1.5 text-xs text-white/40 cursor-pointer ml-auto">
                        <input type="checkbox" checked={rnd.is_golden}
                          onChange={e => setForm(f => {
                            const c = [...f.rounds_config];
                            c[i] = { ...c[i], is_golden: e.target.checked };
                            return { ...f, rounds_config: c };
                          })} />
                        ⚡ รอบนาทีทอง
                      </label>
                    </div>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-white/30 block mb-1">รูปแบบชนะ</label>
                          <select value={rnd.pattern}
                            onChange={e => setForm(f => {
                              const c = [...f.rounds_config];
                              c[i] = { ...c[i], pattern: e.target.value };
                              return { ...f, rounds_config: c };
                            })}
                            className="w-full px-2 py-1.5 rounded-lg bg-white/10 border border-white/10 text-sm text-white focus:outline-none"
                            style={{ colorScheme: 'dark' }}>
                            {PATTERN_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#0f172a' }}>{o.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-white/30 block mb-1">เลือกจากคลัง</label>
                          <select
                            value={rnd.prize_inventory_id || ''}
                            onChange={e => {
                              const selId = e.target.value ? parseInt(e.target.value) : null;
                              const selPrize = prizes.find(p => p.id === selId);
                              setForm(f => {
                                const c = [...f.rounds_config];
                                c[i] = {
                                  ...c[i],
                                  prize_inventory_id: selId,
                                  prize: selPrize ? selPrize.name : c[i].prize,
                                };
                                return { ...f, rounds_config: c };
                              });
                            }}
                            className="w-full px-2 py-1.5 rounded-lg bg-white/10 border border-white/10 text-sm text-white focus:outline-none"
                            style={{ colorScheme: 'dark' }}>
                            <option value="" style={{ background: '#0f172a' }}>-- ไม่ระบุ --</option>
                            {prizes.map(p => (
                              <option key={p.id} value={p.id} style={{ background: '#0f172a' }}
                                disabled={p.remaining === 0}>
                                {p.name} ({p.remaining} เหลือ){p.remaining === 0 ? ' ❌' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/30 block mb-1">ของรางวัล (ชื่อ)</label>
                        <input value={rnd.prize}
                          onChange={e => setForm(f => {
                            const c = [...f.rounds_config];
                            c[i] = { ...c[i], prize: e.target.value, prize_inventory_id: null };
                            return { ...f, rounds_config: c };
                          })}
                          placeholder="เช่น ดินสอ 1 แท่ง"
                          className="w-full px-2 py-1.5 rounded-lg bg-white/10 border border-white/10 text-sm text-white focus:outline-none placeholder-white/20" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white transition-colors text-sm">
                  ยกเลิก
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                  {creating ? '⏳ กำลังสร้าง...' : '✨ สร้างห้อง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
