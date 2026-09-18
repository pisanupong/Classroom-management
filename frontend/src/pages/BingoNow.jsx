/**
 * BingoNow — หน้า Live Display สำหรับจอ 32 นิ้ว แนวนอน
 * Public page — ไม่ต้องล็อกอิน
 * Routes: /bingo/now (room picker)  |  /bingo/now/:id (direct display)
 *
 * Features:
 *  1. แสดงของรางวัลตามรอบที่กำลังเล่น
 *  2. Real-time drawn numbers พร้อม slot-machine animation
 *  3. ตาราง B/I/N/G/O แสดงเลขที่ออกแล้ว
 *  4. Custom text overlay + background preset
 *  5. Layout แนวนอน เต็มจอ
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../services/api';

/* ─── constants ──────────────────────────────────────────────── */
const COLS      = ['B','I','N','G','O'];
const COL_COLOR = { B:'#3b82f6', I:'#10b981', N:'#f59e0b', G:'#ef4444', O:'#8b5cf6' };
const COL_RANGE = { B:[1,15], I:[16,30], N:[31,45], G:[46,60], O:[61,75] };
const PATTERN_LABEL = { line:'เส้นตรง', full:'เต็มบอร์ด', corners:'4 มุม', T:'ตัว T', L:'ตัว L' };
const fmt = (n) => n ? `฿${Number(n).toLocaleString('th-TH')}` : '';

const colOf = (n) => {
  if (n <= 15) return 'B'; if (n <= 30) return 'I';
  if (n <= 45) return 'N'; if (n <= 60) return 'G'; return 'O';
};
const randInCol = (col) => {
  const [lo, hi] = COL_RANGE[col];
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
};

const BG_PRESETS = [
  { label: 'กลางคืน',     css: 'linear-gradient(135deg,#0a0a1a 0%,#0d1527 100%)' },
  { label: 'โอเชียน',     css: 'linear-gradient(135deg,#0c1a2e 0%,#0a2a40 100%)' },
  { label: 'ป่า',         css: 'linear-gradient(135deg,#071a07 0%,#0d2a0d 100%)' },
  { label: 'พระอาทิตย์',  css: 'linear-gradient(135deg,#1a0a00 0%,#2d1200 100%)' },
  { label: 'ม่วงดำ',      css: 'linear-gradient(135deg,#0a001a 0%,#1a0030 100%)' },
  { label: 'แดงเข้ม',     css: 'linear-gradient(135deg,#1a0005 0%,#2d000a 100%)' },
  { label: 'สีขาว',       css: 'linear-gradient(135deg,#f0f0f0 0%,#e0e0e0 100%)' },
];

/* ─── CSS injected globally ──────────────────────────────────── */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Prompt:wght@400;700;900&display=swap');

