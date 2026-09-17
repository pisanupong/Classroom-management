import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../services/api';
import { APP_VERSION } from '../version';

const BINGO_COL = ['B', 'I', 'N', 'G', 'O'];
const colOf = (n) => {
  if (n <= 15) return 'B'; if (n <= 30) return 'I';
  if (n <= 45) return 'N'; if (n <= 60) return 'G'; return 'O';
};

function checkWin(numbers, drawn, pattern) {
  if (!numbers || !drawn) return false;
  const marked = numbers.map((n, i) => i === 12 || drawn.includes(n));
  const row = (r) => [0,1,2,3,4].map(c => r*5+c);
  const col = (c) => [0,1,2,3,4].map(r => r*5+c);
  const all = (idxs) => idxs.every(i => marked[i]);
  if (pattern === 'full')    return marked.every(Boolean);
  if (pattern === 'corners') return all([0,4,20,24]);
  if (pattern === 'T')       return all(row(0)) && all(col(2));
  if (pattern === 'L')       return all(col(0)) && all(row(4));
  for (let i = 0; i < 5; i++) if (all(row(i))) return true;
  for (let i = 0; i < 5; i++) if (all(col(i))) return true;
  if (all([0,6,12,18,24])) return true;
  if (all([4,8,12,16,20])) return true;
  return false;
}

const STORAGE_KEY = (roomId) => `bingo_${roomId}_studentId`;

