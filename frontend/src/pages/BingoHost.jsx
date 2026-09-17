import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const PATTERN_LABEL = {
  line:    '📏 เส้นตรง',
  full:    '🟩 เต็มบอร์ด',
  corners: '🔲 4 มุม',
  T:       '🔠 ตัว T',
  L:       '🔡 ตัว L',
};
const BINGO_COL = ['B', 'I', 'N', 'G', 'O'];

const colOf = (n) => {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
};

export default function BingoHost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const socketRef = useRef(null);
  const autoRef   = useRef(null);

  const [room,          setRoom]          = useState(null);
  const [rounds,        setRounds]        = useState([]);
  const [drawn,         setDrawn]         = useState([]);
  const [lastDrawn,     setLastDrawn]     = useState(null);
  const [winners,       setWinners]       = useState([]);
  const [playerCount,   setPlayerCount]   = useState(0);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [players,       setPlayers]       = useState([]); // unique aliases
  const [activeRoundIdx, setActiveRoundIdx] = useState(0);
  const [roundStatus,   setRoundStatus]   = useState('pending');
  const [editPrizes,    setEditPrizes]    = useState(false);
  const [prizeDraft,    setPrizeDraft]    = useState([]);
  const [autoMode,      setAutoMode]      = useState(false);
  const [displayFormat, setDisplayFormat] = useState('grid'); // 'grid' | 'list' | 'columns'
  const [portraitWarn,  setPortraitWarn]  = useState(false);
  const [gameEnded,     setGameEnded]     = useState(false);

  const playerUrl = `${window.location.origin}/bingo/play/${id}`;

  // Portrait detection
  useEffect(() => {
    const check = () => setPortraitWarn(window.innerWidth < 900 && window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load room
  useEffect(() => {
    api.get(`/bingo/rooms/${id}`).then(r => {
      setRoom(r.data);
      const uniquePlayers = [...new Set((r.data.cards || []).map(c => c.alias))].sort();
      setPlayers(uniquePlayers);
      setRegisteredCount(uniquePlayers.length);
      setRounds(r.data.rounds || []);
      setDrawn(r.data.drawn_numbers || []);
      setPrizeDraft((r.data.rounds || []).map(rnd => ({
        id:          rnd.id,
        pattern:     rnd.pattern,
        prize:       rnd.prize       || '',
        prize_image: rnd.prize_image || '',
        prize_value: rnd.prize_value !== undefined ? String(rnd.prize_value) : '0',
        is_golden:   rnd.is_golden,
      })));
      const activeIdx = (r.data.rounds || []).findIndex(rnd => rnd.status === 'active');
      if (activeIdx >= 0) {
        setActiveRoundIdx(activeIdx);
        setRoundStatus('active');
        setDrawn(r.data.rounds[activeIdx].drawn_numbers || []);
      }
    }).catch(() => navigate('/bingo'));
  }, [id]);

  // Refresh registered count every 10s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await api.get(`/bingo/rooms/${id}`);
        const uniquePlayers = [...new Set((r.data.cards || []).map(c => c.alias))].sort();
        setPlayers(uniquePlayers);
        setRegisteredCount(uniquePlayers.length);
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  // Socket
  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', { auth: { token } });
    socketRef.current = socket;
    socket.emit('bingo:join_room', { roomId: id, alias: `HOST:${user?.name}` });

    socket.on('bingo:player_count', ({ count }) => setPlayerCount(count));
    socket.on('bingo:number_drawn', ({ number, drawn: d }) => { setDrawn(d); setLastDrawn(number); });
    socket.on('bingo:round_started', ({ round }) => {
      setRoundStatus('active');
      setDrawn([]);
      setLastDrawn(null);
    });
    socket.on('bingo:round_ended', () => setRoundStatus('finished'));
    socket.on('bingo:winner',  (w)  => setWinners(prev => [...prev, w]));
    socket.on('bingo:game_ended', () => { stopAutoMode(); setGameEnded(true); });

    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
      socket.disconnect();
    };
  }, [id]);

  const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
  const remaining  = allNumbers.filter(n => !drawn.includes(n));

  const drawNumber = useCallback(() => {
    if (remaining.length === 0 || roundStatus !== 'active') return;
    const idx    = Math.floor(Math.random() * remaining.length);
    const number = remaining[idx];
    socketRef.current?.emit('bingo:draw_number', { roomId: id, number });
  }, [remaining, roundStatus, id]);

  const startAutoMode = () => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => drawNumber(), 5000);
    setAutoMode(true);
  };
  const stopAutoMode = () => {
    clearInterval(autoRef.current);
    autoRef.current = null;
    setAutoMode(false);
  };

  const startRound = () => {
    const rnd = rounds[activeRoundIdx];
    if (!rnd) return;
    socketRef.current?.emit('bingo:start_round', { roomId: id, roundId: rnd.id });
    setRoundStatus('active');
    setDrawn([]);
    setLastDrawn(null);
    setWinners([]);
  };

  const endRound = () => {
    stopAutoMode();
    const rnd = rounds[activeRoundIdx];
    if (!rnd) return;
    socketRef.current?.emit('bingo:end_round', { roomId: id, roundId: rnd.id });
    setRoundStatus('finished');
  };

  const nextRound = () => {
    if (activeRoundIdx + 1 < rounds.length) {
      setActiveRoundIdx(activeRoundIdx + 1);
      setRoundStatus('pending');
      setDrawn([]);
      setLastDrawn(null);
      setWinners([]);
    } else {
      socketRef.current?.emit('bingo:end_game', { roomId: id });
    }
  };

  const savePrizes = async () => {
    const payload = prizeDraft.map(p => ({
      ...p,
      prize_value: parseFloat(p.prize_value) || 0,
    }));
    await api.put(`/bingo/rooms/${id}/rounds`, { rounds: payload });
    setRounds(prev => prev.map(r => {
      const d = payload.find(p => p.id === r.id);
      return d ? { ...r, ...d } : r;
    }));
    setEditPrizes(false);
  };

  if (!room) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff' }}>
      <div style={{ fontSize: '20px', animation: 'pulse 1s infinite' }}>⏳ กำลังโหลด...</div>
    </div>
  );

  const activeRound = rounds[activeRoundIdx];

  /* ── Number display components ─────────────────────────────── */

  // Grid view: proper BINGO column order (B=1-15, I=16-30, etc.)
  const GridDisplay = () => (
    <div style={{ borderRadius: '16px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '4px', marginBottom: '4px' }}>
        {BINGO_COL.map(c => (
          <div key={c} style={{ textAlign: 'center', fontWeight: 900, fontSize: '18px', color: '#c4b5fd' }}>{c}</div>
        ))}
      </div>
      {/* 15 rows × 5 cols — column-major so B col = 1-15, I col = 16-30, etc. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '3px' }}>
        {Array.from({ length: 15 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => {
            const n = col * 15 + row + 1;
            const isDone = drawn.includes(n);
            const isLast = n === lastDrawn;
            return (
              <div key={n}
                onClick={() => { if (roundStatus === 'active') socketRef.current?.emit('bingo:draw_number', { roomId: id, number: n }); }}
                style={{
                  aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: roundStatus === 'active' ? 'pointer' : 'default',
                  background: isLast ? '#7c3aed' : isDone ? 'rgba(124,58,237,0.45)' : 'rgba(255,255,255,0.06)',
                  color: isDone ? '#fff' : 'rgba(255,255,255,0.3)',
                  border: isLast ? '2px solid #a78bfa' : isDone ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.07)',
                  transform: isLast ? 'scale(1.12)' : undefined,
                  boxShadow: isLast ? '0 0 12px rgba(124,58,237,0.7)' : undefined,
                  transition: 'all 0.2s',
                }}>
                {n}
              </div>
            );
          })
        ).flat()}
      </div>
    </div>
  );

  // List view: drawn numbers in order
  const ListView = () => (
    <div style={{ borderRadius: '16px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
      {drawn.length === 0
        ? <p style={{ color: 'rgba(255,255,255,0.2)', textAlign: 'center', fontSize: '14px', margin: '20px 0' }}>ยังไม่มีตัวเลข</p>
        : (
          <>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: '0 0 8px' }}>
              ลำดับที่สุ่ม ({drawn.length} ตัว) — ล่าสุดอยู่ท้าย
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {drawn.map((n, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', padding: '4px 10px',
                  borderRadius: '999px', fontSize: '13px', fontWeight: 700,
                  background: n === lastDrawn ? 'rgba(124,58,237,0.9)' : 'rgba(255,255,255,0.12)',
                  border: n === lastDrawn ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  boxShadow: n === lastDrawn ? '0 0 10px rgba(124,58,237,0.5)' : undefined,
                }}>
                  {colOf(n)}-{n}
                </span>
              ))}
            </div>
          </>
        )
      }
    </div>
  );

  // Columns view: group drawn by B/I/N/G/O column
  const ColumnsDisplay = () => {
    const colNums = {
      B: drawn.filter(n => n <= 15),
      I: drawn.filter(n => n > 15 && n <= 30),
      N: drawn.filter(n => n > 30 && n <= 45),
      G: drawn.filter(n => n > 45 && n <= 60),
      O: drawn.filter(n => n > 60),
    };
    const colColors = { B: '#60a5fa', I: '#34d399', N: '#fbbf24', G: '#f87171', O: '#c084fc' };
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px' }}>
        {BINGO_COL.map(c => (
          <div key={c} style={{
            borderRadius: '14px', padding: '10px 8px', textAlign: 'center',
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${colColors[c]}22`,
          }}>
            <div style={{ fontWeight: 900, fontSize: '20px', color: colColors[c], marginBottom: '8px' }}>{c}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              {colNums[c].length === 0
                ? <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px' }}>-</span>
                : colNums[c].map(n => (
                  <span key={n} style={{
                    display: 'block', width: '100%', padding: '3px 0',
                    borderRadius: '8px', fontSize: '14px', fontWeight: 800,
                    background: n === lastDrawn ? colColors[c] : `${colColors[c]}25`,
                    color: n === lastDrawn ? '#000' : colColors[c],
                    border: `1px solid ${colColors[c]}44`,
                  }}>
                    {n}
                  </span>
                ))
              }
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* ── Main render ──────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: '100dvh', color: '#fff',
      background: 'linear-gradient(135deg,#0f172a,#1e1b4b)',
      fontFamily: "'Segoe UI',sans-serif",
      position: 'relative',
    }}>

      {/* Portrait warning overlay */}
      {portraitWarn && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '56px', marginBottom: '12px' }}>📱↔️</div>
          <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 8px' }}>หมุนหน้าจอ</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 20px', maxWidth: '260px' }}>
            หน้า Host Bingo ออกแบบมาสำหรับหน้าจอแนวนอน เพื่อแสดงบนโปรเจกเตอร์
          </p>
          <button onClick={() => setPortraitWarn(false)}
            style={{ padding: '10px 22px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px' }}>
            ดูต่อแบบแนวตั้ง
          </button>
        </div>
      )}

      {/* Game-ended summary overlay */}
      {gameEnded && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}>
          <div style={{
            width: '100%', maxWidth: '520px', borderRadius: '24px', padding: '32px',
            border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(30,27,75,0.95)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '64px', marginBottom: '12px' }}>🏆</div>
            <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 4px' }}>เกมจบแล้ว!</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', margin: '0 0 24px', fontSize: '15px' }}>{room?.name}</p>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'ผู้เล่น', value: registeredCount, color: '#34d399', icon: '👥' },
                { label: 'รายรับบัตร', value: `฿${((registeredCount) * (room?.ticket_price || 0)).toLocaleString('th-TH')}`, color: '#60a5fa', icon: '💵' },
                { label: 'รางวัลจ่าย', value: `${winners.length} รางวัล`, color: '#fbbf24', icon: '🎁' },
              ].map(({ label, value, color, icon }) => (
                <div key={label} style={{ borderRadius: '16px', padding: '16px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>{icon}</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color }}>{value}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Winners per round */}
            {rounds.length > 0 && (
              <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  ผู้ชนะแต่ละรอบ
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {rounds.map((rnd, i) => {
                    const rndWinners = winners.filter(w => w.roundId === rnd.id);
                    return (
                      <div key={rnd.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#c4b5fd', minWidth: '48px' }}>รอบ {i + 1}</span>
                        {rnd.prize && <span style={{ fontSize: '12px', color: '#fbbf24' }}>🎁 {rnd.prize}</span>}
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {rndWinners.length > 0
                            ? rndWinners.map((w, j) => (
                              <span key={j} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                                🏆 {w.alias}
                              </span>
                            ))
                            : <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>ไม่มีผู้ชนะ</span>
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => navigate('/bingo/account?tab=accounting')}
                style={{ flex: 1, padding: '12px', borderRadius: '14px', fontWeight: 700, fontSize: '14px',
                  border: '1px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.12)',
                  color: '#60a5fa', cursor: 'pointer' }}>
                📊 ดูบัญชีเกม
              </button>
              <button onClick={() => navigate('/bingo')}
                style={{ flex: 1, padding: '12px', borderRadius: '14px', fontWeight: 700, fontSize: '14px',
                  border: 'none', background: 'linear-gradient(135deg,#7c3aed,#3b82f6)',
                  color: '#fff', cursor: 'pointer' }}>
                🏠 กลับหน้า Bingo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '8px 16px',
        background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <button onClick={() => navigate('/bingo')}
            style={{ color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>← กลับ</button>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span style={{ fontWeight: 700, fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            🎱 {room.name}
          </span>
          {activeRound?.is_golden && (
            <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800,
              background: 'linear-gradient(90deg,#f59e0b,#ef4444)', flexShrink: 0 }}>
              ⚡ รอบทองคำ!
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Player count badge */}
          <div style={{
            padding: '4px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 700,
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)',
            color: '#34d399', display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            👥 <span style={{ fontSize: '15px' }}>{playerCount}</span>
            {registeredCount > 0 && (
              <span style={{ color: 'rgba(52,211,153,0.5)', fontWeight: 400 }}>/ {registeredCount}</span>
            )}
            <span style={{ color: 'rgba(52,211,153,0.6)', fontSize: '11px', fontWeight: 400 }}>ผู้เล่น</span>
          </div>

          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
            รอบ {activeRoundIdx + 1}/{rounds.length}
          </span>

          <button onClick={() => window.open(`/bingo/display/${id}`, '_blank')}
            style={{ padding: '4px 12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.5)',
              color: '#818cf8', background: 'rgba(99,102,241,0.1)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
            📺 Display
          </button>
          <button onClick={() => { if (window.confirm('จบเกมเลยไหม?')) socketRef.current?.emit('bingo:end_game', { roomId: id }); }}
            style={{ padding: '4px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)',
              color: '#f87171', background: 'transparent', cursor: 'pointer', fontSize: '12px' }}>
            จบเกม
          </button>
        </div>
      </div>

      {/* ── Body (3-column landscape layout) ── */}
      <div style={{ display: 'flex', gap: '12px', padding: '12px', maxWidth: '1600px', margin: '0 auto' }}>

        {/* ── LEFT: Controls ── */}
        <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Round controls — TOP */}
          <div style={{ borderRadius: '16px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              รอบที่ {activeRoundIdx + 1}
            </p>
            {activeRound && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', color: '#c4b5fd', marginBottom: '4px' }}>
                  {PATTERN_LABEL[activeRound.pattern] || activeRound.pattern}
                </div>
                {activeRound.prize && (
                  <div style={{ padding: '6px 10px', borderRadius: '10px', textAlign: 'center',
                    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <p style={{ margin: 0, fontSize: '10px', color: 'rgba(251,191,36,0.6)' }}>ของรางวัล</p>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#fbbf24' }}>{activeRound.prize}</p>
                  </div>
                )}
              </div>
            )}

            {roundStatus === 'pending' && (
              <button onClick={startRound} style={{ width: '100%', padding: '10px', borderRadius: '12px', fontWeight: 700, fontSize: '14px', color: '#fff', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                ▶ เริ่มรอบนี้
              </button>
            )}
            {roundStatus === 'active' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button onClick={drawNumber} disabled={remaining.length === 0}
                  style={{ width: '100%', padding: '10px', borderRadius: '12px', fontWeight: 700, fontSize: '14px',
                    color: '#fff', border: 'none', cursor: remaining.length === 0 ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg,#7c3aed,#db2777)', opacity: remaining.length === 0 ? 0.4 : 1 }}>
                  🎲 สุ่มตัวเลข
                </button>
                {!autoMode
                  ? <button onClick={startAutoMode} style={{ width: '100%', padding: '7px', borderRadius: '10px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>⏩ Auto (5 วิ)</button>
                  : <button onClick={stopAutoMode} style={{ width: '100%', padding: '7px', borderRadius: '10px', fontSize: '12px', border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#f87171', cursor: 'pointer' }}>⏹ หยุด Auto</button>
                }
                <button onClick={endRound} style={{ width: '100%', padding: '7px', borderRadius: '10px', fontSize: '12px', border: '1px solid rgba(251,146,60,0.4)', background: 'transparent', color: '#fb923c', cursor: 'pointer' }}>🏁 จบรอบ</button>
              </div>
            )}
            {roundStatus === 'finished' && (
              <button onClick={nextRound} style={{ width: '100%', padding: '10px', borderRadius: '12px', fontWeight: 700, fontSize: '14px', color: '#fff', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#3b82f6,#7c3aed)' }}>
                {activeRoundIdx + 1 < rounds.length ? '➡ รอบถัดไป' : '🏆 จบเกม'}
              </button>
            )}
          </div>

          {/* QR Code — hidden when drawing numbers */}
          {roundStatus !== 'active' && (
            <div style={{ borderRadius: '16px', padding: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', margin: '0 0 8px', letterSpacing: '1px', textTransform: 'uppercase' }}>สแกนเพื่อเล่น</p>
              <div style={{ display: 'inline-block', padding: '10px', borderRadius: '12px', background: '#fff' }}>
                <QRCodeSVG value={playerUrl} size={140} />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', marginTop: '6px', wordBreak: 'break-all' }}>{playerUrl}</p>
            </div>
          )}

          {/* Player list */}
          <div style={{ borderRadius: '16px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', flex: roundStatus === 'active' ? '1' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                👥 ผู้เล่น
              </p>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#34d399' }}>
                {playerCount} / {registeredCount}
              </span>
            </div>
            {players.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', textAlign: 'center', padding: '8px 0', margin: 0 }}>รอผู้เล่นเข้าร่วม...</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: roundStatus === 'active' ? '280px' : '140px', overflowY: 'auto' }}>
                {players.map((alias, i) => (
                  <div key={alias} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 6px', borderRadius: '8px', fontSize: '12px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', minWidth: '16px' }}>{i + 1}</span>
                    <span style={{ fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alias}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Winners */}
          <div style={{ borderRadius: '16px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏆 ผู้ชนะ</p>
            {winners.length === 0
              ? <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', textAlign: 'center', padding: '8px 0', margin: 0 }}>ยังไม่มีผู้ชนะ</p>
              : winners.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '12px' }}>
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>#{i + 1}</span>
                  <span style={{ fontWeight: 600 }}>{w.alias}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* ── CENTER: Main display ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Last drawn — big display */}
          <div style={{
            borderRadius: '20px', padding: '16px 20px', textAlign: 'center',
            background: lastDrawn ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
            border: `2px solid ${lastDrawn ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)'}`,
          }}>
            {lastDrawn ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                <div>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>ตัวเลขล่าสุด</p>
                  <div style={{ fontSize: '72px', fontWeight: 900, lineHeight: 1, color: '#a78bfa',
                    textShadow: '0 0 40px rgba(167,139,250,0.6)' }}>
                    {colOf(lastDrawn)}-{lastDrawn}
                  </div>
                </div>
                <div style={{ textAlign: 'left', paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>สุ่มไปแล้ว</p>
                  <p style={{ margin: 0, fontSize: '36px', fontWeight: 900, color: '#c4b5fd', lineHeight: 1 }}>
                    {drawn.length}<span style={{ fontSize: '16px', fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>/75</span>
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>เหลือ {remaining.length} ตัว</p>
                </div>
              </div>
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '20px', margin: '8px 0' }}>
                {roundStatus === 'active' ? '🎲 กดสุ่มตัวเลข' : '⏳ รอเริ่มรอบ'}
              </p>
            )}
          </div>

          {/* Prize image (if set for active round) */}
          {activeRound?.prize_image && (
            <div style={{ borderRadius: '16px', overflow: 'hidden', textAlign: 'center',
              border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)', padding: '12px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'rgba(251,191,36,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>🎁 ของรางวัลรอบนี้</p>
              <img src={activeRound.prize_image} alt="รางวัล"
                style={{ maxHeight: '120px', maxWidth: '100%', objectFit: 'contain', borderRadius: '10px' }}
                onError={e => { e.target.style.display = 'none'; }} />
              {activeRound.prize && (
                <p style={{ margin: '8px 0 0', fontWeight: 700, fontSize: '16px', color: '#fbbf24' }}>
                  {activeRound.prize}
                </p>
              )}
            </div>
          )}

          {/* Display format selector */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginRight: '2px' }}>แสดงตัวเลข:</span>
            {[
              { key: 'grid',    label: '🗂 ตาราง' },
              { key: 'list',    label: '📋 ลำดับ' },
              { key: 'columns', label: '🔠 คอลัมน์' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setDisplayFormat(key)}
                style={{
                  padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: displayFormat === key ? 700 : 400,
                  border: `1px solid ${displayFormat === key ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  background: displayFormat === key ? 'rgba(124,58,237,0.25)' : 'transparent',
                  color: displayFormat === key ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Number display area */}
          {displayFormat === 'grid'    && <GridDisplay />}
          {displayFormat === 'list'    && <ListView />}
          {displayFormat === 'columns' && <ColumnsDisplay />}
        </div>

        {/* ── RIGHT: Rounds list + Prize editor ── */}
        <div style={{ width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Rounds list */}
          <div>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 6px 2px' }}>รอบทั้งหมด</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {rounds.map((rnd, i) => (
                <div key={rnd.id}
                  onClick={() => { if (roundStatus !== 'active') { setActiveRoundIdx(i); setRoundStatus(rnd.status === 'active' ? 'active' : rnd.status === 'finished' ? 'finished' : 'pending'); } }}
                  style={{
                    borderRadius: '12px', padding: '10px 12px', cursor: roundStatus !== 'active' ? 'pointer' : 'default',
                    border: `1px solid ${i === activeRoundIdx ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.07)'}`,
                    background: i === activeRoundIdx ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>รอบ {i + 1} {rnd.is_golden ? '⚡' : ''}</span>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '999px',
                      background: rnd.status === 'active' ? 'rgba(16,185,129,0.2)' : rnd.status === 'finished' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                      color: rnd.status === 'active' ? '#34d399' : rnd.status === 'finished' ? '#9ca3af' : '#6b7280' }}>
                      {rnd.status === 'active' ? '🟢 เล่น' : rnd.status === 'finished' ? '✅ จบ' : '⏳ รอ'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{PATTERN_LABEL[rnd.pattern] || rnd.pattern}</p>
                  {rnd.prize && <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'rgba(251,191,36,0.7)' }}>🎁 {rnd.prize}</p>}
                  {rnd.winners?.length > 0 && <p style={{ margin: '2px 0 0', fontSize: '10px', color: 'rgba(52,211,153,0.7)' }}>🏆 {rnd.winners.length} คน</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Prize editor */}
          <div style={{ borderRadius: '16px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🎁 ตั้งรางวัล</p>
              {editPrizes
                ? <button onClick={savePrizes} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', cursor: 'pointer' }}>บันทึก</button>
                : <button onClick={() => setEditPrizes(true)} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>แก้ไข</button>
              }
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {prizeDraft.map((r, i) => (
                <div key={r.id}>
                  <p style={{ margin: '0 0 4px', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>รอบ {i + 1} {r.is_golden ? '⚡' : ''}</p>
                  {editPrizes ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <input value={r.prize}
                        onChange={e => setPrizeDraft(prev => prev.map((p, j) => j === i ? { ...p, prize: e.target.value } : p))}
                        placeholder="ชื่อของรางวัล"
                        style={{ width: '100%', padding: '5px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
                      <input value={r.prize_image}
                        onChange={e => setPrizeDraft(prev => prev.map((p, j) => j === i ? { ...p, prize_image: e.target.value } : p))}
                        placeholder="URL รูปภาพ (ถ้ามี)"
                        style={{ width: '100%', padding: '5px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '10px', outline: 'none', boxSizing: 'border-box' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>มูลค่า ฿</span>
                        <input type="number" min="0" step="0.5"
                          value={r.prize_value || '0'}
                          onChange={e => setPrizeDraft(prev => prev.map((p, j) => j === i ? { ...p, prize_value: e.target.value } : p))}
                          style={{ flex: 1, padding: '5px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: '11px', outline: 'none' }} />
                      </div>
                      <select value={r.pattern}
                        onChange={e => setPrizeDraft(prev => prev.map((p, j) => j === i ? { ...p, pattern: e.target.value } : p))}
                        style={{ width: '100%', padding: '5px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#1e1b4b', color: '#fff', fontSize: '11px', outline: 'none' }}>
                        {Object.entries(PATTERN_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={r.is_golden}
                          onChange={e => setPrizeDraft(prev => prev.map((p, j) => j === i ? { ...p, is_golden: e.target.checked } : p))} />
                        รอบทองคำ ⚡
                      </label>
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: 0, fontSize: '12px', color: r.prize ? '#fff' : 'rgba(255,255,255,0.2)', fontStyle: r.prize ? 'normal' : 'italic' }}>
                        {r.prize || 'ยังไม่ตั้งรางวัล'}
                      </p>
                      {r.prize_image && (
                        <img src={r.prize_image} alt=""
                          style={{ marginTop: '4px', maxHeight: '40px', borderRadius: '6px', objectFit: 'contain' }}
                          onError={e => { e.target.style.display = 'none'; }} />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
