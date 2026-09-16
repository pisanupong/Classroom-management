import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../services/api';

const BINGO_COL = ['B', 'I', 'N', 'G', 'O'];

const colOf = (n) => {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
};

/* ── Check winning patterns ────────────────────────────────────────────── */
function checkWin(numbers, drawn, pattern) {
  if (!numbers || !drawn) return false;
  const marked = numbers.map((n, i) => i === 12 || drawn.includes(n));
  const row = (r) => [0,1,2,3,4].map(c => r*5+c);
  const col = (c) => [0,1,2,3,4].map(r => r*5+c);
  const allMarked = (idxs) => idxs.every(i => marked[i]);
  if (pattern === 'full')    return marked.every(Boolean);
  if (pattern === 'corners') return allMarked([0,4,20,24]);
  if (pattern === 'T')       return allMarked(row(0)) && allMarked(col(2));
  if (pattern === 'L')       return allMarked(col(0)) && allMarked(row(4));
  // line (default)
  for (let i = 0; i < 5; i++) if (allMarked(row(i))) return true;
  for (let i = 0; i < 5; i++) if (allMarked(col(i))) return true;
  if (allMarked([0,6,12,18,24])) return true;
  if (allMarked([4,8,12,16,20])) return true;
  return false;
}

const STORAGE_KEY = (roomId) => `bingo_${roomId}_studentId`;

