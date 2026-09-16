import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const PATTERN_LABEL = {
  line: '📏 เส้นตรง (แถว/คอลัมน์/ทแยง)',
  full: '🟩 เต็มบอร์ด',
  corners: '🔲 4 มุม',
  T: '🔠 รูปตัว T',
  L: '🔡 รูปตัว L',
};

const BINGO_COL = ['B','I','N','G','O'];

export default function BingoHost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const socketRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [drawn, setDrawn] = useState([]);
  const [lastDrawn, setLastDrawn] = useState(null);
  const [winners, setWinners] = useState([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [activeRoundIdx, setActiveRoundIdx] = useState(0);
  const [roundStatus, setRoundStatus] = useState('pending'); // pending|active|finished
  const [editPrizes, setEditPrizes] = useState(false);
  const [prizeDraft, setPrizeDraft] = useState([]);
  const [autoMode, setAutoMode] = useState(false);
  const autoRef = useRef(null);

  const playerUrl = `${window.location.origin}/bingo/play/${id}`;

  // Load room
  useEffect(() => {
    api.get(`/bingo/rooms/${id}`).then(r => {
      setRoom(r.data);
      setRounds(r.data.rounds || []);
      setDrawn(r.data.drawn_numbers || []);
      setPrizeDraft((r.data.rounds || []).map(rnd => ({
        id: rnd.id,
        pattern: rnd.pattern,
        prize: rnd.prize || '',
        is_golden: rnd.is_golden,
      })));
      // Determine active round
      const activeIdx = (r.data.rounds || []).findIndex(rnd => rnd.status === 'active');
      if (activeIdx >= 0) {
        setActiveRoundIdx(activeIdx);
        setRoundStatus('active');
        setDrawn(r.data.rounds[activeIdx].drawn_numbers || []);
      }
    }).catch(() => navigate('/bingo'));
  }, [id]);

  // Socket
  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', { auth: { token } });
    socketRef.current = socket;
    socket.emit('bingo:join_room', { roomId: id, alias: `HOST:${user?.name}` });

    socket.on('bingo:player_count', ({ count }) => setPlayerCount(count));
    socket.on('bingo:number_drawn', ({ number, drawn: d }) => {
      setDrawn(d);
      setLastDrawn(number);
    });
    socket.on('bingo:round_started', ({ round }) => {
      setRoundStatus('active');
      setDrawn([]);
      setLastDrawn(null);
    });
    socket.on('bingo:round_ended', () => setRoundStatus('finished'));
    socket.on('bingo:winner', (w) => {
      setWinners(prev => [...prev, w]);
    });
    socket.on('bingo:game_ended', () => navigate('/bingo'));

    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
      socket.disconnect();
    };
  }, [id]);

  const colOf = (n) => {
    if (n <= 15) return 'B';
    if (n <= 30) return 'I';
    if (n <= 45) return 'N';
    if (n <= 60) return 'G';
    return 'O';
  };

  const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
  const remaining = allNumbers.filter(n => !drawn.includes(n));

  const drawNumber = useCallback(() => {
    if (remaining.length === 0 || roundStatus !== 'active') return;
    const idx = Math.floor(Math.random() * remaining.length);
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
      // All rounds done
      socketRef.current?.emit('bingo:end_game', { roomId: id });
    }
  };

  const savePrizes = async () => {
    await api.put(`/bingo/rooms/${id}/rounds`, { rounds: prizeDraft });
    setRounds(prev => prev.map(r => {
      const d = prizeDraft.find(p => p.id === r.id);
      return d ? { ...r, ...d } : r;
    }));
    setEditPrizes(false);
  };

  if (!room) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a', color: '#fff' }}>
      <div className="text-xl animate-pulse">⏳ กำลังโหลด...</div>
    </div>
  );

  const activeRound = rounds[activeRoundIdx];

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg,#0f172a,#1e1b4b)', fontFamily: "'Segoe UI',sans-serif" }}>
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between" style={{ background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bingo')} className="text-white/40 hover:text-white text-sm transition-colors">← กลับ</button>
          <span className="text-white/20">|</span>
          <span className="font-bold text-lg">🎱 {room.name}</span>
          {activeRound?.is_golden && <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'linear-gradient(90deg,#f59e0b,#ef4444)', animation: 'pulse 1.5s infinite' }}>⚡ รอบทองคำ!</span>}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-400">👥 {playerCount} คน</span>
          <span className="text-white/40">รอบ {activeRoundIdx + 1}/{rounds.length}</span>
          <button onClick={() => { if(window.confirm('จบเกมเลยไหม?')) socketRef.current?.emit('bingo:end_game', { roomId: id }); }}
            className="px-3 py-1 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/20 transition-colors text-xs">จบเกม</button>
        </div>
      </div>

      <div className="flex gap-4 p-4 max-w-screen-xl mx-auto">
        {/* Left: QR + Controls */}
        <div className="w-72 flex-shrink-0 space-y-4">
          {/* QR */}
          <div className="rounded-2xl p-4 border border-white/10 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-xs text-white/40 mb-3">สแกนเพื่อเล่น</p>
            <div className="inline-block p-3 rounded-xl bg-white">
              <QRCodeSVG value={playerUrl} size={160} />
            </div>
            <p className="text-xs text-white/30 mt-2 break-all">{playerUrl}</p>
          </div>

          {/* Round Controls */}
          <div className="rounded-2xl p-4 border border-white/10 space-y-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="font-semibold text-sm text-white/60">รอบที่ {activeRoundIdx + 1}</p>
            {activeRound && (
              <>
                <div className="text-sm">
                  <span className="text-white/40">รูปแบบ: </span>
                  <span className="text-purple-300">{PATTERN_LABEL[activeRound.pattern] || activeRound.pattern}</span>
                </div>
                {activeRound.prize && (
                  <div className="px-3 py-2 rounded-xl text-center" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <p className="text-xs text-yellow-400/60">ของรางวัล</p>
                    <p className="font-bold text-yellow-300">{activeRound.prize}</p>
                  </div>
                )}
              </>
            )}

            {roundStatus === 'pending' && (
              <button onClick={startRound} className="w-full py-2.5 rounded-xl font-bold transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>▶ เริ่มรอบนี้</button>
            )}
            {roundStatus === 'active' && (
              <>
                <button onClick={drawNumber} disabled={remaining.length === 0}
                  className="w-full py-2.5 rounded-xl font-bold transition-all hover:scale-[1.02] disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>🎲 สุ่มตัวเลข</button>
                {!autoMode
                  ? <button onClick={startAutoMode} className="w-full py-2 rounded-xl text-sm border border-white/20 hover:bg-white/10 transition-colors">⏩ Auto (5 วิ)</button>
                  : <button onClick={stopAutoMode} className="w-full py-2 rounded-xl text-sm border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors">⏹ หยุด Auto</button>
                }
                <button onClick={endRound} className="w-full py-2 rounded-xl text-sm border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-colors">🏁 จบรอบ</button>
              </>
            )}
            {roundStatus === 'finished' && (
              <button onClick={nextRound} className="w-full py-2.5 rounded-xl font-bold transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#7c3aed)' }}>
                {activeRoundIdx + 1 < rounds.length ? '➡ รอบถัดไป' : '🏆 จบเกม'}
              </button>
            )}
          </div>

          {/* Winners */}
          <div className="rounded-2xl p-4 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="font-semibold text-sm text-white/60 mb-3">🏆 ผู้ชนะ</p>
            {winners.length === 0
              ? <p className="text-xs text-white/30 text-center py-2">ยังไม่มีผู้ชนะ</p>
              : winners.map((w, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                    <span className="text-yellow-400 font-bold text-sm">#{i + 1}</span>
                    <span className="text-white font-medium text-sm">{w.alias}</span>
                    <span className="ml-auto text-xs text-white/30">รอบ {w.roundId}</span>
                  </div>
                ))
            }
          </div>

          {/* Prize Editor */}
          <div className="rounded-2xl p-4 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm text-white/60">🎁 ตั้งรางวัลแต่ละรอบ</p>
              {editPrizes
                ? <button onClick={savePrizes} className="text-xs px-2 py-1 rounded-lg bg-green-500/20 text-green-400">บันทึก</button>
                : <button onClick={() => setEditPrizes(true)} className="text-xs px-2 py-1 rounded-lg bg-white/10 text-white/60">แก้ไข</button>
              }
            </div>
            {prizeDraft.map((r, i) => (
              <div key={r.id} className="mb-3">
                <p className="text-xs text-white/40 mb-1">รอบ {i + 1} {r.is_golden ? '⚡' : ''}</p>
                {editPrizes ? (
                  <div className="space-y-1">
                    <input value={r.prize} onChange={e => setPrizeDraft(prev => prev.map((p, j) => j === i ? { ...p, prize: e.target.value } : p))}
                      placeholder="ของรางวัล เช่น ดินสอ 1 กล่อง"
                      className="w-full px-2 py-1.5 rounded-lg bg-white/10 border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none" />
                    <select value={r.pattern} onChange={e => setPrizeDraft(prev => prev.map((p, j) => j === i ? { ...p, pattern: e.target.value } : p))}
                      className="w-full px-2 py-1.5 rounded-lg bg-white/10 border border-white/10 text-sm text-white focus:outline-none">
                      {Object.entries(PATTERN_LABEL).map(([v, l]) => <option key={v} value={v} style={{ background: '#1e1b4b' }}>{l}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                      <input type="checkbox" checked={r.is_golden} onChange={e => setPrizeDraft(prev => prev.map((p, j) => j === i ? { ...p, is_golden: e.target.checked } : p))} />
                      รอบนาทีทอง ⚡
                    </label>
                  </div>
                ) : (
                  <p className="text-sm text-white/80">{r.prize || <span className="text-white/20 italic">ยังไม่ตั้งรางวัล</span>}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Center: Number board + last drawn */}
        <div className="flex-1 space-y-4">
          {/* Last drawn */}
          <div className="rounded-2xl p-6 border text-center" style={{
            background: lastDrawn ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
            borderColor: lastDrawn ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)',
          }}>
            {lastDrawn ? (
              <>
                <p className="text-white/40 text-sm mb-1">ตัวเลขล่าสุด</p>
                <div className="text-8xl font-black" style={{ color: '#a78bfa', textShadow: '0 0 40px rgba(167,139,250,0.5)', lineHeight: 1 }}>
                  {colOf(lastDrawn)}-{lastDrawn}
                </div>
                <p className="text-white/30 text-sm mt-2">สุ่มไปแล้ว {drawn.length} / 75</p>
              </>
            ) : (
              <p className="text-4xl text-white/20 py-4">{roundStatus === 'active' ? '🎲 กดสุ่มตัวเลข' : '⏳ รอเริ่มรอบ'}</p>
            )}
          </div>

          {/* Master grid 5 columns B-I-N-G-O */}
          <div className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="grid grid-cols-5 gap-1 mb-1">
              {BINGO_COL.map(c => (
                <div key={c} className="text-center font-black text-lg text-purple-300">{c}</div>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 75 }, (_, i) => {
                const n = i + 1;
                const isDone = drawn.includes(n);
                const isLast = n === lastDrawn;
                return (
                  <div key={n} onClick={() => { if (roundStatus === 'active') socketRef.current?.emit('bingo:draw_number', { roomId: id, number: n }); }}
                    className="aspect-square flex items-center justify-center rounded-lg text-sm font-bold cursor-pointer transition-all hover:scale-105"
                    style={{
                      background: isLast ? '#7c3aed' : isDone ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.05)',
                      color: isDone ? '#fff' : 'rgba(255,255,255,0.35)',
                      border: isLast ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.07)',
                      transform: isLast ? 'scale(1.1)' : undefined,
                    }}>
                    {n}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Drawn history */}
          {drawn.length > 0 && (
            <div className="rounded-2xl p-4 border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-xs text-white/40 mb-2">ลำดับที่สุ่ม ({drawn.length} ตัว)</p>
              <div className="flex flex-wrap gap-1.5">
                {drawn.map((n, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: n === lastDrawn ? 'rgba(124,58,237,0.8)' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
                    {colOf(n)}-{n}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Rounds list */}
        <div className="w-56 flex-shrink-0 space-y-2">
          <p className="text-xs text-white/40 font-semibold uppercase tracking-wider px-1">รอบทั้งหมด</p>
          {rounds.map((rnd, i) => (
            <div key={rnd.id} onClick={() => { if (roundStatus !== 'active') { setActiveRoundIdx(i); setRoundStatus(rnd.status === 'active' ? 'active' : rnd.status === 'finished' ? 'finished' : 'pending'); } }}
              className="rounded-xl p-3 border transition-all cursor-pointer"
              style={{
                background: i === activeRoundIdx ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                borderColor: i === activeRoundIdx ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)',
              }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm">รอบ {i + 1} {rnd.is_golden ? '⚡' : ''}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: rnd.status === 'active' ? 'rgba(16,185,129,0.2)' : rnd.status === 'finished' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)', color: rnd.status === 'active' ? '#34d399' : rnd.status === 'finished' ? '#9ca3af' : '#6b7280' }}>
                  {rnd.status === 'active' ? '🟢 กำลังเล่น' : rnd.status === 'finished' ? '✅ จบ' : '⏳ รอ'}
                </span>
              </div>
              <p className="text-xs text-white/40">{PATTERN_LABEL[rnd.pattern] || rnd.pattern}</p>
              {rnd.prize && <p className="text-xs text-yellow-400/70 mt-1">🎁 {rnd.prize}</p>}
              {rnd.winners?.length > 0 && <p className="text-xs text-green-400/70 mt-1">🏆 {rnd.winners.length} คนชนะ</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
