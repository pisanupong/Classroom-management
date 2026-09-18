/**
 * BingoNow — Live Display for 32" landscape screen
 * Routes: /bingo/now  |  /bingo/now/:id
 */
import React, { useEffect, useRef, useState } from 'react';
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
  if (!n) return null;
  if (n <= 15) return 'B'; if (n <= 30) return 'I';
  if (n <= 45) return 'N'; if (n <= 60) return 'G'; return 'O';
};
const randInCol = (col) => {
  const [lo, hi] = COL_RANGE[col];
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
};

const BG_PRESETS = [
  { label:'กลางคืน',    css:'linear-gradient(135deg,#0a0a1a 0%,#0d1527 100%)', light:false },
  { label:'โอเชียน',    css:'linear-gradient(135deg,#0c1a2e 0%,#0a2a40 100%)', light:false },
  { label:'ป่า',        css:'linear-gradient(135deg,#071a07 0%,#0d2a0d 100%)', light:false },
  { label:'พระอาทิตย์', css:'linear-gradient(135deg,#1a0a00 0%,#2d1200 100%)', light:false },
  { label:'ม่วงดำ',     css:'linear-gradient(135deg,#0a001a 0%,#1a0030 100%)', light:false },
  { label:'แดงเข้ม',    css:'linear-gradient(135deg,#1a0005 0%,#2d000a 100%)', light:false },
  { label:'สีขาว',      css:'linear-gradient(135deg,#f0f0f0 0%,#e0e0e0 100%)', light:true  },
];

/* ── inject global CSS ────────────────────────────────────────── */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Orbitron:wght@700;900&family=Prompt:wght@400;700;900&display=swap');