export default function BingoPlayer() {
  const { id } = useParams();
  const socketRef = useRef(null);

  const [phase, setPhase] = useState('join'); // join | play | end
  const [studentId, setStudentId] = useState('');
  const [card, setCard] = useState(null);
  const [room, setRoom] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [drawn, setDrawn] = useState([]);
  const [lastDrawn, setLastDrawn] = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [winners, setWinners] = useState([]);
  const [canClaim, setCanClaim] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [roundMsg, setRoundMsg] = useState('');
  const [joinErr, setJoinErr] = useState('');
  const [joining, setJoining] = useState(false);

  // Auto-rejoin if remembered
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY(id));
    if (saved) {
      setStudentId(saved);
      doJoin(saved);
    }
  }, [id]);

  const doJoin = async (sid) => {
    if (!sid?.trim()) return;
    setJoining(true);
    setJoinErr('');
    try {
      const r = await api.post(`/bingo/rooms/${id}/join`, { alias: sid.trim() });
      const roomData  = r.data.room;
      const roundsData = r.data.rounds || [];

      setCard(r.data.card);
      setRoom(roomData);
      setRounds(roundsData);

      // Find active round — use its drawn_numbers, else room's drawn_numbers
      const active = roundsData.find(rnd => rnd.status === 'active');
      const drawnNow = active ? (active.drawn_numbers || []) : (roomData.drawn_numbers || []);
      setDrawn(drawnNow);
      if (drawnNow.length > 0) setLastDrawn(drawnNow[drawnNow.length - 1]);
      if (active) setActiveRound(active);

      // Remember student id
      localStorage.setItem(STORAGE_KEY(id), sid.trim());
      setPhase('play');

      // Connect socket (unauthenticated — player may have no account)
      const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
        auth: {},
        transports: ['websocket'],
      });
      socketRef.current = socket;
      socket.emit('bingo:join_room', { roomId: id, alias: sid.trim() });

      socket.on('bingo:number_drawn', ({ number, drawn: d }) => {
        setDrawn(d);
        setLastDrawn(number);
      });
      socket.on('bingo:round_started', ({ round }) => {
        setActiveRound(round);
        setDrawn([]);
        setLastDrawn(null);
        setClaimed(false);
        setCanClaim(false);
        setWinners([]);
        setRoundMsg(`🎮 รอบ ${round.round_number} เริ่มแล้ว!`);
        setTimeout(() => setRoundMsg(''), 3000);
      });
      socket.on('bingo:round_ended', () => {
        setActiveRound(null);
        setCanClaim(false);
        setRoundMsg('🏁 รอบนี้จบแล้ว รอรอบถัดไป...');
      });
      socket.on('bingo:winner', (w) => {
        setWinners(prev => [...prev, w]);
      });
      socket.on('bingo:game_ended', () => {
        localStorage.removeItem(STORAGE_KEY(id));
        setPhase('end');
      });
    } catch (e) {
      setJoinErr(e.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setJoining(false);
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    doJoin(studentId);
  };

  // Auto-detect bingo
  useEffect(() => {
    if (!card || !activeRound || claimed) return;
    const isWin = checkWin(card.numbers, drawn, activeRound.pattern);
    setCanClaim(isWin);
  }, [drawn, card, activeRound, claimed]);

  const claimBingo = () => {
    if (!canClaim || claimed || !activeRound) return;
    setClaimed(true);
    setCanClaim(false);
    socketRef.current?.emit('bingo:claim', {
      roomId: id,
      roundId: activeRound.id,
      cardId: card.id,
      alias: studentId.trim(),
    });
  };

  /* ─── หน้า Join ──────────────────────────────────────────────────────── */
  if (phase === 'join') return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg,#1e1b4b,#0f172a)', fontFamily: "'Segoe UI',sans-serif" }}>
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="text-7xl mb-3">🎱</div>
          <h1 className="text-4xl font-black text-white tracking-tight">BINGO</h1>
          {room?.name && <p className="text-purple-300 mt-1 text-sm">{room.name}</p>}
        </div>
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-white/40 text-xs mb-1.5 text-center">รหัสนักเรียน</label>
            <input
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              placeholder="เช่น 12345 หรือ ชื่อ-นามสกุล"
              autoFocus
              className="w-full px-4 py-4 rounded-2xl text-center text-xl font-bold text-white bg-white/10 border border-white/20 focus:outline-none focus:border-purple-400 placeholder-white/20"
            />
          </div>
          {joinErr && <p className="text-red-400 text-sm text-center">{joinErr}</p>}
          <button type="submit" disabled={joining || !studentId.trim()}
            className="w-full py-4 rounded-2xl font-black text-lg text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
            {joining ? '⏳ กำลังเข้า...' : '🎲 รับใบ Bingo'}
          </button>
        </form>
        <p className="text-center text-white/20 text-xs mt-4">ระบบจะจำใบของคุณอัตโนมัติ</p>
      </div>
    </div>
  );

  /* ─── หน้า End ───────────────────────────────────────────────────────── */
  if (phase === 'end') return (
    <div className="min-h-screen flex flex-col items-center justify-center text-white px-4"
      style={{ background: 'linear-gradient(135deg,#1e1b4b,#0f172a)' }}>
      <div className="text-7xl mb-5">🎉</div>
      <h2 className="text-3xl font-black mb-2">เกมจบแล้ว!</h2>
      <p className="text-white/40 mb-6">ขอบคุณที่เข้าร่วม</p>
      {winners.some(w => w.alias === studentId.trim()) &&
        <div className="px-6 py-3 rounded-2xl font-bold text-lg" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24' }}>
          🏆 คุณได้รับรางวัลในเกมนี้!
        </div>
      }
    </div>
  );

  /* ─── หน้าเล่น ───────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen text-white pb-28"
      style={{ background: 'linear-gradient(135deg,#1e1b4b,#0f172a)', fontFamily: "'Segoe UI',sans-serif" }}>

      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-white/10"
        style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }}>
        <div>
          <p className="font-black text-base">{room?.name || 'Bingo'}</p>
          <p className="text-white/40 text-xs">รหัส: {studentId}</p>
        </div>
        {activeRound?.is_golden && (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: 'linear-gradient(90deg,#f59e0b,#ef4444)', animation: 'pulse 1s infinite' }}>
            ⚡ รอบทองคำ!
          </span>
        )}
      </div>

      {/* Round banner */}
      {roundMsg && (
        <div className="mx-4 mt-3 px-4 py-2 rounded-xl text-center text-sm font-bold"
          style={{ background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.5)' }}>
          {roundMsg}
        </div>
      )}

      {/* Active round info */}
      {activeRound && (
        <div className="mx-4 mt-3 px-4 py-2 rounded-xl flex items-center justify-between text-sm"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="text-white/50">รอบ {activeRound.round_number}</span>
          {activeRound.prize && <span className="text-yellow-300 font-bold">🎁 {activeRound.prize}</span>}
        </div>
      )}

      {/* Last drawn number — big display */}
      <div className="mx-4 mt-3 rounded-2xl py-5 text-center border"
        style={{
          background: lastDrawn ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)',
          borderColor: lastDrawn ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)',
        }}>
        {lastDrawn ? (
          <>
            <p className="text-white/30 text-xs mb-1">ตัวเลขล่าสุด</p>
            <div className="text-7xl font-black leading-none" style={{ color: '#a78bfa', textShadow: '0 0 30px rgba(167,139,250,0.5)' }}>
              {colOf(lastDrawn)}-{lastDrawn}
            </div>
            <p className="text-white/25 text-xs mt-2">สุ่มไปแล้ว {drawn.length} / 75 ตัว</p>
          </>
        ) : (
          <p className="text-white/20 text-xl py-3">
            {activeRound ? '⏳ รอการสุ่ม...' : '🕐 รอเริ่มรอบ'}
          </p>
        )}
      </div>

      {/* ── ตารางเลขที่สุ่มไปแล้ว (แสดงทันทีเมื่อเข้าห้อง) ── */}
      {drawn.length > 0 && (
        <div className="mx-4 mt-3 rounded-2xl p-4 border border-white/10"
          style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="text-xs text-white/30 mb-2">ตัวเลขที่ออกไปแล้ว ({drawn.length} ตัว)</p>
          <div className="flex flex-wrap gap-1.5">
            {drawn.map((n, i) => (
              <span key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                style={{
                  background: n === lastDrawn ? 'rgba(124,58,237,0.8)' : 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: n === lastDrawn ? '1px solid rgba(167,139,250,0.6)' : '1px solid transparent',
                }}>
                {colOf(n)}-{n}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── ใบ Bingo ── */}
      {card && (
        <div className="mx-4 mt-4">
          {/* Column headers */}
          <div className="grid grid-cols-5 gap-2 mb-1.5">
            {BINGO_COL.map(c => (
              <div key={c} className="text-center font-black text-2xl py-1" style={{ color: '#c4b5fd' }}>{c}</div>
            ))}
          </div>
          {/* 5×5 grid */}
          <div className="grid grid-cols-5 gap-2">
            {card.numbers.map((n, i) => {
              const isCenter = i === 12;
              const isMarked = isCenter || drawn.includes(n);
              const isNew    = n === lastDrawn;
              return (
                <div key={i}
                  className="flex items-center justify-center rounded-2xl font-black text-xl transition-all duration-300"
                  style={{
                    aspectRatio: '1',
                    background: isNew
                      ? 'linear-gradient(135deg,#7c3aed,#db2777)'
                      : isMarked
                        ? 'rgba(124,58,237,0.45)'
                        : 'rgba(255,255,255,0.07)',
                    border: isNew
                      ? '2px solid #a78bfa'
                      : isMarked
                        ? '2px solid rgba(124,58,237,0.5)'
                        : '1px solid rgba(255,255,255,0.1)',
                    color: isMarked ? '#fff' : 'rgba(255,255,255,0.45)',
                    boxShadow: isNew ? '0 0 24px rgba(124,58,237,0.7)' : undefined,
                    transform: isNew ? 'scale(1.07)' : undefined,
                  }}>
                  {isCenter ? '⭐' : n}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ผู้ชนะ ── */}
      {winners.length > 0 && (
        <div className="mx-4 mt-5 rounded-2xl p-4 border border-white/10"
          style={{ background: 'rgba(255,255,255,0.03)' }}>
          <p className="text-xs text-white/30 mb-3">🏆 ผู้ชนะรอบนี้</p>
          {winners.map((w, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 text-sm border-b border-white/5 last:border-0">
              <span className="text-yellow-400 font-bold">#{i+1}</span>
              <span className={w.alias === studentId.trim() ? 'text-yellow-300 font-black' : 'text-white/70'}>
                {w.alias} {w.alias === studentId.trim() ? '← คุณ! 🎉' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── ปุ่ม BINGO! (fixed bottom) ── */}
      {canClaim && !claimed && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-6 z-50">
          <button onClick={claimBingo}
            className="w-full max-w-xs py-5 rounded-2xl text-2xl font-black text-white shadow-2xl"
            style={{
              background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
              boxShadow: '0 0 40px rgba(239,68,68,0.7)',
              animation: 'bounce 0.8s infinite',
            }}>
            🎉 BINGO!
          </button>
        </div>
      )}

      {claimed && !winners.some(w => w.alias === studentId.trim()) && (
        <div className="mx-4 mt-5 py-4 rounded-2xl text-center"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
          <p className="text-yellow-400 font-bold">✅ ส่ง BINGO แล้ว — รอครูยืนยัน...</p>
        </div>
      )}
    </div>
  );
}