export default function BingoPlayer() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  // ?round=ID allows QR to be round-specific; passed as initial roundId on join
  const urlRoundId = searchParams.get('round') ? parseInt(searchParams.get('round')) : null;
  const socketRef = useRef(null);

  const [phase, setPhase] = useState('join');
  const [studentId, setStudentId] = useState('');
  const [card, setCard] = useState(null);
  const [room, setRoom] = useState(null);
  const [drawn, setDrawn] = useState([]);
  const [lastDrawn, setLastDrawn] = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [winners, setWinners] = useState([]);
  const [canClaim, setCanClaim] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [roundMsg, setRoundMsg] = useState('');
  const [joinErr, setJoinErr] = useState('');
  const [joining, setJoining] = useState(false);
  const activeRoundRef = useRef(null); // always points to latest activeRound (avoids stale closure)

  const applyRoomState = (roomData, roundsData) => {
    setRoom(roomData);
    const active = roundsData.find(r => r.status === 'active');
    const drawnNow = active ? (active.drawn_numbers || []) : (roomData.drawn_numbers || []);
    setDrawn(drawnNow);
    if (drawnNow.length > 0) setLastDrawn(drawnNow[drawnNow.length - 1]);
    if (active) {
      setActiveRound(active);
      activeRoundRef.current = active;
    }
    if (roomData.status === 'ended') {
      localStorage.removeItem(STORAGE_KEY(id));
      setPhase('end');
    }
  };

  // Keep ref in sync whenever activeRound state changes
  useEffect(() => { activeRoundRef.current = activeRound; }, [activeRound]);

  // Auto-refresh every 5s — always uses the latest roundId via ref
  useEffect(() => {
    if (phase !== 'play' || !studentId) return;
    const refresh = async () => {
      try {
        const currentRoundId = activeRoundRef.current?.id || null;
        const r = await api.post(`/bingo/rooms/${id}/join`, {
          alias: studentId.trim(),
          roundId: currentRoundId,
        });
        applyRoomState(r.data.room, r.data.rounds || []);
        // Update card if it changed (e.g., new round card was created server-side)
        if (r.data.card) {
          setCard(prev => (!prev || r.data.card.id !== prev.id) ? r.data.card : prev);
        }
      } catch {}
    };
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [phase, id, studentId]);

  // Auto-rejoin (pass urlRoundId so returning players re-join the right round)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY(id));
    if (saved) { setStudentId(saved); doJoin(saved, urlRoundId); }
  }, [id]);

  const doJoin = useCallback(async (sid, roundId = null) => {
    if (!sid?.trim()) return;
    setJoining(true); setJoinErr('');
    try {
      const r = await api.post(`/bingo/rooms/${id}/join`, { alias: sid.trim(), roundId });
      setCard(r.data.card);
      applyRoomState(r.data.room, r.data.rounds || []);
      localStorage.setItem(STORAGE_KEY(id), sid.trim());
      setPhase('play');

      // If there's already an active round and we joined without a roundId, get the round-specific card
      const activeFromData = r.data.rounds?.find(rnd => rnd.status === 'active');
      if (activeFromData && !roundId) {
        try {
          const r2 = await api.post(`/bingo/rooms/${id}/join`, {
            alias: sid.trim(),
            roundId: activeFromData.id,
          });
          if (r2.data.card) setCard(r2.data.card);
        } catch {}
      }

      const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
        auth: {}, transports: ['websocket'],
      });
      socketRef.current = socket;
      socket.emit('bingo:join_room', { roomId: id, alias: sid.trim() });
      socket.on('bingo:number_drawn', ({ number, drawn: d }) => { setDrawn(d); setLastDrawn(number); });
      socket.on('bingo:round_started', async ({ round }) => {
        setActiveRound(round);
        activeRoundRef.current = round;
        setDrawn([]); setLastDrawn(null);
        setClaimed(false); setCanClaim(false); setWinners([]);
        setRoundMsg(`รอบ ${round.round_number} เริ่มแล้ว!`);
        setTimeout(() => setRoundMsg(''), 3000);
        // Fetch a NEW card for this round (ensures each round has a unique card)
        try {
          const r2 = await api.post(`/bingo/rooms/${id}/join`, {
            alias: sid.trim(),
            roundId: round.id,
          });
          if (r2.data.card) setCard(r2.data.card);
        } catch {}
      });
      socket.on('bingo:round_ended', () => { setActiveRound(null); activeRoundRef.current = null; setCanClaim(false); setRoundMsg('รอบนี้จบแล้ว'); });
      socket.on('bingo:winner', (w) => setWinners(prev => [...prev, w]));
      socket.on('bingo:game_ended', () => { localStorage.removeItem(STORAGE_KEY(id)); setPhase('end'); });
    } catch (e) {
      setJoinErr(e.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally { setJoining(false); }
  }, [id]);

  useEffect(() => {
    if (!card || !activeRound || claimed) return;
    setCanClaim(checkWin(card.numbers, drawn, activeRound.pattern));
  }, [drawn, card, activeRound, claimed]);

  const claimBingo = () => {
    if (!canClaim || claimed || !activeRound) return;
    setClaimed(true); setCanClaim(false);
    socketRef.current?.emit('bingo:claim', {
      roomId: id, roundId: activeRound.id, cardId: card.id, alias: studentId.trim(),
    });
  };

  const BG = 'linear-gradient(135deg,#1e1b4b,#0f172a)';
  const FF = "'Segoe UI',sans-serif";

  /* ── JOIN ── */
  if (phase === 'join') return (
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:'24px 20px', fontFamily:FF }}>
      <div style={{ width:'100%', maxWidth:'320px' }}>
        <div style={{ textAlign:'center', marginBottom:'24px' }}>
          <div style={{ fontSize:'52px', lineHeight:1, marginBottom:'8px' }}>🎱</div>
          <h1 style={{ fontSize:'32px', fontWeight:900, color:'#fff', margin:0, letterSpacing:'-1px' }}>BINGO</h1>
          {room?.name && <p style={{ color:'#c4b5fd', marginTop:'4px', fontSize:'13px' }}>{room.name}</p>}
        </div>
        <label style={{ display:'block', color:'rgba(255,255,255,0.45)', fontSize:'11px',
          textAlign:'center', marginBottom:'8px', letterSpacing:'1px', textTransform:'uppercase' }}>
          รหัสนักเรียน
        </label>
        <input
          value={studentId} onChange={e => setStudentId(e.target.value)} autoFocus
          placeholder="เช่น 12345"
          onKeyDown={e => e.key === 'Enter' && doJoin(studentId, urlRoundId)}
          style={{ width:'100%', padding:'14px 16px', borderRadius:'16px', textAlign:'center',
            fontSize:'24px', fontWeight:800, color:'#fff', letterSpacing:'2px',
            background:'rgba(255,255,255,0.08)', border:'2px solid rgba(255,255,255,0.15)',
            outline:'none', boxSizing:'border-box', marginBottom:'12px' }}
        />
        {joinErr && <p style={{ color:'#f87171', textAlign:'center', fontSize:'13px', marginBottom:'8px' }}>{joinErr}</p>}
        <button onClick={() => doJoin(studentId, urlRoundId)} disabled={joining || !studentId.trim()}
          style={{ width:'100%', padding:'14px', borderRadius:'16px', fontWeight:900,
            fontSize:'16px', color:'#fff', border:'none', cursor:'pointer',
            background: joining || !studentId.trim() ? 'rgba(255,255,255,0.15)' : 'linear-gradient(135deg,#7c3aed,#db2777)',
            opacity: joining || !studentId.trim() ? 0.5 : 1, transition:'all 0.2s' }}>
          {joining ? 'กำลังเข้า...' : 'รับใบ Bingo'}
        </button>
        <p style={{ textAlign:'center', color:'rgba(255,255,255,0.18)', fontSize:'10px', marginTop:'14px' }}>
          ระบบจะจำใบของคุณ • v{APP_VERSION}
        </p>
      </div>
    </div>
  );

  /* ── END ── */
  if (phase === 'end') return (
    <div style={{ minHeight:'100dvh', background:BG, display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', color:'#fff', padding:'20px', fontFamily:FF }}>
      <div style={{ fontSize:'60px', marginBottom:'12px' }}>🎉</div>
      <h2 style={{ fontSize:'26px', fontWeight:900, margin:'0 0 6px' }}>เกมจบแล้ว!</h2>
      <p style={{ color:'rgba(255,255,255,0.4)', marginBottom:'20px', fontSize:'14px' }}>ขอบคุณที่เข้าร่วม</p>
      {winners.some(w => w.alias === studentId.trim()) && (
        <div style={{ padding:'10px 20px', borderRadius:'14px', fontWeight:700, fontSize:'15px',
          background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.4)', color:'#fbbf24' }}>
          🏆 คุณได้รับรางวัล!
        </div>
      )}
    </div>
  );

  /* ── PLAY ── */
  return (
    <div style={{ minHeight:'100dvh', background:BG, color:'#fff',
      fontFamily:FF, paddingBottom: canClaim ? '88px' : '12px' }}>

      {/* ── Header ── */}
      <div style={{ padding:'8px 12px 6px', background:'rgba(15,23,42,0.75)',
        backdropFilter:'blur(8px)', borderBottom:'1px solid rgba(255,255,255,0.08)',
        position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* Student ID — ใหญ่ขึ้น */}
          <div>
            <p style={{ margin:0, color:'rgba(255,255,255,0.35)', fontSize:'10px', lineHeight:1.2 }}>รหัสนักเรียน</p>
            <p style={{ margin:0, fontWeight:900, fontSize:'20px', letterSpacing:'1px', lineHeight:1.2 }}>
              {studentId}
            </p>
          </div>
          {/* Right side: room name + version */}
          <div style={{ textAlign:'right' }}>
            <p style={{ margin:0, fontSize:'12px', fontWeight:600, color:'rgba(255,255,255,0.7)' }}>
              {room?.name || 'Bingo'}
            </p>
            <p style={{ margin:0, fontSize:'9px', color:'rgba(255,255,255,0.18)' }}>v{APP_VERSION}</p>
          </div>
        </div>

        {/* Round + Prize + Golden row */}
        {activeRound && (
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'5px', flexWrap:'wrap' }}>
            <span style={{ padding:'2px 10px', borderRadius:'999px', fontSize:'12px', fontWeight:700,
              background:'rgba(124,58,237,0.35)', border:'1px solid rgba(124,58,237,0.5)' }}>
              รอบ {activeRound.round_number}
            </span>
            {activeRound.prize && (
              <span style={{ padding:'2px 10px', borderRadius:'999px', fontSize:'12px', fontWeight:700,
                background:'rgba(245,158,11,0.2)', border:'1px solid rgba(245,158,11,0.45)', color:'#fde68a' }}>
                🎁 {activeRound.prize}
              </span>
            )}
            {activeRound.is_golden && (
              <span style={{ padding:'2px 10px', borderRadius:'999px', fontSize:'12px', fontWeight:700,
                background:'linear-gradient(90deg,#f59e0b,#ef4444)' }}>
                ⚡ ทองคำ
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Round message ── */}
      {roundMsg && (
        <div style={{ margin:'6px 10px 0', padding:'6px 12px', borderRadius:'10px',
          textAlign:'center', fontSize:'12px', fontWeight:700,
          background:'rgba(124,58,237,0.25)', border:'1px solid rgba(124,58,237,0.45)' }}>
          {roundMsg}
        </div>
      )}

      {/* ── Last drawn ── */}
      <div style={{ margin:'6px 10px 0', padding:'8px 12px', borderRadius:'14px', textAlign:'center',
        background: lastDrawn ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${lastDrawn ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
        display:'flex', alignItems:'center', justifyContent:'center', gap:'12px' }}>
        {lastDrawn ? (
          <>
            <div>
              <p style={{ margin:0, color:'rgba(255,255,255,0.3)', fontSize:'9px' }}>ตัวเลขล่าสุด</p>
              <div style={{ fontSize:'34px', fontWeight:900, lineHeight:1, color:'#a78bfa',
                textShadow:'0 0 16px rgba(167,139,250,0.5)' }}>
                {colOf(lastDrawn)}-{lastDrawn}
              </div>
            </div>
            <div style={{ textAlign:'left' }}>
              <p style={{ margin:0, color:'rgba(255,255,255,0.3)', fontSize:'10px' }}>สุ่มไปแล้ว</p>
              <p style={{ margin:0, fontSize:'20px', fontWeight:800, color:'#c4b5fd' }}>{drawn.length}<span style={{ fontSize:'11px', fontWeight:400, color:'rgba(255,255,255,0.35)' }}>/75</span></p>
            </div>
          </>
        ) : (
          <p style={{ color:'rgba(255,255,255,0.2)', fontSize:'13px', margin:0, padding:'4px 0' }}>
            {activeRound ? 'รอการสุ่ม...' : 'รอเริ่มรอบ'}
          </p>
        )}
      </div>

      {/* ── Bingo Card ── */}
      {card && (
        <div style={{ padding:'6px 10px 0' }}>
          {/* Headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'3px', marginBottom:'2px' }}>
            {BINGO_COL.map(c => (
              <div key={c} style={{ textAlign:'center', fontWeight:900, fontSize:'16px', color:'#c4b5fd' }}>{c}</div>
            ))}
          </div>
          {/* 5×5 grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'3px' }}>
            {card.numbers.map((n, i) => {
              const isCenter = i === 12;
              const isMarked = isCenter || drawn.includes(n);
              const isNew    = n === lastDrawn;
              return (
                <div key={i} style={{
                  aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
                  borderRadius:'8px', fontWeight:800, fontSize:'15px', transition:'all 0.25s',
                  background: isNew
                    ? 'linear-gradient(135deg,#7c3aed,#db2777)'
                    : isMarked ? 'rgba(124,58,237,0.45)' : 'rgba(255,255,255,0.07)',
                  border: isNew ? '2px solid #a78bfa'
                    : isMarked ? '2px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  color: isMarked ? '#fff' : 'rgba(255,255,255,0.4)',
                  boxShadow: isNew ? '0 0 16px rgba(124,58,237,0.65)' : undefined,
                  transform: isNew ? 'scale(1.05)' : undefined,
                }}>
                  {isCenter ? '⭐' : n}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ตัวเลขที่ออกไปแล้ว ── */}
      {drawn.length > 0 && (
        <div style={{ margin:'6px 10px 0', padding:'8px 10px', borderRadius:'12px',
          background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'10px', margin:'0 0 5px' }}>
            ออกไปแล้ว ({drawn.length} ตัว)
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'3px' }}>
            {drawn.map((n, i) => (
              <span key={i} style={{
                padding:'1px 6px', borderRadius:'999px', fontSize:'10px', fontWeight:700,
                background: n === lastDrawn ? 'rgba(124,58,237,0.8)' : 'rgba(255,255,255,0.1)',
                border: n === lastDrawn ? '1px solid rgba(167,139,250,0.6)' : '1px solid transparent',
                color:'#fff',
              }}>
                {colOf(n)}-{n}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── ผู้ชนะ ── */}
      {winners.length > 0 && (
        <div style={{ margin:'6px 10px 0', padding:'8px 10px', borderRadius:'12px',
          background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'10px', margin:'0 0 5px' }}>🏆 ผู้ชนะ</p>
          {winners.map((w, i) => (
            <div key={i} style={{ display:'flex', gap:'8px', alignItems:'center',
              padding:'4px 0', fontSize:'12px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color:'#fbbf24', fontWeight:700 }}>#{i+1}</span>
              <span style={{ color: w.alias === studentId.trim() ? '#fde68a' : 'rgba(255,255,255,0.7)',
                fontWeight: w.alias === studentId.trim() ? 900 : 400 }}>
                {w.alias}{w.alias === studentId.trim() ? ' ← คุณ! 🎉' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── BINGO! button ── */}
      {canClaim && !claimed && (
        <div style={{ position:'fixed', bottom:'14px', left:0, right:0,
          display:'flex', justifyContent:'center', padding:'0 20px', zIndex:50 }}>
          <button onClick={claimBingo} style={{
            width:'100%', maxWidth:'300px', padding:'16px',
            borderRadius:'18px', fontSize:'20px', fontWeight:900, color:'#fff',
            border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#f59e0b,#ef4444)',
            boxShadow:'0 0 32px rgba(239,68,68,0.65)',
            animation:'bounce 0.8s infinite',
          }}>
            🎉 BINGO!
          </button>
        </div>
      )}

      {claimed && !winners.some(w => w.alias === studentId.trim()) && (
        <div style={{ margin:'6px 10px 0', padding:'10px', borderRadius:'12px', textAlign:'center',
          background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.35)' }}>
          <p style={{ color:'#fbbf24', fontWeight:700, fontSize:'12px', margin:0 }}>
            ส่ง BINGO แล้ว — รอครูยืนยัน...
          </p>
        </div>
      )}
    </div>
  );
}
