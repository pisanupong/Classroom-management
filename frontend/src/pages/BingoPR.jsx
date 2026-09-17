/**
 * BingoPR — หน้าประชาสัมพันธ์ Harry Potter Theme สำหรับจอ 32 นิ้ว
 * Public page — เปิดบนจอโปรเจกเตอร์/TV ให้นักเรียนดู
 * URL: /bingo/pr/:id
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

/* ─── helpers ─────────────────────────────────────────── */
const BINGO_COL = ['B', 'I', 'N', 'G', 'O'];
const colOf = (n) => {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
};
const COL_COLOR  = { B: '#60a5fa', I: '#34d399', N: '#fbbf24', G: '#f87171', O: '#c084fc' };
const COL_RANGE  = { B:[1,15], I:[16,30], N:[31,45], G:[46,60], O:[61,75] };
const PATTERN_LABEL = { line:'เส้นตรง', full:'เต็มบอร์ด', corners:'4 มุม', T:'ตัว T', L:'ตัว L' };
const fmt = (n) => n ? `฿${Number(n).toLocaleString('th-TH')}` : '';

/* ─── CSS keyframes ────────────────────────────────────── */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700;900&display=swap');

@keyframes twinkle {
  0%,100% { opacity:0.15; transform:scale(1); }
  50%      { opacity:1;    transform:scale(1.4); }
}
@keyframes starFloat {
  0%   { transform:translateY(0)   rotate(0deg); opacity:0.6; }
  50%  { transform:translateY(-18px) rotate(180deg); opacity:1; }
  100% { transform:translateY(0)   rotate(360deg); opacity:0.6; }
}
@keyframes goldGlow {
  0%,100% { text-shadow: 0 0 20px #d4af37aa, 0 0 40px #d4af3766; }
  50%      { text-shadow: 0 0 40px #ffd700cc, 0 0 80px #d4af37aa, 0 0 120px #b8860b55; }
}
@keyframes spellReveal {
  0%   { transform:scale(0.3) rotate(-12deg); opacity:0; filter:blur(20px); }
  60%  { transform:scale(1.08) rotate(2deg);  opacity:1; filter:blur(0); }
  100% { transform:scale(1) rotate(0deg);     opacity:1; filter:blur(0); }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes borderGlow {
  0%,100% { box-shadow: 0 0 15px #d4af3733, inset 0 0 15px #d4af3711; }
  50%      { box-shadow: 0 0 35px #d4af3766, inset 0 0 25px #d4af3722; }
}
@keyframes ticker {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes fadeUp {
  from { opacity:0; transform:translateY(20px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes candleFlicker {
  0%,100% { opacity:0.7; transform:scaleY(1); }
  25%      { opacity:1;   transform:scaleY(1.05) scaleX(0.95); }
  75%      { opacity:0.85; transform:scaleY(0.95) scaleX(1.05); }
}
@keyframes houseGlow {
  0%,100% { box-shadow:0 0 30px #740001aa; }
  50%      { box-shadow:0 0 60px #740001ff, 0 0 90px #d4af3766; }
}
@keyframes winnerPop {
  0%   { transform:scale(0); opacity:0; }
  70%  { transform:scale(1.15); opacity:1; }
  100% { transform:scale(1); opacity:1; }
}

.hp-font { font-family:'Cinzel',serif; }
.hp-deco  { font-family:'Cinzel Decorative',serif; }

.gold-text {
  background: linear-gradient(90deg,#b8860b,#ffd700,#d4af37,#ffd700,#b8860b);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer 3s linear infinite;
}
.border-magic {
  border: 1px solid #d4af3755;
  animation: borderGlow 2.5s ease-in-out infinite;
}
`;

/* ─── Star field ─────────────────────────────────────── */
const StarField = () => {
  const stars = React.useMemo(() => Array.from({ length: 120 }, (_, i) => ({
    id: i,
    top:  `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 2.5 + 0.5,
    delay: `${Math.random() * 5}s`,
    dur:   `${Math.random() * 3 + 2}s`,
  })), []);
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
      {stars.map(s => (
        <div key={s.id} style={{
          position:'absolute', top:s.top, left:s.left,
          width:`${s.size}px`, height:`${s.size}px`,
          borderRadius:'50%', background:'#fff',
          animation:`twinkle ${s.dur} ${s.delay} ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
};

/* ─── Floating sparkles ──────────────────────────────── */
const Sparkles = () => {
  const items = React.useMemo(() => Array.from({length:18}, (_,i)=>({
    id:i,
    top:`${10+Math.random()*80}%`,
    left:`${Math.random()*100}%`,
    delay:`${Math.random()*6}s`,
    dur:`${3+Math.random()*4}s`,
    size: Math.random()*12+8,
  })),[]);
  return (
    <div style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden'}}>
      {items.map(s=>(
        <div key={s.id} style={{
          position:'absolute',top:s.top,left:s.left,
          fontSize:`${s.size}px`,
          animation:`starFloat ${s.dur} ${s.delay} ease-in-out infinite`,
          opacity:0.5,
        }}>✦</div>
      ))}
    </div>
  );
};

/* ─── Ornate divider ─────────────────────────────────── */
const Divider = () => (
  <div style={{display:'flex',alignItems:'center',gap:'8px',margin:'6px 0'}}>
    <div style={{flex:1,height:'1px',background:'linear-gradient(to right,transparent,#d4af3766,transparent)'}}/>
    <span style={{color:'#d4af37',fontSize:'12px'}}>✦</span>
    <div style={{flex:1,height:'1px',background:'linear-gradient(to right,transparent,#d4af3766,transparent)'}}/>
  </div>
);

/* ══════════════════════════════════════════════════════════ */
export default function BingoPR() {
  const { id } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const animRef   = useRef(0);

  const [room,        setRoom]        = useState(null);
  const [rounds,      setRounds]      = useState([]);
  const [drawn,       setDrawn]       = useState([]);
  const [lastDrawn,   setLastDrawn]   = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [phase,       setPhase]       = useState('waiting');
  const [winners,     setWinners]     = useState([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [animKey,     setAnimKey]     = useState(0);

  const playerUrl = `${window.location.origin}/bingo/play/${id}`;

  /* ── Load room ── */
  useEffect(() => {
    api.get(`/bingo/rooms/${id}`)
      .then(r => {
        setRoom(r.data);
        setRounds(r.data.rounds || []);
        const active = (r.data.rounds || []).find(rnd => rnd.status === 'active');
        if (active) {
          setActiveRound(active);
          setDrawn(active.drawn_numbers || []);
          if (active.drawn_numbers?.length > 0) {
            setLastDrawn(active.drawn_numbers[active.drawn_numbers.length - 1]);
            setPhase('active');
          }
        }
      }).catch(console.error);
  }, [id]);

  /* ── Socket ── */
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: {}, transports: ['websocket'],
    });
    socketRef.current = socket;
    socket.emit('bingo:join_room', { roomId: id, alias: 'PR_DISPLAY' });

    socket.on('bingo:player_count', ({ count }) => setPlayerCount(count));
    socket.on('bingo:number_drawn', ({ number, drawn: d }) => {
      setDrawn(d); setLastDrawn(number);
      setAnimKey(k => k + 1); setPhase('active');
    });
    socket.on('bingo:round_started', ({ round }) => {
      setActiveRound(round); setDrawn([]); setLastDrawn(null);
      setWinners([]); setPhase('active');
    });
    socket.on('bingo:round_ended', () => setPhase('round_end'));
    socket.on('bingo:winner', w => setWinners(prev => [...prev, w]));
    socket.on('bingo:game_ended', () => { setPhase('game_end'); socket.disconnect(); });
    return () => socket.disconnect();
  }, [id]);

  const activeRoundIdx = rounds.findIndex(r => r.id === activeRound?.id);

  /* ═════════════════ WAITING ══════════════════ */
  if (phase === 'waiting' || !activeRound) {
    return (
      <div style={{
        minHeight:'100dvh', position:'relative', overflow:'hidden',
        background:'radial-gradient(ellipse at 20% 20%,#1a0a2e,#0a0a1a 50%,#0d0a00)',
        fontFamily:"'Cinzel',serif", color:'#e8d5a3', display:'flex',
        flexDirection:'column', alignItems:'center', justifyContent:'center',
      }}>
        <style>{STYLES}</style>
        <StarField/><Sparkles/>

        {/* Ambient corner glows */}
        <div style={{position:'absolute',top:0,left:0,width:'40%',height:'40%',
          background:'radial-gradient(circle at top left,#740001 0%,transparent 70%)',opacity:0.18,pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:0,right:0,width:'40%',height:'40%',
          background:'radial-gradient(circle at bottom right,#1a472a 0%,transparent 70%)',opacity:0.18,pointerEvents:'none'}}/>

        {/* Ornate frame top */}
        <div style={{textAlign:'center',marginBottom:'32px',animation:'fadeUp 0.8s ease',zIndex:1}}>
          <div className="hp-deco gold-text" style={{fontSize:'clamp(16px,3vw,36px)',letterSpacing:'6px',marginBottom:'8px'}}>
            ✦ BINGO MAGICUM ✦
          </div>
          {room?.name && (
            <div className="hp-font" style={{fontSize:'clamp(28px,5vw,64px)',fontWeight:900,letterSpacing:'2px',
              color:'#f5e6c8',textShadow:'0 0 40px #d4af3766'}}>
              {room.name}
            </div>
          )}
          {room?.ticket_price > 0 && (
            <div style={{marginTop:'12px',display:'inline-block',padding:'8px 28px',borderRadius:'4px',
              background:'linear-gradient(135deg,#740001,#4a0001)',border:'1px solid #d4af3744',
              animation:'houseGlow 2s ease-in-out infinite'}}>
              <span className="hp-font" style={{color:'#d4af37',fontSize:'clamp(16px,2.5vw,28px)',fontWeight:700}}>
                🪙 ราคาบัตร {fmt(room.ticket_price)} / ใบ
              </span>
            </div>
          )}
        </div>

        <Divider/>

        {/* QR Code — magical glow */}
        <div style={{margin:'24px 0',zIndex:1,animation:'fadeUp 1s ease'}}>
          <div style={{padding:'20px',borderRadius:'8px',background:'rgba(245,230,200,0.95)',
            boxShadow:'0 0 60px #d4af3788,0 0 120px #d4af3733',
            animation:'borderGlow 2.5s ease-in-out infinite'}}>
            <QRCodeSVG value={playerUrl} size={Math.min(window.innerWidth*0.28, 320)}/>
          </div>
          <p className="hp-font" style={{textAlign:'center',marginTop:'14px',fontSize:'clamp(14px,2vw,22px)',
            color:'#d4af37',letterSpacing:'2px',animation:'goldGlow 2s ease-in-out infinite'}}>
            📱 สแกนเพื่อรับใบ Bingo
          </p>
        </div>

        <Divider/>

        {/* Prizes overview */}
        {rounds.length > 0 && (
          <div style={{display:'flex',gap:'16px',flexWrap:'wrap',justifyContent:'center',
            marginTop:'20px',zIndex:1,animation:'fadeUp 1.2s ease'}}>
            {rounds.map((rnd,i)=> rnd.prize ? (
              <div key={rnd.id} style={{
                padding:'10px 20px',borderRadius:'4px',textAlign:'center',
                background:'rgba(212,175,55,0.08)',border:'1px solid #d4af3744',
                backdropFilter:'blur(8px)',
              }}>
                <div className="hp-font" style={{fontSize:'clamp(10px,1.3vw,14px)',color:'#d4af3799',marginBottom:'4px'}}>
                  รอบที่ {i+1} {rnd.is_golden?'⚡':''}
                </div>
                <div style={{fontSize:'clamp(12px,1.6vw,18px)',fontWeight:700,color:'#f5e6c8'}}>
                  🎁 {rnd.prize}
                </div>
              </div>
            ) : null)}
          </div>
        )}

        {playerCount > 0 && (
          <div style={{position:'absolute',top:'16px',right:'20px',
            padding:'6px 16px',borderRadius:'4px',
            background:'rgba(26,71,42,0.6)',border:'1px solid #2a623d99',color:'#34d399'}}>
            👥 {playerCount} online
          </div>
        )}
      </div>
    );
  }

  /* ═════════════════ GAME END ══════════════════ */
  if (phase === 'game_end') {
    return (
      <div style={{minHeight:'100dvh',position:'relative',overflow:'hidden',
        background:'radial-gradient(ellipse at center,#1a0a2e,#0a0a1a)',
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        fontFamily:"'Cinzel',serif",color:'#e8d5a3'}}>
        <style>{STYLES}</style>
        <StarField/><Sparkles/>
        <div style={{fontSize:'80px',animation:'winnerPop 0.6s ease',marginBottom:'16px',zIndex:1}}>🏆</div>
        <h1 className="hp-deco gold-text" style={{fontSize:'clamp(40px,7vw,90px)',fontWeight:900,margin:'0 0 8px',zIndex:1}}>
          Finite Incantatem!
        </h1>
        <p className="hp-font" style={{fontSize:'clamp(18px,2.5vw,32px)',color:'rgba(245,230,200,0.5)',zIndex:1}}>
          เกมจบแล้ว ✦ ขอบคุณทุกคนที่เข้าร่วม
        </p>
      </div>
    );
  }

  /* ═════════════════ ACTIVE / ROUND_END ═══════════ */
  const colColor = lastDrawn ? COL_COLOR[colOf(lastDrawn)] : '#d4af37';

  return (
    <div style={{
      minHeight:'100dvh', maxHeight:'100dvh', overflow:'hidden',
      position:'relative',
      background:'radial-gradient(ellipse at 15% 15%,#1a0a2e 0%,#0a0a1a 55%,#0d0800 100%)',
      fontFamily:"'Cinzel',serif", color:'#e8d5a3',
      display:'flex', flexDirection:'column',
    }}>
      <style>{STYLES}</style>
      <StarField/><Sparkles/>

      {/* Corner ambient glow */}
      <div style={{position:'absolute',top:0,left:0,width:'35%',height:'45%',
        background:'radial-gradient(circle at top left,#4a0001,transparent 70%)',opacity:0.25,pointerEvents:'none'}}/>
      <div style={{position:'absolute',bottom:0,right:0,width:'35%',height:'45%',
        background:'radial-gradient(circle at bottom right,#1a472a,transparent 70%)',opacity:0.25,pointerEvents:'none'}}/>

      {/* ── Header bar ── */}
      <div style={{
        flexShrink:0, padding:'8px 24px', zIndex:10,
        background:'rgba(10,8,20,0.9)', backdropFilter:'blur(16px)',
        borderBottom:'1px solid #d4af3733',
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <span className="hp-deco gold-text" style={{fontSize:'clamp(14px,1.8vw,22px)',letterSpacing:'3px'}}>
            ✦ BINGO
          </span>
          <span style={{color:'#d4af3744'}}>|</span>
          <span className="hp-font" style={{fontSize:'clamp(14px,1.8vw,22px)',color:'#f5e6c8',fontWeight:700}}>
            {room?.name}
          </span>
          {room?.ticket_price > 0 && (
            <div style={{padding:'3px 14px',borderRadius:'4px',
              background:'linear-gradient(135deg,#740001aa,#4a0001aa)',
              border:'1px solid #d4af3766',
              fontSize:'clamp(12px,1.4vw,18px)',fontWeight:700,color:'#d4af37'}}>
              🪙 {fmt(room.ticket_price)} / ใบ
            </div>
          )}
        </div>

        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          {activeRound?.is_golden && (
            <div style={{padding:'3px 14px',borderRadius:'4px',fontWeight:800,
              background:'linear-gradient(90deg,#d4af37,#f59e0b)',color:'#1a0a2e',
              fontSize:'clamp(12px,1.4vw,16px)',animation:'candleFlicker 1s infinite'}}>
              ⚡ รอบนาทีทอง!
            </div>
          )}
          <div style={{padding:'3px 14px',borderRadius:'4px',
            background:'rgba(212,175,55,0.1)',border:'1px solid #d4af3744',
            fontSize:'clamp(12px,1.4vw,16px)',color:'#d4af37'}}>
            รอบ {activeRoundIdx+1}/{rounds.length} — {PATTERN_LABEL[activeRound?.pattern]||activeRound?.pattern}
          </div>
          <div style={{fontSize:'clamp(12px,1.4vw,16px)',color:'rgba(245,230,200,0.4)',textAlign:'right'}}>
            <span style={{color:'#c084fc',fontWeight:700,fontSize:'clamp(16px,2vw,22px)'}}>{drawn.length}</span>
            <span style={{fontSize:'11px'}}>/75</span>
          </div>
          {playerCount > 0 && (
            <div style={{padding:'3px 14px',borderRadius:'4px',
              background:'rgba(26,71,42,0.4)',border:'1px solid #2a623d66',
              color:'#34d399',fontSize:'clamp(11px,1.3vw,15px)'}}>
              👥 {playerCount}
            </div>
          )}
        </div>
      </div>

      {/* ── Main 3-column body ── */}
      <div style={{flex:1,display:'flex',minHeight:0,zIndex:5,position:'relative'}}>

        {/* ═══ LEFT: All Prizes ═══ */}
        <div style={{
          width:'clamp(200px,22vw,320px)', flexShrink:0,
          borderRight:'1px solid #d4af3722',
          background:'rgba(10,8,20,0.6)', backdropFilter:'blur(12px)',
          overflowY:'auto', padding:'16px 14px',
          display:'flex', flexDirection:'column', gap:'10px',
        }}>
          <div className="hp-deco" style={{textAlign:'center',letterSpacing:'3px',
            color:'#d4af37',fontSize:'clamp(11px,1.2vw,15px)',marginBottom:'4px'}}>
            ✦ ของรางวัล ✦
          </div>
          <Divider/>

          {rounds.map((rnd, i) => {
            const isActive = rnd.id === activeRound?.id;
            const isDone   = rnd.status === 'finished';
            return (
              <div key={rnd.id} style={{
                borderRadius:'4px', padding:'10px 12px',
                background: isActive ? 'linear-gradient(135deg,rgba(116,0,1,0.35),rgba(74,0,1,0.35))'
                  : isDone  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(212,175,55,0.05)',
                border:`1px solid ${isActive ? '#d4af3777' : isDone ? '#ffffff11' : '#d4af3733'}`,
                animation: isActive ? 'houseGlow 2.5s ease-in-out infinite' : 'none',
                opacity: isDone ? 0.45 : 1,
                transition:'all 0.3s',
              }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'4px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                    <span className="hp-font" style={{
                      fontSize:'clamp(10px,1.1vw,14px)',
                      color: isActive ? '#d4af37' : 'rgba(245,230,200,0.4)',
                      fontWeight:700,
                    }}>
                      รอบที่ {i+1}
                    </span>
                    {rnd.is_golden && <span style={{fontSize:'11px'}}>⚡</span>}
                    {isDone && <span style={{fontSize:'10px',color:'#34d399'}}>✓</span>}
                  </div>
                  <span style={{fontSize:'clamp(9px,1vw,12px)',color:'rgba(245,230,200,0.3)'}}>
                    {PATTERN_LABEL[rnd.pattern]||rnd.pattern}
                  </span>
                </div>
                {rnd.prize ? (
                  <div style={{
                    fontSize:'clamp(12px,1.4vw,18px)',fontWeight:700,
                    color: isActive ? '#f5e6c8' : 'rgba(245,230,200,0.5)',
                    lineHeight:1.3,
                  }}>
                    🎁 {rnd.prize}
                  </div>
                ) : (
                  <div style={{fontSize:'clamp(10px,1.1vw,14px)',color:'rgba(245,230,200,0.2)'}}>ไม่มีของรางวัล</div>
                )}
                {isActive && rnd.prize && (
                  <div style={{marginTop:'6px',padding:'3px 8px',borderRadius:'3px',
                    display:'inline-block',
                    background:'rgba(212,175,55,0.15)',border:'1px solid #d4af3744',
                    fontSize:'clamp(9px,1vw,12px)',color:'#d4af37',letterSpacing:'1px'}}>
                    ✦ รอบนี้กำลังเล่น
                  </div>
                )}
              </div>
            );
          })}

          <Divider/>

          {/* Small QR */}
          <div style={{textAlign:'center',padding:'8px 0'}}>
            <div className="hp-font" style={{fontSize:'clamp(9px,1vw,12px)',color:'#d4af3788',
              letterSpacing:'2px',marginBottom:'8px'}}>
              สแกนเพื่อเล่น
            </div>
            <div style={{display:'inline-block',padding:'8px',borderRadius:'4px',background:'rgba(245,230,200,0.9)',
              boxShadow:'0 0 20px #d4af3755'}}>
              <QRCodeSVG value={playerUrl} size={Math.min(window.innerWidth*0.09,100)}/>
            </div>
          </div>
        </div>

        {/* ═══ CENTER: Big drawn number ═══ */}
        <div style={{
          flex:1, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:'16px',
          padding:'16px', minWidth:0,
        }}>

          {/* Round ended banner */}
          {phase === 'round_end' && (
            <div style={{padding:'10px 32px',borderRadius:'4px',textAlign:'center',
              background:'rgba(212,175,55,0.1)',border:'1px solid #d4af3766',
              animation:'borderGlow 1.2s ease-in-out infinite'}}>
              <div className="hp-deco" style={{fontSize:'clamp(18px,2.5vw,32px)',color:'#d4af37',fontWeight:700}}>
                🏁 จบรอบนี้แล้ว
              </div>
            </div>
          )}

          {/* BIG number */}
          {lastDrawn ? (
            <div key={animKey} style={{
              textAlign:'center',
              animation:'spellReveal 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}>
              {/* Column letter */}
              <div style={{
                fontFamily:"'Cinzel Decorative',serif",
                fontSize:'clamp(60px,10vw,140px)',
                fontWeight:900,
                lineHeight:0.85,
                color:colColor,
                textShadow:`0 0 60px ${colColor}aa, 0 0 120px ${colColor}44`,
              }}>
                {colOf(lastDrawn)}
              </div>
              {/* Golden divider line */}
              <div style={{
                width:'3px',
                height:'clamp(40px,5vw,80px)',
                background:`linear-gradient(to bottom,transparent,${colColor},transparent)`,
                margin:'6px auto',
              }}/>
              {/* Number */}
              <div style={{
                fontFamily:"'Cinzel',serif",
                fontSize:'clamp(90px,16vw,220px)',
                fontWeight:900,
                lineHeight:0.85,
                color:'#f5e6c8',
                textShadow:`0 0 80px ${colColor}88, 0 0 160px ${colColor}33, 0 6px 40px rgba(0,0,0,0.6)`,
              }}>
                {lastDrawn}
              </div>
              {/* Subtitle */}
              <div style={{
                marginTop:'12px',
                fontFamily:"'Cinzel',serif",
                fontSize:'clamp(11px,1.5vw,18px)',
                color:'rgba(245,230,200,0.3)',
                letterSpacing:'4px',
                textTransform:'uppercase',
              }}>
                Numerus Extractus
              </div>
            </div>
          ) : (
            <div style={{textAlign:'center'}}>
              <div className="hp-deco" style={{
                fontSize:'clamp(24px,4vw,56px)',
                color:'rgba(212,175,55,0.3)',
                animation:'goldGlow 2s ease-in-out infinite',
              }}>
                {phase === 'active' ? '✦ Expectans... ✦' : '✦ Parans... ✦'}
              </div>
              <div style={{marginTop:'16px',opacity:0.5}}>
                <div style={{display:'inline-block',padding:'8px',borderRadius:'4px',
                  background:'rgba(245,230,200,0.9)',boxShadow:'0 0 30px #d4af3755'}}>
                  <QRCodeSVG value={playerUrl} size={Math.min(window.innerWidth*0.15,180)}/>
                </div>
              </div>
            </div>
          )}

          {/* Winners */}
          {winners.length > 0 && (
            <div style={{
              textAlign:'center',padding:'12px 24px',borderRadius:'4px',
              background:'linear-gradient(135deg,rgba(116,0,1,0.3),rgba(212,175,55,0.15))',
              border:'1px solid #d4af3766',
              animation:'winnerPop 0.5s ease, houseGlow 2s ease-in-out infinite',
              zIndex:2,
            }}>
              <div className="hp-deco" style={{color:'#d4af37',fontSize:'clamp(14px,1.8vw,22px)',
                marginBottom:'8px',letterSpacing:'3px'}}>
                🏆 Vincitor!
              </div>
              <div style={{display:'flex',gap:'12px',flexWrap:'wrap',justifyContent:'center'}}>
                {winners.map((w,i)=>(
                  <span key={i} className="hp-font" style={{
                    padding:'5px 18px',borderRadius:'3px',fontWeight:700,
                    fontSize:'clamp(14px,2vw,24px)',
                    background:'rgba(212,175,55,0.2)',border:'1px solid #d4af3766',color:'#ffd700',
                  }}>
                    ✦ {w.alias}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT: B/I/N/G/O number grid ═══ */}
        <div style={{
          width:'clamp(200px,22vw,340px)', flexShrink:0,
          borderLeft:'1px solid #d4af3722',
          background:'rgba(10,8,20,0.6)', backdropFilter:'blur(12px)',
          overflowY:'auto', padding:'12px 10px',
        }}>
          <div className="hp-deco" style={{textAlign:'center',letterSpacing:'3px',
            color:'#d4af37',fontSize:'clamp(11px,1.2vw,15px)',marginBottom:'8px'}}>
            ✦ Numeri Extracti ✦
          </div>
          <Divider/>

          {/* B/I/N/G/O columns */}
          <div style={{display:'flex',gap:'5px',marginTop:'10px',height:'calc(100% - 60px)'}}>
            {BINGO_COL.map(col => {
              const [lo, hi] = COL_RANGE[col];
              const all = Array.from({length: hi-lo+1}, (_,i)=>lo+i);
              return (
                <div key={col} style={{flex:1,display:'flex',flexDirection:'column',gap:'3px'}}>
                  {/* Header */}
                  <div style={{
                    textAlign:'center',
                    fontFamily:"'Cinzel Decorative',serif",
                    fontSize:'clamp(14px,1.8vw,24px)',fontWeight:900,
                    color:COL_COLOR[col],
                    textShadow:`0 0 20px ${COL_COLOR[col]}88`,
                    padding:'4px 0',marginBottom:'4px',
                    borderBottom:`2px solid ${COL_COLOR[col]}44`,
                  }}>{col}</div>
                  {all.map(n=>{
                    const isDrawn  = drawn.includes(n);
                    const isLatest = n === lastDrawn;
                    return (
                      <div key={n} style={{
                        textAlign:'center',
                        padding:'clamp(2px,0.4vw,5px) 2px',
                        borderRadius:'3px',
                        fontFamily:"'Cinzel',serif",
                        fontWeight: isDrawn ? 800 : 500,
                        fontSize:'clamp(10px,1.2vw,16px)',
                        background: isLatest ? COL_COLOR[col]
                          : isDrawn ? `${COL_COLOR[col]}22`
                          : 'transparent',
                        color: isLatest ? '#0a0a1a'
                          : isDrawn ? COL_COLOR[col]
                          : 'rgba(245,230,200,0.15)',
                        border:`1px solid ${isDrawn ? COL_COLOR[col]+'44' : 'transparent'}`,
                        textDecoration: isDrawn && !isLatest ? 'none' : 'none',
                        transition:'all 0.25s',
                        boxShadow: isLatest ? `0 0 12px ${COL_COLOR[col]}` : 'none',
                      }}>
                        {n}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom ticker ── */}
      {drawn.length > 0 && (
        <div style={{
          flexShrink:0, borderTop:'1px solid #d4af3722',
          background:'rgba(10,8,20,0.85)',backdropFilter:'blur(12px)',
          padding:'7px 0', overflow:'hidden', zIndex:10,
        }}>
          <div style={{
            display:'flex', gap:'10px', alignItems:'center',
            animation:`ticker ${Math.max(drawn.length*2,14)}s linear infinite`,
            width:'max-content',
          }}>
            {[...drawn,...drawn].map((n,i)=>{
              const c = colOf(n);
              return (
                <span key={i} style={{
                  display:'inline-flex',alignItems:'center',gap:'3px',
                  padding:'3px 14px',borderRadius:'3px',whiteSpace:'nowrap',
                  fontFamily:"'Cinzel',serif",fontWeight:700,
                  fontSize:'clamp(11px,1.4vw,16px)',
                  background: n===lastDrawn && i<drawn.length ? COL_COLOR[c] : `${COL_COLOR[c]}18`,
                  color:       n===lastDrawn && i<drawn.length ? '#0a0a1a'  : COL_COLOR[c],
                  border:`1px solid ${COL_COLOR[c]}44`,
                  boxShadow: n===lastDrawn && i<drawn.length ? `0 0 12px ${COL_COLOR[c]}` : 'none',
                }}>
                  {c}-{n}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
