import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../services/api';
import { APP_VERSION } from '../version';

const BINGO_COL = ['B', 'I', 'N', 'G', 'O'];

const colOf = (n) => {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
};

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

  // Auto-rejoin
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY(id));
    if (saved) { setStudentId(saved); doJoin(saved); }
  }, [id]);

  const doJoin = async (sid) => {
    if (!sid?.trim()) return;
    setJoining(true); setJoinErr('');
    try {
      const r = await api.post(`/bingo/rooms/${id}/join`, { alias: sid.trim() });
      const roomData   = r.data.room;
      const roundsData = r.data.rounds || [];
      setCard(r.data.card);
      setRoom(roomData);

      const active  = roundsData.find(rnd => rnd.status === 'active');
      const drawnNow = active ? (active.drawn_numbers || []) : (roomData.drawn_numbers || []);
      setDrawn(drawnNow);
      if (drawnNow.length > 0) setLastDrawn(drawnNow[drawnNow.length - 1]);
      if (active) setActiveRound(active);

      localStorage.setItem(STORAGE_KEY(id), sid.trim());
      setPhase('play');

      const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
        auth: {}, transports: ['websocket'],
      });
      socketRef.current = socket;
      socket.emit('bingo:join_room', { roomId: id, alias: sid.trim() });

      socket.on('bingo:number_drawn', ({ number, drawn: d }) => {
        setDrawn(d); setLastDrawn(number);
      });
      socket.on('bingo:round_started', ({ round }) => {
        setActiveRound(round); setDrawn([]); setLastDrawn(null);
        setClaimed(false); setCanClaim(false); setWinners([]);
        setRoundMsg(`รอบ ${round.round_number} เริ่มแล้ว!`);
        setTimeout(() => setRoundMsg(''), 3000);
      });
      socket.on('bingo:round_ended', () => {
        setActiveRound(null); setCanClaim(false);
        setRoundMsg('รอบนี้จบแล้ว รอรอบถัดไป...');
      });
      socket.on('bingo:winner', (w) => setWinners(prev => [...prev, w]));
      socket.on('bingo:game_ended', () => {
        localStorage.removeItem(STORAGE_KEY(id)); setPhase('end');
      });
    } catch (e) {
      setJoinErr(e.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally { setJoining(false); }
  };

  useEffect(() => {
    if (!card || !activeRound || claimed) return;
    setCanClaim(checkWin(card.numbers, drawn, activeRound.pattern));
  }, [drawn, card, activeRound, claimed]);

  const claimBingo = () => {
    if (!canClaim || claimed || !activeRound) return;
    setClaimed(true); setCanClaim(false);
    socketRef.current?.emit('bingo:claim', {
      roomId: id, roundId: activeRound.id,
      cardId: card.id, alias: studentId.trim(),
    });
  };

  /* ── JOIN ──────────────────────────────────────────────────── */
  if (phase === 'join') return (
    <div style={{ minHeight:'100dvh', background:'linear-gradient(135deg,#1e1b4b,#0f172a)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'20px', fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ width:'100%', maxWidth:'340px' }}>
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <div style={{ fontSize:'56px', lineHeight:1, marginBottom:'8px' }}>🎱</div>
          <h1 style={{ fontSize:'36px', fontWeight:900, color:'#fff', margin:0, letterSpacing:'-1px' }}>BINGO</h1>
          {room?.name && <p style={{ color:'#c4b5fd', marginTop:'4px', fontSize:'13px' }}>{room.name}</p>}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); doJoin(studentId); }}>
          <label style={{ display:'block', color:'rgba(255,255,255,0.4)', fontSize:'11px',
            textAlign:'center', marginBottom:'6px', letterSpacing:'1px', textTransform:'uppercase' }}>
            รหัสนักเรียน
          </label>
          <input
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            placeholder="เช่น 12345"
            autoFocus
            style={{ width:'100%', padding:'14px 16px', borderRadius:'16px',
              textAlign:'center', fontSize:'22px', fontWeight:700, color:'#fff',
              background:'rgba(255,255,255,0.08)', border:'2px solid rgba(255,255,255,0.15)',
              outline:'none', boxSizing:'border-box', marginBottom:'12px' }}
          />
          {joinErr && <p style={{ color:'#f87171', textAlign:'center', fontSize:'13px', marginBottom:'8px' }}>{joinErr}</p>}
          <button type="submit" disabled={joining || !studentId.trim()}
            style={{ width:'100%', padding:'15px', borderRadius:'16px', fontWeight:900,
              fontSize:'17px', color:'#fff', border:'none', cursor:'pointer',
              background: joining || !studentId.trim() ? 'rgba(255,255,255,0.15)' : 'linear-gradient(135deg,#7c3aed,#db2777)',
              opacity: joining || !studentId.trim() ? 0.5 : 1, transition:'all 0.2s' }}>
            {joining ? 'กำลังเข้า...' : 'รับใบ Bingo'}
          </button>
        </form>

        <p style={{ textAlign:'center', color:'rgba(255,255,255,0.2)', fontSize:'11px', marginTop:'16px' }}>
          ระบบจะจำใบของคุณอัตโนมัติ
        </p>
        <p style={{ textAlign:'center', color:'rgba(255,255,255,0.12)', fontSize:'10px', marginTop:'6px' }}>
          v{APP_VERSION}
        </p>
      </div>
    </div>
  );

  /* ── END ───────────────────────────────────────────────────── */
  if (phase === 'end') return (
    <div style={{ minHeight:'100dvh', background:'linear-gradient(135deg,#1e1b4b,#0f172a)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      color:'#fff', padding:'20px', fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ fontSize:'64px', marginBottom:'16px' }}>🎉</div>
      <h2 style={{ fontSize:'28px', fontWeight:900, margin:'0 0 8px' }}>เกมจบแล้ว!</h2>
      <p style={{ color:'rgba(255,255,255,0.4)', marginBottom:'24px' }}>ขอบคุณที่เข้าร่วม</p>
      {winners.some(w => w.alias === studentId.trim()) && (
        <div style={{ padding:'12px 24px', borderRadius:'16px', fontWeight:700, fontSize:'16px',
          background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.4)', color:'#fbbf24' }}>
          🏆 คุณได้รับรางวัลในเกมนี้!
        </div>
      )}
    </div>
  );

  /* ── PLAY ──────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight:'100dvh', background:'linear-gradient(135deg,#1e1b4b,#0f172a)',
      color:'#fff', fontFamily:"'Segoe UI',sans-serif", paddingBottom: canClaim ? '96px' : '16px' }}>

      {/* ── Header ── */}
      <div style={{ padding:'10px 14px 8px', display:'flex', alignItems:'center', justifyContent:'space-between',
        background:'rgba(15,23,42,0.7)', backdropFilter:'blur(8px)',
        borderBottom:'1px solid rgba(255,255,255,0.08)', position:'sticky', top:0, zIndex:10 }}>
        <div>
          <p style={{ fontWeight:800, fontSize:'14px', margin:0 }}>{room?.name || 'Bingo'}</p>
          <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'11px', margin:0 }}>รหัส: {studentId}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          {activeRound?.is_golden && (
            <span style={{ padding:'2px 10px', borderRadius:'999px', fontSize:'11px', fontWeight:700,
              background:'linear-gradient(90deg,#f59e0b,#ef4444)' }}>
              ⚡ รอบทองคำ
            </span>
          )}
          <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.18)' }}>v{APP_VERSION}</span>
        </div>
      </div>

      {/* ── Round message ── */}
      {roundMsg && (
        <div style={{ margin:'8px 12px 0', padding:'8px 14px', borderRadius:'12px',
          textAlign:'center', fontSize:'13px', fontWeight:700,
          background:'rgba(124,58,237,0.25)', border:'1px solid rgba(124,58,237,0.45)' }}>
          {roundMsg}
        </div>
      )}

      {/* ── Last drawn + round info row ── */}
      <div style={{ display:'flex', gap:'8px', padding:'8px 12px 0', alignItems:'stretch' }}>
        {/* big number */}
        <div style={{ flex:1, borderRadius:'16px', padding:'12px 8px', textAlign:'center',
          background: lastDrawn ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${lastDrawn ? 'rgba(124,58,237,0.45)' : 'rgba(255,255,255,0.08)'}` }}>
          {lastDrawn ? (
            <>
              <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'10px', margin:'0 0 2px' }}>ล่าสุด</p>
              <div style={{ fontSize:'38px', fontWeight:900, lineHeight:1, color:'#a78bfa',
                textShadow:'0 0 20px rgba(167,139,250,0.5)' }}>
                {colOf(lastDrawn)}-{lastDrawn}
              </div>
              <p style={{ color:'rgba(255,255,255,0.2)', fontSize:'10px', margin:'2px 0 0' }}>
                {drawn.length}/75 ตัว
              </p>
            </>
          ) : (
            <p style={{ color:'rgba(255,255,255,0.2)', fontSize:'14px', padding:'8px 0' }}>
              {activeRound ? 'รอการสุ่ม...' : 'รอเริ่มรอบ'}
            </p>
          )}
        </div>
        {/* round info */}
        {activeRound && (
          <div style={{ width:'110px', borderRadius:'16px', padding:'10px 8px', textAlign:'center',
            background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)',
            display:'flex', flexDirection:'column', justifyContent:'center', gap:'4px' }}>
            <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'10px', margin:0 }}>รอบที่</p>
            <p style={{ fontWeight:900, fontSize:'22px', margin:0 }}>{activeRound.round_number}</p>
            {activeRound.prize && (
              <p style={{ color:'#fbbf24', fontSize:'11px', fontWeight:700, margin:0 }}>
                🎁 {activeRound.prize}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Bingo Card ── */}
      {card && (
        <div style={{ padding:'8px 12px 0' }}>
          {/* Column headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'4px', marginBottom:'3px' }}>
            {BINGO_COL.map(c => (
              <div key={c} style={{ textAlign:'center', fontWeight:900, fontSize:'18px',
                padding:'2px 0', color:'#c4b5fd' }}>{c}</div>
            ))}
          </div>
          {/* 5×5 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'4px' }}>
            {card.numbers.map((n, i) => {
              const isCenter = i === 12;
              const isMarked = isCenter || drawn.includes(n);
              const isNew    = n === lastDrawn;
              return (
                <div key={i}
                  style={{
                    aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
                    borderRadius:'10px', fontWeight:800, fontSize:'16px', transition:'all 0.25s',
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
                    color: isMarked ? '#fff' : 'rgba(255,255,255,0.4)',
                    boxShadow: isNew ? '0 0 20px rgba(124,58,237,0.65)' : undefined,
                    transform: isNew ? 'scale(1.06)' : undefined,
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
        <div style={{ margin:'8px 12px 0', padding:'10px 12px', borderRadius:'14px',
          background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'10px', marginBottom:'6px' }}>
            ออกไปแล้ว ({drawn.length} ตัว)
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
            {drawn.map((n, i) => (
              <span key={i} style={{
                padding:'2px 7px', borderRadius:'999px', fontSize:'11px', fontWeight:700,
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
        <div style={{ margin:'8px 12px 0', padding:'10px 12px', borderRadius:'14px',
          background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'10px', marginBottom:'6px' }}>🏆 ผู้ชนะ</p>
          {winners.map((w, i) => (
            <div key={i} style={{ display:'flex', gap:'8px', alignItems:'center',
              padding:'5px 0', fontSize:'13px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
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
        <div style={{ position:'fixed', bottom:'16px', left:0, right:0,
          display:'flex', justifyContent:'center', padding:'0 20px', zIndex:50 }}>
          <button onClick={claimBingo} style={{
            width:'100%', maxWidth:'320px', padding:'18px',
            borderRadius:'20px', fontSize:'22px', fontWeight:900, color:'#fff',
            border:'none', cursor:'pointer',
            background:'linear-gradient(135deg,#f59e0b,#ef4444)',
            boxShadow:'0 0 36px rgba(239,68,68,0.65)',
            animation:'bounce 0.8s infinite',
          }}>
            🎉 BINGO!
          </button>
        </div>
      )}

      {claimed && !winners.some(w => w.alias === studentId.trim()) && (
        <div style={{ margin:'8px 12px 0', padding:'12px', borderRadius:'14px', textAlign:'center',
          background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.35)' }}>
          <p style={{ color:'#fbbf24', fontWeight:700, fontSize:'13px', margin:0 }}>
            ส่ง BINGO แล้ว — รอครูยืนยัน...
          </p>
        </div>
      )}
    </div>
  );
}