@keyframes slotSpin {
  0%   { transform: translateY(-40px) scale(0.7); opacity:0; }
  40%  { transform: translateY(8px) scale(1.05);  opacity:1; }
  70%  { transform: translateY(-4px) scale(0.98); opacity:1; }
  100% { transform: translateY(0) scale(1);        opacity:1; }
}
@keyframes numGlow {
  0%,100% { text-shadow: 0 0 30px currentColor, 0 0 60px currentColor; }
  50%      { text-shadow: 0 0 60px currentColor, 0 0 120px currentColor, 0 0 200px currentColor; }
}
@keyframes pulse {
  0%,100% { transform:scale(1); }
  50%      { transform:scale(1.04); }
}
@keyframes winnerPop {
  0%   { transform:scale(0.5) rotate(-10deg); opacity:0; }
  60%  { transform:scale(1.15) rotate(3deg);  opacity:1; }
  100% { transform:scale(1) rotate(0deg);     opacity:1; }
}
@keyframes tickerScroll {
  0%   { transform:translateX(0); }
  100% { transform:translateX(-50%); }
}
@keyframes starFloat {
  0%,100% { opacity:0.08; transform:translateY(0); }
  50%      { opacity:0.35; transform:translateY(-12px); }
}
@keyframes fadeIn {
  from { opacity:0; transform:translateY(10px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes spinRapid {
  0%   { transform:rotateX(0deg);   opacity:1; }
  49%  { transform:rotateX(90deg);  opacity:0; }
  50%  { transform:rotateX(-90deg); opacity:0; }
  100% { transform:rotateX(0deg);   opacity:1; }
}
.slot-enter { animation: slotSpin 0.5s cubic-bezier(0.22,1,0.36,1) forwards; }
.num-glow   { animation: numGlow 2s ease-in-out infinite; }
.pulse-anim { animation: pulse 1.5s ease-in-out infinite; }
.winner-pop { animation: winnerPop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.fadeIn     { animation: fadeIn 0.4s ease forwards; }
.spinning   { animation: spinRapid 0.08s linear infinite; }
`;

/* ─── StarField background ───────────────────────────────────── */
const StarField = ({ count = 80 }) => (
  <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
    {Array.from({length:count}, (_, i) => (
      <div key={i} style={{
        position:'absolute',
        left: `${Math.random()*100}%`,
        top:  `${Math.random()*100}%`,
        width: Math.random()<0.2 ? '3px' : '1.5px',
        height: Math.random()<0.2 ? '3px' : '1.5px',
        borderRadius: '50%',
        background: '#fff',
        opacity: 0.15 + Math.random()*0.5,
        animation: `starFloat ${3+Math.random()*6}s ease-in-out ${Math.random()*5}s infinite`,
      }} />
    ))}
  </div>
);

/* ─── Big number display with slot animation ─────────────────── */
const BigNumber = ({ number, animKey, isLight }) => {
  const [displayNum, setDisplayNum] = useState(number);
  const [spinning,   setSpinning]   = useState(false);
  const [slotClass,  setSlotClass]  = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (number == null) { setDisplayNum(null); return; }
    // Start slot machine spin
    setSpinning(true);
    const col = colOf(number);
    let steps = 0;
    const maxSteps = 18;

    timerRef.current = setInterval(() => {
      steps++;
      if (steps >= maxSteps) {
        clearInterval(timerRef.current);
        setDisplayNum(number);
        setSpinning(false);
        setSlotClass('slot-enter');
        setTimeout(() => setSlotClass(''), 600);
      } else {
        setDisplayNum(randInCol(col));
      }
    }, steps < 10 ? 60 : 100);

    return () => clearInterval(timerRef.current);
  }, [animKey]);

  const col = displayNum != null ? colOf(displayNum) : null;
  const color = col ? COL_COLOR[col] : (isLight ? '#1e293b' : '#fff');

  return (
    <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px' }}>
      {/* Column letter */}
      {col && (
        <div style={{
          fontSize: 'clamp(2rem,5vw,4rem)',
          fontWeight: 900,
          color: COL_COLOR[col],
          fontFamily: "'Orbitron','Prompt',sans-serif",
          letterSpacing: '4px',
          textShadow: `0 0 20px ${COL_COLOR[col]}aa`,
          marginBottom: '-8px',
        }}>
          {col}
        </div>
      )}
      {/* Main number */}
      <div
        className={spinning ? 'spinning' : `${slotClass} num-glow`}
        key={`${animKey}-${slotClass}`}
        style={{
          fontSize: 'clamp(6rem,18vw,16rem)',
          fontWeight: 900,
          fontFamily: "'Orbitron','Prompt',sans-serif",
          color,
          lineHeight: 1,
          textShadow: col ? `0 0 40px ${COL_COLOR[col]}88, 0 0 80px ${COL_COLOR[col]}44` : 'none',
          transition: spinning ? 'none' : 'color 0.3s',
          userSelect: 'none',
          minWidth: '3ch',
        }}>
        {displayNum ?? '—'}
      </div>
      {/* "FREE" label for center */}
      {displayNum === 0 && (
        <div style={{ fontSize:'1.5rem', color:'#d4af37', fontWeight:900 }}>FREE</div>
      )}
    </div>
  );
};

/* ─── Drawn numbers grid ─────────────────────────────────────── */
const DrawnGrid = ({ drawn, isLight }) => {
  const drawn_set = new Set(drawn);
  const textColor = isLight ? '#1e293b' : '#e2e8f0';
  const mutedColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)';

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'4px' }}>
      {COLS.map((col, ci) => {
        const [lo, hi] = COL_RANGE[col];
        return (
          <div key={col} style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
            {/* Column header */}
            <div style={{
              textAlign:'center', padding:'4px 0', borderRadius:'6px',
              background: COL_COLOR[col], color:'#fff',
              fontWeight: 900, fontSize:'clamp(0.75rem,1.5vw,1.1rem)',
              fontFamily:"'Orbitron','Prompt',sans-serif",
            }}>{col}</div>
            {/* Numbers */}
            {Array.from({length: hi-lo+1}, (_, i) => lo+i).map(n => {
              const hit = drawn_set.has(n);
              return (
                <div key={n} style={{
                  textAlign:'center', padding:'3px 2px', borderRadius:'5px',
                  fontWeight: hit ? 900 : 400,
                  fontSize: 'clamp(0.65rem,1.2vw,0.9rem)',
                  color: hit ? '#fff' : mutedColor,
                  background: hit ? COL_COLOR[col] : 'transparent',
                  transition: 'all 0.3s',
                  boxShadow: hit ? `0 0 8px ${COL_COLOR[col]}66` : 'none',
                }}>{n}</div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

/* ─── Room picker overlay ────────────────────────────────────── */
const RoomPicker = ({ onSelect }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/bingo/rooms')
      .then(r => setRooms(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:100,
    }}>
      <div style={{ fontSize:'2rem', fontWeight:900, color:'#fff', marginBottom:'8px', fontFamily:"'Prompt',sans-serif" }}>
        🎱 Bingo Now
      </div>
      <div style={{ fontSize:'0.9rem', color:'rgba(255,255,255,0.4)', marginBottom:'24px' }}>
        เลือกห้องที่ต้องการแสดง
      </div>
      {loading ? (
        <div style={{ color:'rgba(255,255,255,0.4)' }}>กำลังโหลด...</div>
      ) : rooms.length === 0 ? (
        <div style={{ color:'rgba(255,255,255,0.4)' }}>ไม่มีห้องที่เปิดอยู่</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', width:'min(380px,90vw)' }}>
          {rooms.map(r => (
            <div key={r.id} onClick={() => onSelect(r.id)}
              style={{
                padding:'14px 20px', borderRadius:'14px', cursor:'pointer',
                border:'1px solid rgba(255,255,255,0.12)',
                background:'rgba(255,255,255,0.06)',
                transition:'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
            >
              <div style={{ fontWeight:700, color:'#fff', fontSize:'1.05rem' }}>{r.name}</div>
              <div style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.35)', marginTop:'4px' }}>
                {r.total_rounds} รอบ · สถานะ: {r.status === 'playing' ? '🎲 กำลังเล่น' : r.status === 'waiting' ? '⏳ รอเล่น' : '✓ จบแล้ว'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Settings panel ─────────────────────────────────────────── */
const SettingsPanel = ({ bg, setBg, text, setText, textColor, setTextColor, onClose, isLight, setIsLight }) => (
  <div style={{
    position:'fixed', right:0, top:0, bottom:0, width:'320px',
    background: isLight ? 'rgba(240,240,240,0.97)' : 'rgba(10,10,26,0.97)',
    borderLeft:`1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)'}`,
    backdropFilter:'blur(20px)', zIndex:50,
    display:'flex', flexDirection:'column', padding:'20px', gap:'16px',
    overflowY:'auto',
    color: isLight ? '#1e293b' : '#e2e8f0',
  }}>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <span style={{ fontWeight:900, fontSize:'1rem' }}>⚙️ ตั้งค่าหน้าจอ</span>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', color:'inherit', opacity:0.6 }}>✕</button>
    </div>

    {/* Background presets */}
    <div>
      <div style={{ fontSize:'0.75rem', opacity:0.5, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>พื้นหลัง</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
        {BG_PRESETS.map(p => (
          <button key={p.label} onClick={() => { setBg(p.css); setIsLight(p.label === 'สีขาว'); }}
            style={{
              padding:'8px', borderRadius:'8px', cursor:'pointer', fontSize:'0.8rem', fontWeight:600,
              border:`2px solid ${bg === p.css ? '#7c3aed' : 'transparent'}`,
              background: p.css, color: p.label === 'สีขาว' ? '#1e293b' : '#fff',
              textShadow: p.label === 'สีขาว' ? 'none' : '0 1px 2px rgba(0,0,0,0.5)',
            }}>{p.label}</button>
        ))}
      </div>
    </div>

    {/* Custom hex background */}
    <div>
      <div style={{ fontSize:'0.75rem', opacity:0.5, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>สีพื้นหลังกำหนดเอง</div>
      <input
        type="color" defaultValue="#0a0a1a"
        onChange={e => { setBg(e.target.value); setIsLight(false); }}
        style={{ width:'100%', height:'36px', borderRadius:'8px', border:'none', cursor:'pointer' }}
      />
    </div>

    {/* Overlay text */}
    <div>
      <div style={{ fontSize:'0.75rem', opacity:0.5, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>ข้อความ Ticker</div>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="พิมพ์ข้อความที่ต้องการแสดง..."
        style={{
          width:'100%', padding:'8px 10px', borderRadius:'8px', fontSize:'0.85rem',
          background: isLight ? '#fff' : 'rgba(255,255,255,0.07)',
          border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.15)'}`,
          color: isLight ? '#1e293b' : '#fff', outline:'none',
          boxSizing:'border-box',
        }}
      />
    </div>

    {/* Text color */}
    <div>
      <div style={{ fontSize:'0.75rem', opacity:0.5, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>สีข้อความ Ticker</div>
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
        {['#fbbf24','#f87171','#34d399','#60a5fa','#c084fc','#ffffff','#1e293b'].map(c => (
          <div key={c} onClick={() => setTextColor(c)}
            style={{
              width:'28px', height:'28px', borderRadius:'50%', background:c, cursor:'pointer',
              border: textColor === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.2)',
              boxShadow: textColor === c ? `0 0 0 2px ${c}` : 'none',
            }} />
        ))}
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════
   Main Component
════════════════════════════════════════════════════════════════ */
export default function BingoNow() {
  const { id: urlId } = useParams();
  const [roomId,      setRoomId]      = useState(urlId || null);
  const [room,        setRoom]        = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [drawn,       setDrawn]       = useState([]);
  const [lastDrawn,   setLastDrawn]   = useState(null);
  const [animKey,     setAnimKey]     = useState(0);
  const [winners,     setWinners]     = useState([]);
  const [phase,       setPhase]       = useState('idle'); // idle | active | round_end | game_end

  // Settings
  const [bg,          setBg]          = useState(BG_PRESETS[0].css);
  const [isLight,     setIsLight]     = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [textColor,   setTextColor]   = useState('#fbbf24');
  const [showSettings,setShowSettings]= useState(false);

  const socketRef = useRef(null);

  /* ── inject CSS ─────────────────────────────────────── */
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  /* ── fetch initial room state ───────────────────────── */
  useEffect(() => {
    if (!roomId) return;
    api.get(`/bingo/rooms/${roomId}`).then(r => {
      setRoom(r.data);
      // Find active round
      const active = r.data.rounds?.find(rnd => rnd.status === 'active');
      if (active) {
        setActiveRound(active);
        setDrawn(active.drawn_numbers || []);
        if (active.drawn_numbers?.length > 0) {
          setLastDrawn(active.drawn_numbers[active.drawn_numbers.length - 1]);
        }
        setPhase('active');
      }
    }).catch(() => {});
  }, [roomId]);

  /* ── socket connection ──────────────────────────────── */
  useEffect(() => {
    if (!roomId) return;
    const socket = io(
      import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
      { auth:{}, transports:['websocket'] }
    );
    socketRef.current = socket;
    socket.emit('bingo:join_room', { roomId, alias:'NOW_DISPLAY' });

    socket.on('bingo:number_drawn', ({ number, drawn: d }) => {
      setDrawn(d || []);
      setLastDrawn(number);
      setAnimKey(k => k + 1);
      setPhase('active');
    });
    socket.on('bingo:round_started', ({ round }) => {
      setActiveRound(round);
      setDrawn([]);
      setLastDrawn(null);
      setWinners([]);
      setPhase('active');
    });
    socket.on('bingo:round_ended', () => setPhase('round_end'));
    socket.on('bingo:winner', w => setWinners(prev => [w, ...prev].slice(0, 5)));
    socket.on('bingo:game_ended', () => { setPhase('game_end'); socket.disconnect(); });

    return () => socket.disconnect();
  }, [roomId]);

  /* ── current prize info ─────────────────────────────── */
  const prizeImage  = activeRound?.prize_inventory?.image || activeRound?.prize_image || null;
  const prizeName   = activeRound?.prize_inventory?.name  || activeRound?.prize || null;
  const prizeValue  = activeRound?.prize_value || activeRound?.prize_inventory?.value || 0;
  const textPrimary = isLight ? '#1e293b' : '#fff';
  const textMuted   = isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)';
  const panelBg     = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
  const panelBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

  /* ── Room not picked yet ─────────────────────────────── */
  if (!roomId) {
    return (
      <>
        <style>{GLOBAL_CSS}</style>
        <RoomPicker onSelect={id => setRoomId(id)} />
        <div style={{ background: BG_PRESETS[0].css, minHeight:'100dvh' }} />
      </>
    );
  }

  return (
    <div style={{
      width:'100vw', height:'100dvh', overflow:'hidden',
      background: bg,
      fontFamily: "'Prompt','Segoe UI',sans-serif",
      color: textPrimary,
      display:'flex', flexDirection:'column',
      position:'relative',
    }}>

      {/* Stars (dark mode only) */}
      {!isLight && <StarField count={60} />}

      {/* ── Settings toggle button ── */}
      <div style={{ position:'absolute', top:'12px', right:'12px', zIndex:60, display:'flex', gap:'8px' }}>
        <button
          onClick={() => setRoomId(null)}
          title="เปลี่ยนห้อง"
          style={{
            padding:'6px 12px', borderRadius:'8px', border:`1px solid ${panelBorder}`,
            background: panelBg, color: textMuted, cursor:'pointer', fontSize:'12px', fontWeight:600,
          }}>
          ← เปลี่ยนห้อง
        </button>
        <button
          onClick={() => setShowSettings(s => !s)}
          title="ตั้งค่า"
          style={{
            padding:'6px 14px', borderRadius:'8px', border:`1px solid ${panelBorder}`,
            background: panelBg, color: textPrimary, cursor:'pointer', fontSize:'18px',
          }}>
          ⚙️
        </button>
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <SettingsPanel
          bg={bg} setBg={setBg}
          text={overlayText} setText={setOverlayText}
          textColor={textColor} setTextColor={setTextColor}
          isLight={isLight} setIsLight={setIsLight}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ══ MAIN 3-COLUMN LAYOUT ══════════════════════════════ */}
      <div style={{
        flex:1, display:'flex', gap:0, overflow:'hidden',
        position:'relative', zIndex:1,
      }}>

        {/* ── LEFT: Prize + Round info ───────────────────────── */}
        <div style={{
          width:'clamp(200px,22%,320px)', flexShrink:0,
          display:'flex', flexDirection:'column',
          padding:'16px 14px',
          borderRight:`1px solid ${panelBorder}`,
          gap:'12px', overflow:'hidden',
        }}>

          {/* Room name */}
          <div style={{ textAlign:'center', paddingBottom:'10px', borderBottom:`1px solid ${panelBorder}` }}>
            <div style={{ fontSize:'clamp(0.75rem,1.5vw,1rem)', fontWeight:900, color: textPrimary, lineHeight:1.2 }}>
              🎱 {room?.name || '...'}
            </div>
            {activeRound && (
              <div style={{ fontSize:'clamp(0.65rem,1.2vw,0.85rem)', color: textMuted, marginTop:'4px' }}>
                รอบ {activeRound.round_number} / {room?.total_rounds} · {PATTERN_LABEL[activeRound.pattern] || activeRound.pattern}
              </div>
            )}
          </div>

          {/* Prize */}
          <div style={{
            flex:1, display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', gap:'10px',
            background: panelBg, borderRadius:'16px', border:`1px solid ${panelBorder}`,
            padding:'14px', minHeight:0,
          }}>
            {activeRound ? (
              <>
                <div style={{ fontSize:'clamp(0.7rem,1.3vw,0.85rem)', color: textMuted, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                  🎁 ของรางวัล
                </div>
                {prizeImage && (
                  <div style={{ width:'100%', maxHeight:'160px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <img src={prizeImage} alt={prizeName} style={{
                      maxWidth:'100%', maxHeight:'160px', objectFit:'contain', borderRadius:'12px',
                      boxShadow:'0 4px 20px rgba(0,0,0,0.3)',
                    }} />
                  </div>
                )}
                {prizeName && (
                  <div style={{
                    textAlign:'center', fontWeight:900, fontSize:'clamp(0.85rem,1.8vw,1.2rem)',
                    color: textPrimary, lineHeight:1.3,
                  }}>
                    {prizeName}
                  </div>
                )}
                {prizeValue > 0 && (
                  <div style={{
                    background: 'rgba(212,175,55,0.15)', border:'1px solid rgba(212,175,55,0.35)',
                    borderRadius:'8px', padding:'4px 12px',
                    color:'#d4af37', fontWeight:900, fontSize:'clamp(0.85rem,1.6vw,1.1rem)',
                  }}>
                    {fmt(prizeValue)}
                  </div>
                )}
                {activeRound.is_golden && (
                  <div style={{ color:'#fbbf24', fontWeight:900, fontSize:'1.2rem' }}>⚡ โกลเด้น รอบ</div>
                )}
              </>
            ) : (
              <div style={{ color: textMuted, textAlign:'center', fontSize:'0.85rem' }}>
                {phase === 'game_end' ? '🏁 เกมจบแล้ว' : 'รอเริ่มรอบ...'}
              </div>
            )}
          </div>

          {/* Draw counter */}
          <div style={{
            textAlign:'center', padding:'8px',
            background: panelBg, borderRadius:'12px', border:`1px solid ${panelBorder}`,
          }}>
            <div style={{ fontSize:'clamp(1.4rem,3vw,2rem)', fontWeight:900, color: textPrimary }}>
              {drawn.length}
            </div>
            <div style={{ fontSize:'0.7rem', color: textMuted, marginTop:'2px' }}>
              เลขที่ออกแล้ว / 75
            </div>
            {/* Progress bar */}
            <div style={{ height:'4px', background:'rgba(255,255,255,0.1)', borderRadius:'2px', marginTop:'6px', overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:'2px', background:'#7c3aed', width:`${(drawn.length/75)*100}%`, transition:'width 0.5s' }} />
            </div>
          </div>
        </div>

        {/* ── CENTER: Big number ─────────────────────────────── */}
        <div style={{
          flex:1, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          position:'relative', overflow:'hidden', gap:'16px',
          padding:'20px 10px',
        }}>

          {/* Prize image watermark behind number */}
          {prizeImage && (
            <img src={prizeImage} alt="" aria-hidden style={{
              position:'absolute', top:'50%', left:'50%',
              transform:'translate(-50%,-50%)',
              maxWidth:'55%', maxHeight:'55%', objectFit:'contain',
              opacity:0.07, pointerEvents:'none', filter:'blur(2px)',
            }} />
          )}

          {/* Winner banner */}
          {winners.length > 0 && (
            <div className="winner-pop" style={{
              position:'absolute', top:'16px', left:'50%', transform:'translateX(-50%)',
              background:'linear-gradient(135deg,#d4af37,#ffd700)',
              color:'#1a1000', padding:'8px 24px', borderRadius:'99px',
              fontWeight:900, fontSize:'clamp(0.8rem,1.5vw,1rem)',
              boxShadow:'0 4px 20px rgba(212,175,55,0.5)',
              zIndex:10, textAlign:'center', whiteSpace:'nowrap',
            }}>
              🏆 {winners[0].alias} ชนะ!
              {winners.length > 1 && <span style={{marginLeft:'10px',fontWeight:400,fontSize:'0.85em'}}>+{winners.length-1} คน</span>}
            </div>
          )}

          {/* Big number */}
          {phase === 'game_end' ? (
            <div style={{ textAlign:'center', color: textPrimary }}>
              <div style={{ fontSize:'4rem' }}>🏁</div>
              <div style={{ fontSize:'2rem', fontWeight:900, marginTop:'12px' }}>เกมจบแล้ว</div>
            </div>
          ) : phase === 'round_end' && !lastDrawn ? (
            <div style={{ textAlign:'center', color: textMuted, fontSize:'1.5rem' }}>รอรอบถัดไป...</div>
          ) : (
            <BigNumber number={lastDrawn} animKey={animKey} isLight={isLight} />
          )}

          {/* Drawn history pills — last 5 */}
          {drawn.length > 1 && (
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'center', maxWidth:'90%' }}>
              {[...drawn].slice(-6, -1).reverse().map((n, i) => {
                const col = colOf(n);
                return (
                  <div key={`${n}-${i}`} style={{
                    padding:'4px 12px', borderRadius:'99px',
                    background:`${COL_COLOR[col]}22`,
                    border:`1px solid ${COL_COLOR[col]}55`,
                    color: COL_COLOR[col],
                    fontWeight:700, fontSize:'clamp(0.75rem,1.3vw,1rem)',
                    opacity: 0.5 + i * 0.08,
                  }}>
                    {col}{n}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Drawn numbers grid ──────────────────────── */}
        <div style={{
          width:'clamp(200px,25%,360px)', flexShrink:0,
          display:'flex', flexDirection:'column',
          padding:'16px 14px',
          borderLeft:`1px solid ${panelBorder}`,
          overflow:'hidden', gap:'8px',
        }}>
          <div style={{ fontSize:'clamp(0.65rem,1.2vw,0.8rem)', fontWeight:700, color: textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px' }}>
            ตัวเลขที่ออกแล้ว
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <DrawnGrid drawn={drawn} isLight={isLight} />
          </div>
        </div>
      </div>

      {/* ── BOTTOM: Ticker text ─────────────────────────────── */}
      {overlayText && (
        <div style={{
          height:'clamp(32px,4vh,48px)', overflow:'hidden',
          background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.35)',
          borderTop:`1px solid ${panelBorder}`,
          display:'flex', alignItems:'center',
          flexShrink:0, position:'relative', zIndex:2,
        }}>
          <div style={{
            display:'flex', whiteSpace:'nowrap',
            animation:'tickerScroll 20s linear infinite',
          }}>
            {/* Duplicate for seamless loop */}
            {[overlayText, overlayText].map((t, idx) => (
              <span key={idx} style={{
                paddingRight:'80px',
                fontSize:'clamp(0.8rem,2vh,1.1rem)',
                fontWeight:700, color: textColor,
                textShadow:`0 0 20px ${textColor}66`,
              }}>
                ✦ {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