@keyframes numSettle {
  0%   { transform:scale(0.6); opacity:0.2; }
  60%  { transform:scale(1.08); opacity:1; }
  100% { transform:scale(1); opacity:1; }
}
@keyframes colSettle {
  0%   { letter-spacing:12px; opacity:0; }
  100% { letter-spacing:4px;  opacity:1; }
}
@keyframes numGlow {
  0%,100% { filter: brightness(1) drop-shadow(0 0 12px currentColor); }
  50%      { filter: brightness(1.3) drop-shadow(0 0 30px currentColor) drop-shadow(0 0 60px currentColor); }
}
@keyframes winnerPop {
  0%   { transform:scale(0.5) translateX(-50%) rotate(-6deg); opacity:0; }
  65%  { transform:scale(1.1) translateX(-50%) rotate(2deg);  opacity:1; }
  100% { transform:scale(1)   translateX(-50%) rotate(0deg);  opacity:1; }
}
@keyframes starFloat {
  0%,100% { opacity:0.08; transform:translateY(0); }
  50%      { opacity:0.35; transform:translateY(-10px); }
}
/* Harry Potter */
@keyframes hpSettle {
  0%   { transform:scale(0.2) translateY(50px) rotate(-12deg); opacity:0; filter:blur(8px); }
  55%  { transform:scale(1.12) translateY(-6px) rotate(2deg); opacity:1; filter:blur(0); }
  80%  { transform:scale(0.97) translateY(2px) rotate(-0.5deg); }
  100% { transform:scale(1) translateY(0) rotate(0); }
}
@keyframes hpGlow {
  0%,100% { filter: brightness(1.1) drop-shadow(0 0 20px #d4af37) drop-shadow(0 0 50px #b8860b88); }
  50%      { filter: brightness(1.5) drop-shadow(0 0 45px #ffd700) drop-shadow(0 0 100px #d4af37) drop-shadow(0 0 150px #ffec7055); }
}
/* Casino */
@keyframes casinoSettle {
  0%   { transform:scale(1.7); opacity:0.5; }
  55%  { transform:scale(0.93); opacity:1; }
  75%  { transform:scale(1.04); }
  100% { transform:scale(1); }
}
@keyframes casinoGlow {
  0%,100% { filter: brightness(1.1) drop-shadow(0 0 10px currentColor) drop-shadow(0 0 25px currentColor); }
  50%      { filter: brightness(1.6) drop-shadow(0 0 30px currentColor) drop-shadow(0 0 70px currentColor); }
}
/* Matrix */
@keyframes matrixSettle {
  0%   { opacity:0; transform:translateY(-60px); filter:blur(4px); }
  65%  { opacity:1; transform:translateY(6px); filter:blur(0); }
  100% { opacity:1; transform:translateY(0); }
}
@keyframes matrixGlow {
  0%,100% { filter: brightness(1) drop-shadow(0 0 10px #00ff41) drop-shadow(0 0 25px #00aa2a); }
  50%      { filter: brightness(1.4) drop-shadow(0 0 30px #00ff41) drop-shadow(0 0 70px #00cc33); }
}
/* Neon */
@keyframes neonSettle {
  0%   { transform:scale(0.6); opacity:0; }
  25%  { transform:scale(1.15); opacity:0.6; }
  42%  { transform:scale(0.9); opacity:0.3; }
  62%  { transform:scale(1.08); opacity:1; }
  82%  { transform:scale(0.97); }
  100% { transform:scale(1); opacity:1; }
}
@keyframes neonGlow {
  0%,100% { filter: brightness(1.2) drop-shadow(0 0 8px currentColor) drop-shadow(0 0 25px currentColor); }
  50%      { filter: brightness(1.8) drop-shadow(0 0 25px currentColor) drop-shadow(0 0 60px currentColor) drop-shadow(0 0 120px currentColor); }
}
@keyframes decoIn {
  0%   { transform:scale(0.3); opacity:0; }
  70%  { transform:scale(1.15); opacity:1; }
  100% { transform:scale(1); opacity:1; }
}
.num-settle    { animation: numSettle 0.45s cubic-bezier(0.22,1,0.36,1) forwards; }
.num-glow      { animation: numGlow 2.5s ease-in-out infinite; }
.col-settle    { animation: colSettle 0.3s ease forwards; }
.winner-pop    { animation: winnerPop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.hp-settle     { animation: hpSettle 0.8s cubic-bezier(0.22,1,0.36,1) forwards; }
.hp-glow       { animation: hpGlow 2s ease-in-out infinite; }
.casino-settle { animation: casinoSettle 0.5s cubic-bezier(0.22,1,0.36,1) forwards; }
.casino-glow   { animation: casinoGlow 1.2s ease-in-out infinite; }
.matrix-settle { animation: matrixSettle 0.45s ease-out forwards; }
.matrix-glow   { animation: matrixGlow 1.8s ease-in-out infinite; }
.neon-settle   { animation: neonSettle 0.6s ease forwards; }
.neon-glow     { animation: neonGlow 1.5s ease-in-out infinite; }
.deco-in       { animation: decoIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
`;

/* ── Animation themes ────────────────────────────────────────── */
const THEMES = [
  { id:'classic',      label:'ปกติ',           icon:'🎱' },
  { id:'harry_potter', label:'แฮรี่ พอตเตอร์',  icon:'⚡' },
  { id:'casino',       label:'คาสิโน',          icon:'🎰' },
  { id:'matrix',       label:'เมทริกซ์',         icon:'💻' },
  { id:'neon',         label:'นีออน',            icon:'🌟' },
];

const THEME_CONFIG = {
  classic: {
    spinRange: (col) => COL_RANGE[col],
    steps: 22,
    speed: (step, total) => step < total * 0.65 ? 55 : 95,
    settleClass:'num-settle', glowClass:'num-glow',
    color: (col) => COL_COLOR[col],
    font: "'Orbitron','Prompt',sans-serif",
  },
  harry_potter: {
    spinRange: (col) => COL_RANGE[col],
    steps: 26,
    speed: (step, total) => step < 4 ? 120 : step < total * 0.7 ? 88 : 150,
    settleClass:'hp-settle', glowClass:'hp-glow',
    color: () => '#d4af37',
    font: "'Cinzel','Georgia',serif",
  },
  casino: {
    spinRange: () => [1, 75],
    steps: 38,
    speed: (step, total) => Math.round(25 + (step / total) ** 2 * 200),
    settleClass:'casino-settle', glowClass:'casino-glow',
    color: (col) => COL_COLOR[col],
    font: "'Orbitron','Prompt',sans-serif",
  },
  matrix: {
    spinRange: () => [1, 75],
    steps: 18,
    speed: () => 38,
    settleClass:'matrix-settle', glowClass:'matrix-glow',
    color: () => '#00ff41',
    font: "'Courier New',monospace",
  },
  neon: {
    spinRange: (col) => COL_RANGE[col],
    steps: 20,
    speed: (step, total) => step < total * 0.75 ? 50 : 90,
    settleClass:'neon-settle', glowClass:'neon-glow',
    color: (col) => COL_COLOR[col],
    font: "'Orbitron','Prompt',sans-serif",
  },
};

/* ─── StarField ───────────────────────────────────────────────── */
const StarField = () => {
  const stars = useRef(
    Array.from({length:70}, (_, i) => ({
      id:i,
      left:`${Math.random()*100}%`,
      top:`${Math.random()*100}%`,
      size: Math.random()<0.15 ? 3 : 1.5,
      delay:`${Math.random()*6}s`,
      dur:`${3+Math.random()*5}s`,
    }))
  );
  return (
    <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
      {stars.current.map(s => (
        <div key={s.id} style={{
          position:'absolute', left:s.left, top:s.top,
          width:s.size, height:s.size, borderRadius:'50%',
          background:'#fff', opacity:0.2,
          animation:`starFloat ${s.dur} ease-in-out ${s.delay} infinite`,
        }}/>
      ))}
    </div>
  );
};

/* ─── Big Number with theme-aware slot-machine animation ─────── */
const BigNumber = ({ number, animKey, isLight, theme = 'classic', numSize = 17 }) => {
  const [display, setDisplay] = useState(number);
  const [settled, setSettled] = useState(true);
  const timerRef              = useRef(null);
  const prevKey               = useRef(animKey);

  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  useEffect(() => {
    if (animKey === prevKey.current && number === display) return;
    prevKey.current = animKey;
    clearTimeout(timerRef.current);

    if (number == null) { setDisplay(null); setSettled(true); return; }

    const cfg      = THEME_CONFIG[theme] || THEME_CONFIG.classic;
    const finalNum = number;
    const col      = colOf(finalNum);
    const total    = cfg.steps;

    setSettled(false);

    const tick = (step) => {
      if (step >= total) {
        setDisplay(finalNum);
        setSettled(true);
        return;
      }
      const [lo, hi] = cfg.spinRange(col);
      setDisplay(Math.floor(Math.random() * (hi - lo + 1)) + lo);
      const spd = typeof cfg.speed === 'function' ? cfg.speed(step, total) : cfg.speed;
      timerRef.current = setTimeout(() => tick(step + 1), spd);
    };
    tick(0);

    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, number, theme]);

  const col      = display != null ? colOf(display) : null;
  const cfg      = THEME_CONFIG[theme] || THEME_CONFIG.classic;
  const color    = col ? cfg.color(col) : (isLight ? '#1e293b' : '#fff');
  const colColor = (theme === 'harry_potter') ? '#d4af37'
                 : (theme === 'matrix')       ? '#00ff41'
                 : col ? COL_COLOR[col] : color;

  return (
    <div style={{textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>

      {/* Harry Potter top decoration */}
      {theme === 'harry_potter' && settled && col && (
        <div key={`hp-t-${animKey}`} className="deco-in"
          style={{fontSize:'2.2rem',lineHeight:1,filter:'drop-shadow(0 0 10px #d4af37)'}}>
          ⚡
        </div>
      )}

      {/* Column letter */}
      {col && (
        <div key={`col-${animKey}-${settled}`}
          className={settled ? 'col-settle' : ''}
          style={{
            fontSize:'clamp(1.8rem,4.5vw,3.5rem)', fontWeight:900,
            color: colColor,
            fontFamily: theme === 'matrix' ? "'Courier New',monospace" : "'Orbitron','Prompt',sans-serif",
            letterSpacing: settled ? '4px' : '12px',
            opacity: settled ? 1 : 0.35, marginBottom:'-6px', transition:'opacity 0.15s',
          }}>
          {col}
        </div>
      )}

      {/* Main number */}
      <div
        key={`num-${settled ? 'done' : `${animKey}-${display}`}`}
        className={settled ? `${cfg.settleClass} ${cfg.glowClass}` : ''}
        style={{
          fontSize:`clamp(3rem,${numSize}vw,20rem)`, fontWeight:900,
          fontFamily: cfg.font,
          color: settled ? color : (isLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)'),
          lineHeight:1, userSelect:'none', minWidth:'3ch', textAlign:'center',
          transition:'color 0.1s',
          filter: settled && col ? `drop-shadow(0 0 20px ${color}88)` : 'none',
        }}>
        {display ?? '—'}
      </div>

      {/* Harry Potter bottom decoration */}
      {theme === 'harry_potter' && settled && col && (
        <div key={`hp-b-${animKey}`} className="deco-in"
          style={{fontSize:'1.6rem',lineHeight:1,marginTop:'2px',opacity:0.85}}>
          ✨🔮✨
        </div>
      )}

      {/* Casino jackpot decoration */}
      {theme === 'casino' && settled && col && (
        <div key={`cas-${animKey}`} className="deco-in"
          style={{fontSize:'1.2rem',letterSpacing:'10px',marginTop:'2px',opacity:0.7}}>
          🎰🎰🎰
        </div>
      )}

      {/* Matrix label */}
      {theme === 'matrix' && settled && col && (
        <div key={`mx-${animKey}`} className="deco-in"
          style={{fontFamily:"'Courier New',monospace",fontSize:'0.85rem',color:'#00ff41',
            letterSpacing:'3px',marginTop:'4px',opacity:0.7}}>
          [SYSTEM LOCKED]
        </div>
      )}
    </div>
  );
};

/* ─── Drawn numbers grid ─────────────────────────────────────── */
const DrawnGrid = ({ drawn, isLight }) => {
  const drawnSet = new Set(drawn);
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'3px',height:'100%'}}>
      {COLS.map(col => {
        const [lo,hi] = COL_RANGE[col];
        return (
          <div key={col} style={{display:'flex',flexDirection:'column',gap:'2px'}}>
            <div style={{
              textAlign:'center', padding:'3px 0', borderRadius:'5px',
              background:COL_COLOR[col], color:'#fff',
              fontWeight:900, fontSize:'clamp(0.7rem,1.4vw,1rem)',
              fontFamily:"'Orbitron',sans-serif",
              flexShrink:0,
            }}>{col}</div>
            {Array.from({length:hi-lo+1},(_,i)=>lo+i).map(n => {
              const hit = drawnSet.has(n);
              return (
                <div key={n} style={{
                  textAlign:'center', padding:'2px 0', borderRadius:'4px',
                  fontWeight: hit ? 900 : 400,
                  fontSize: 'clamp(0.6rem,1.1vw,0.85rem)',
                  color: hit ? '#fff' : (isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.12)'),
                  background: hit ? COL_COLOR[col] : 'transparent',
                  boxShadow: hit ? `0 0 6px ${COL_COLOR[col]}55` : 'none',
                  transition:'all 0.35s ease',
                  flex:1,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>{n}</div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

/* ─── Room picker ────────────────────────────────────────────── */
const RoomPicker = ({ onSelect }) => {
  const [rooms, setRooms]     = useState([]);
  const [loading,setLoading]  = useState(true);
  useEffect(() => {
    api.get('/bingo/rooms').then(r=>setRooms(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',backdropFilter:'blur(14px)',
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:100}}>
      <div style={{fontSize:'2rem',fontWeight:900,color:'#fff',marginBottom:'6px',fontFamily:"'Prompt',sans-serif"}}>🎱 Bingo Now</div>
      <div style={{fontSize:'0.9rem',color:'rgba(255,255,255,0.4)',marginBottom:'24px'}}>เลือกห้องที่ต้องการแสดง</div>
      {loading ? (
        <div style={{color:'rgba(255,255,255,0.4)'}}>กำลังโหลด...</div>
      ) : rooms.length === 0 ? (
        <div style={{color:'rgba(255,255,255,0.4)'}}>ไม่มีห้องที่เปิดอยู่</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'10px',width:'min(380px,90vw)'}}>
          {rooms.map(r => (
            <div key={r.id} onClick={()=>onSelect(r.id)}
              style={{padding:'14px 20px',borderRadius:'14px',cursor:'pointer',
                border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',
                transition:'background 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.14)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'}>
              <div style={{fontWeight:700,color:'#fff',fontSize:'1.05rem'}}>{r.name}</div>
              <div style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.35)',marginTop:'4px'}}>
                {r.total_rounds} รอบ · {r.status==='playing'?'🎲 กำลังเล่น':r.status==='waiting'?'⏳ รอเล่น':'✓ จบแล้ว'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Settings panel ─────────────────────────────────────────── */
const SettingsPanel = ({
  bg, setBg, text, setText,
  textColor, setTextColor,
  tickerSize, setTickerSize,
  tickerSpeed, setTickerSpeed,
  theme, setTheme,
  prizeSize, setPrizeSize,
  numSize, setNumSize,
  isLight, onClose,
}) => {
  const panelColor = isLight ? '#1e293b' : '#e2e8f0';
  const panelBg    = isLight ? 'rgba(250,250,250,0.97)' : 'rgba(10,10,26,0.97)';
  const inputBg    = isLight ? '#fff' : 'rgba(255,255,255,0.07)';
  const inputBorder= isLight ? '#e2e8f0' : 'rgba(255,255,255,0.15)';
  const labelStyle = {fontSize:'0.72rem',opacity:0.45,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'};

  return (
    <div style={{position:'fixed',right:0,top:0,bottom:0,width:'300px',
      background:panelBg,borderLeft:`1px solid ${inputBorder}`,backdropFilter:'blur(20px)',
      zIndex:50,display:'flex',flexDirection:'column',padding:'18px',gap:'14px',
      overflowY:'auto',color:panelColor}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontWeight:900,fontSize:'0.95rem'}}>⚙️ ตั้งค่าหน้าจอ</span>
        <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',color:panelColor,opacity:0.6}}>✕</button>
      </div>

      {/* Animation theme */}
      <div>
        <div style={labelStyle}>ธีมแอนิเมชันตัวเลข</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'5px'}}>
          {THEMES.map(t => (
            <button key={t.id} onClick={()=>setTheme(t.id)}
              style={{padding:'6px 10px',borderRadius:'8px',cursor:'pointer',
                fontSize:'0.75rem',fontWeight:600,whiteSpace:'nowrap',
                border:`2px solid ${theme===t.id?'#7c3aed':'transparent'}`,
                background: theme===t.id ? 'rgba(124,58,237,0.25)'
                  : (isLight?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.06)'),
                color:panelColor}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Backgrounds */}
      <div>
        <div style={{...labelStyle,marginBottom:'7px'}}>พื้นหลัง</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px'}}>
          {BG_PRESETS.map(p => (
            <button key={p.label} onClick={()=>setBg(p)}
              style={{padding:'7px 6px',borderRadius:'7px',cursor:'pointer',fontSize:'0.78rem',fontWeight:600,
                border:`2px solid ${bg.css===p.css?'#7c3aed':'transparent'}`,
                background:p.css,color:p.light?'#1e293b':'#fff',
                textShadow:p.light?'none':'0 1px 2px rgba(0,0,0,0.6)'}}>
              {p.label}
            </button>
          ))}
        </div>
        <input type="color" defaultValue="#0a0a1a"
          onChange={e=>setBg({css:e.target.value,light:false})}
          title="กำหนดสีเอง"
          style={{width:'100%',height:'32px',borderRadius:'7px',border:'none',cursor:'pointer',marginTop:'6px'}}/>
      </div>

      {/* Number size */}
      <div>
        <div style={labelStyle}>ขนาดตัวเลขสุ่ม — {numSize}vw</div>
        <input type="range" min={8} max={28} step={1} value={numSize}
          onChange={e=>setNumSize(Number(e.target.value))}
          style={{width:'100%',cursor:'pointer'}}/>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.68rem',opacity:0.4,marginTop:'3px'}}>
          <span>เล็ก</span><span>ใหญ่</span>
        </div>
      </div>

      {/* Prize image size */}
      <div>
        <div style={labelStyle}>ขนาดรูปของรางวัล — {prizeSize}px</div>
        <input type="range" min={60} max={700} step={10} value={prizeSize}
          onChange={e=>setPrizeSize(Number(e.target.value))}
          style={{width:'100%',cursor:'pointer'}}/>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.68rem',opacity:0.4,marginTop:'3px'}}>
          <span>เล็ก</span><span>ใหญ่</span>
        </div>
      </div>

      {/* Ticker text */}
      <div>
        <div style={labelStyle}>ข้อความ Ticker</div>
        <textarea value={text} onChange={e=>setText(e.target.value)}
          placeholder="พิมพ์ข้อความที่ต้องการวิ่งด้านล่าง..."
          rows={2}
          style={{width:'100%',padding:'7px 10px',borderRadius:'7px',fontSize:'0.82rem',
            background:inputBg,border:`1px solid ${inputBorder}`,color:panelColor,
            outline:'none',resize:'vertical',boxSizing:'border-box',fontFamily:'inherit'}}/>
      </div>

      {/* Ticker color */}
      <div>
        <div style={labelStyle}>สีข้อความ</div>
        <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
          {['#fbbf24','#f87171','#34d399','#60a5fa','#c084fc','#ffffff','#000000'].map(c=>(
            <div key={c} onClick={()=>setTextColor(c)} style={{
              width:'26px',height:'26px',borderRadius:'50%',background:c,cursor:'pointer',
              border:`2px solid ${textColor===c?'#fff':'rgba(255,255,255,0.2)'}`,
              boxShadow:textColor===c?`0 0 0 2px ${c}`:'none',flexShrink:0,
            }}/>
          ))}
        </div>
      </div>

      {/* Ticker font size */}
      <div>
        <div style={labelStyle}>ขนาดตัวอักษร Ticker — {tickerSize}px</div>
        <input type="range" min={14} max={56} step={2} value={tickerSize}
          onChange={e=>setTickerSize(Number(e.target.value))}
          style={{width:'100%',cursor:'pointer'}}/>
      </div>

      {/* Ticker speed */}
      <div>
        <div style={labelStyle}>
          ความเร็ว Ticker — {tickerSpeed <= 5 ? 'เร็วมาก' : tickerSpeed <= 12 ? 'เร็ว' : tickerSpeed <= 25 ? 'กลาง' : 'ช้า'}
        </div>
        <input type="range" min={5} max={50} step={1} value={tickerSpeed}
          onChange={e=>setTickerSpeed(Number(e.target.value))}
          style={{width:'100%',cursor:'pointer'}}/>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.68rem',opacity:0.4,marginTop:'3px'}}>
          <span>เร็ว</span><span>ช้า</span>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════
   Main component
════════════════════════════════════════════════════════════════ */
export default function BingoNow() {
  const { id: urlId } = useParams();
  const [roomId,      setRoomId]       = useState(urlId || null);
  const [room,        setRoom]         = useState(null);
  const [activeRound, setActiveRound]  = useState(null);
  const [drawn,       setDrawn]        = useState([]);
  const [lastDrawn,   setLastDrawn]    = useState(null);
  const [animKey,     setAnimKey]      = useState(0);
  const [winners,     setWinners]      = useState([]);
  const [phase,       setPhase]        = useState('idle');

  // Settings
  const [bgPreset,    setBgPreset]     = useState(BG_PRESETS[0]);
  const [overlayText, setOverlayText]  = useState('');
  const [textColor,   setTextColor]    = useState('#fbbf24');
  const [tickerSize,  setTickerSize]   = useState(22);
  const [tickerSpeed, setTickerSpeed]  = useState(18);
  const [theme,       setTheme]        = useState('classic');
  const [prizeSize,   setPrizeSize]    = useState(150);
  const [numSize,     setNumSize]      = useState(17);
  const [showSettings,setShowSettings] = useState(false);

  const socketRef = useRef(null);

  /* inject CSS */
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  /* helper: apply fetched room data to state */
  const applyRoomData = (data, opts = {}) => {
    const { triggerAnim = false } = opts;
    setRoom(data);
    const active = data.rounds?.find(rnd => rnd.status === 'active');
    if (active) {
      setActiveRound(active);
      const d = active.drawn_numbers || [];
      setDrawn(prev => {
        if (d.length !== prev.length || triggerAnim) {
          if (d.length > 0 && d.length > prev.length) {
            setLastDrawn(d[d.length - 1]);
            setAnimKey(k => k + 1);
          }
          return d;
        }
        return prev;
      });
      setPhase('active');
    }
  };

  /* initial load */
  useEffect(() => {
    if (!roomId) return;
    api.get(`/bingo/rooms/${roomId}`)
      .then(r => applyRoomData(r.data, { triggerAnim: true }))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  /* polling fallback — syncs every 3 s so display never drifts */
  useEffect(() => {
    if (!roomId) return;
    const timer = setInterval(() => {
      api.get(`/bingo/rooms/${roomId}`)
        .then(r => applyRoomData(r.data))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  /* socket — for real-time instant updates (polling fills gaps) */
  useEffect(() => {
    if (!roomId) return;
    const socket = io(
      import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
      { auth:{}, transports:['websocket'], reconnection:true, reconnectionDelay:1000, reconnectionAttempts:Infinity }
    );
    socketRef.current = socket;

    // Join room on every (re)connect so server-side room membership is always current
    socket.on('connect', () => {
      socket.emit('bingo:join_room', { roomId, alias:'NOW_DISPLAY' });
    });

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
    socket.on('bingo:game_ended', () => setPhase('game_end'));

    return () => socket.disconnect();
  }, [roomId]);

  /* derived */
  const bg         = bgPreset.css;
  const isLight    = bgPreset.light;
  const prizeImage = activeRound?.prize_inventory?.image || activeRound?.prize_image || null;
  const prizeName  = activeRound?.prize_inventory?.name  || activeRound?.prize || null;
  const prizeValue = activeRound?.prize_value || activeRound?.prize_inventory?.value || 0;

  const textPrimary = isLight ? '#1e293b' : '#fff';
  const textMuted   = isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';
  const panelBg     = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
  const panelBorder = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

  /* ticker animation duration — adjust based on speed setting */
  const tickerDuration = `${tickerSpeed}s`;

  if (!roomId) {
    return (
      <>
        <style>{GLOBAL_CSS}</style>
        <RoomPicker onSelect={id => setRoomId(id)} />
        <div style={{background:BG_PRESETS[0].css,minHeight:'100dvh'}}/>
      </>
    );
  }

  return (
    <div style={{
      width:'100vw', height:'100dvh', overflow:'hidden',
      background: bg, fontFamily:"'Prompt','Segoe UI',sans-serif",
      color: textPrimary, display:'flex', flexDirection:'column', position:'relative',
    }}>
      {!isLight && <StarField />}

      {/* ── Controls top-right ── */}
      <div style={{position:'absolute',top:'10px',right:'10px',zIndex:60,display:'flex',gap:'7px'}}>
        <button onClick={()=>setRoomId(null)}
          style={{padding:'5px 12px',borderRadius:'7px',border:`1px solid ${panelBorder}`,
            background:panelBg,color:textMuted,cursor:'pointer',fontSize:'11px',fontWeight:600}}>
          ← เปลี่ยนห้อง
        </button>
        <button onClick={()=>setShowSettings(s=>!s)}
          style={{padding:'5px 12px',borderRadius:'7px',border:`1px solid ${panelBorder}`,
            background:showSettings?'rgba(124,58,237,0.25)':panelBg,
            color:textPrimary,cursor:'pointer',fontSize:'16px'}}>
          ⚙️
        </button>
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <SettingsPanel
          bg={bgPreset} setBg={setBgPreset}
          text={overlayText} setText={setOverlayText}
          textColor={textColor} setTextColor={setTextColor}
          tickerSize={tickerSize} setTickerSize={setTickerSize}
          tickerSpeed={tickerSpeed} setTickerSpeed={setTickerSpeed}
          theme={theme} setTheme={setTheme}
          prizeSize={prizeSize} setPrizeSize={setPrizeSize}
          numSize={numSize} setNumSize={setNumSize}
          isLight={isLight}
          onClose={()=>setShowSettings(false)}
        />
      )}

      {/* ══ 3-COLUMN MAIN AREA ══════════════════════════════════ */}
      <div style={{flex:1,display:'flex',overflow:'hidden',position:'relative',zIndex:1}}>

        {/* LEFT — Prize + info */}
        <div style={{
          width:'clamp(190px,21%,300px)', flexShrink:0,
          display:'flex', flexDirection:'column', padding:'14px 12px', gap:'10px',
          borderRight:`1px solid ${panelBorder}`, overflow:'hidden',
        }}>
          {/* Room + round badge */}
          <div style={{paddingBottom:'10px',borderBottom:`1px solid ${panelBorder}`,textAlign:'center'}}>
            <div style={{fontSize:'clamp(0.75rem,1.4vw,0.95rem)',fontWeight:900,color:textPrimary,lineHeight:1.3}}>
              🎱 {room?.name || '...'}
            </div>
            {activeRound && (
              <div style={{fontSize:'clamp(0.62rem,1.1vw,0.78rem)',color:textMuted,marginTop:'4px'}}>
                รอบ {activeRound.round_number}/{room?.total_rounds} · {PATTERN_LABEL[activeRound.pattern]||activeRound.pattern}
              </div>
            )}
          </div>

          {/* Prize card */}
          <div style={{
            flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
            gap:'8px',background:panelBg,borderRadius:'14px',border:`1px solid ${panelBorder}`,
            padding:'12px',minHeight:0,overflow:'hidden',
          }}>
            {activeRound ? (
              <>
                <div style={{fontSize:'clamp(0.65rem,1.2vw,0.78rem)',color:textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>
                  🎁 ของรางวัล
                </div>
                {prizeImage && (
                  <img src={prizeImage} alt={prizeName}
                    style={{maxWidth:'100%',maxHeight:`${prizeSize}px`,objectFit:'contain',borderRadius:'10px',
                      boxShadow:'0 4px 16px rgba(0,0,0,0.3)',transition:'max-height 0.3s'}}/>
                )}
                {prizeName && (
                  <div style={{textAlign:'center',fontWeight:900,fontSize:'clamp(0.8rem,1.7vw,1.1rem)',
                    color:textPrimary,lineHeight:1.3}}>
                    {prizeName}
                  </div>
                )}
                {prizeValue > 0 && (
                  <div style={{background:'rgba(212,175,55,0.15)',border:'1px solid rgba(212,175,55,0.35)',
                    borderRadius:'7px',padding:'3px 12px',color:'#d4af37',fontWeight:900,
                    fontSize:'clamp(0.82rem,1.5vw,1.05rem)'}}>
                    {fmt(prizeValue)}
                  </div>
                )}
                {activeRound.is_golden && (
                  <div style={{color:'#fbbf24',fontWeight:900,fontSize:'1rem'}}>⚡ โกลเด้น</div>
                )}
              </>
            ) : (
              <div style={{color:textMuted,textAlign:'center',fontSize:'0.82rem'}}>
                {phase==='game_end'?'🏁 เกมจบแล้ว':'รอเริ่มรอบ...'}
              </div>
            )}
          </div>

          {/* Draw counter */}
          <div style={{background:panelBg,borderRadius:'12px',border:`1px solid ${panelBorder}`,
            padding:'8px',textAlign:'center'}}>
            <div style={{fontSize:'clamp(1.4rem,2.8vw,2rem)',fontWeight:900,color:textPrimary}}>
              {drawn.length}
            </div>
            <div style={{fontSize:'0.67rem',color:textMuted}}>ออกแล้ว / 75</div>
            <div style={{height:'3px',background:'rgba(255,255,255,0.08)',borderRadius:'2px',marginTop:'5px',overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:'2px',background:'#7c3aed',
                width:`${(drawn.length/75)*100}%`,transition:'width 0.5s'}}/>
            </div>
          </div>
        </div>

        {/* CENTER — Big number */}
        <div style={{
          flex:1,display:'flex',flexDirection:'column',alignItems:'center',
          justifyContent:'center',position:'relative',overflow:'hidden',
          padding:'6px 4px',gap:'6px',
        }}>

          {/* Prize watermark */}
          {prizeImage && (
            <img src={prizeImage} alt="" aria-hidden style={{
              position:'absolute',top:'50%',left:'50%',
              transform:'translate(-50%,-50%)',
              maxWidth:'50%',maxHeight:'50%',objectFit:'contain',
              opacity:0.06,pointerEvents:'none',filter:'blur(3px)',
            }}/>
          )}

          {/* Winner banner */}
          {winners.length > 0 && (
            <div className="winner-pop" style={{
              position:'absolute',top:'14px',left:'50%',
              background:'linear-gradient(135deg,#d4af37,#ffd700)',
              color:'#1a1000',padding:'7px 24px',borderRadius:'99px',
              fontWeight:900,fontSize:'clamp(0.78rem,1.4vw,1rem)',
              boxShadow:'0 4px 18px rgba(212,175,55,0.45)',zIndex:5,
              whiteSpace:'nowrap',
            }}>
              🏆 {winners[0].alias} ชนะ!
              {winners.length > 1 && <span style={{marginLeft:'8px',fontWeight:400,fontSize:'0.85em'}}>+{winners.length-1}</span>}
            </div>
          )}

          {/* Number display */}
          {phase === 'game_end' ? (
            <div style={{textAlign:'center',color:textPrimary}}>
              <div style={{fontSize:'3.5rem'}}>🏁</div>
              <div style={{fontSize:'1.8rem',fontWeight:900,marginTop:'10px'}}>เกมจบแล้ว</div>
            </div>
          ) : (
            <BigNumber number={lastDrawn} animKey={animKey} isLight={isLight} theme={theme} numSize={numSize} />
          )}

          {/* Recent drawn pills (last 5 before current) */}
          {drawn.length > 1 && (
            <div style={{display:'flex',gap:'7px',flexWrap:'wrap',justifyContent:'center',maxWidth:'85%'}}>
              {[...drawn].slice(-6,-1).reverse().map((n,i) => {
                const c = colOf(n);
                return (
                  <div key={`${n}-${i}`} style={{
                    padding:'3px 11px',borderRadius:'99px',
                    background:`${COL_COLOR[c]}1a`,
                    border:`1px solid ${COL_COLOR[c]}44`,
                    color:COL_COLOR[c],fontWeight:700,
                    fontSize:'clamp(0.72rem,1.25vw,0.95rem)',
                    opacity:0.45 + i*0.1,
                  }}>
                    {c}{n}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT — Drawn grid */}
        <div style={{
          width:'clamp(190px,24%,340px)', flexShrink:0,
          display:'flex',flexDirection:'column',padding:'14px 12px',
          borderLeft:`1px solid ${panelBorder}`,overflow:'hidden',gap:'6px',
        }}>
          <div style={{fontSize:'clamp(0.62rem,1.1vw,0.76rem)',fontWeight:700,color:textMuted,
            textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'2px'}}>
            ตัวเลขที่ออกแล้ว ({drawn.length}/75)
          </div>
          <div style={{flex:1,overflow:'hidden'}}>
            <DrawnGrid drawn={drawn} isLight={isLight}/>
          </div>
        </div>
      </div>

      {/* ── TICKER — full width at bottom ───────────────────────── */}
      {overlayText && (
        <div style={{
          height:`calc(${tickerSize}px + 16px)`,
          overflow:'hidden',flexShrink:0,
          background:isLight?'rgba(0,0,0,0.07)':'rgba(0,0,0,0.4)',
          borderTop:`1px solid ${panelBorder}`,
          display:'flex',alignItems:'center',
          position:'relative',zIndex:2,
        }}>
          {/* Full-viewport ticker: duplicate text enough times to fill 200vw */}
          <div style={{
            display:'flex',
            whiteSpace:'nowrap',
            animation:`tickerMove ${tickerDuration} linear infinite`,
          }}>
            {/* We duplicate the text to create seamless loop */}
            {Array.from({length:8}).map((_,idx) => (
              <span key={idx} style={{
                paddingRight:'120px',
                fontSize:`${tickerSize}px`,
                fontWeight:700,
                color:textColor,
                textShadow:`0 0 16px ${textColor}55`,
                fontFamily:"'Prompt','Segoe UI',sans-serif",
              }}>
                ✦ {overlayText}
              </span>
            ))}
          </div>
          {/* CSS for ticker */}
          <style>{`
            @keyframes tickerMove {
              0%   { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
