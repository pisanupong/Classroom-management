/**
 * BingoPR — หน้าประชาสัมพันธ์ Harry Potter Theme สำหรับจอ 32 นิ้ว
 * Public page — เปิดบนจอโปรเจกเตอร์/TV ให้นักเรียนดู
 * Routes: /bingo/pr (room picker)  |  /bingo/pr/:id (direct display)
 */
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

/* ─── helpers ─────────────────────────────────────────── */
const BINGO_COL = ['B', 'I', 'N', 'G', 'O'];
const colOf = (n) => {
  if (n <= 15) return 'B'; if (n <= 30) return 'I';
  if (n <= 45) return 'N'; if (n <= 60) return 'G'; return 'O';
};
const COL_COLOR  = { B:'#60a5fa', I:'#34d399', N:'#fbbf24', G:'#f87171', O:'#c084fc' };
const COL_RANGE  = { B:[1,15], I:[16,30], N:[31,45], G:[46,60], O:[61,75] };
const PATTERN_LABEL = { line:'เส้นตรง', full:'เต็มบอร์ด', corners:'4 มุม', T:'ตัว T', L:'ตัว L' };
const fmt = (n) => n ? `฿${Number(n).toLocaleString('th-TH')}` : '';

/* ─── CSS ────────────────────────────────────────────── */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700;900&display=swap');

@keyframes twinkle {
  0%,100% { opacity:0.12; transform:scale(1); }
  50%      { opacity:0.9;  transform:scale(1.5); }
}
@keyframes starFloat {
  0%   { transform:translateY(0) rotate(0deg); opacity:0.5; }
  50%  { transform:translateY(-16px) rotate(180deg); opacity:0.9; }
  100% { transform:translateY(0) rotate(360deg); opacity:0.5; }
}
@keyframes goldGlow {
  0%,100% { text-shadow:0 0 20px #d4af37aa,0 0 40px #d4af3766; }
  50%      { text-shadow:0 0 40px #ffd700cc,0 0 80px #d4af37aa,0 0 120px #b8860b55; }
}
@keyframes spellReveal {
  0%   { transform:scale(0.3) rotate(-12deg); opacity:0; filter:blur(20px); }
  60%  { transform:scale(1.08) rotate(2deg);  opacity:1; filter:blur(0); }
  100% { transform:scale(1) rotate(0deg);     opacity:1; }
}
@keyframes shimmer {
  0%   { background-position:-200% center; }
  100% { background-position: 200% center; }
}
@keyframes borderGlow {
  0%,100% { box-shadow:0 0 15px #d4af3733,inset 0 0 15px #d4af3711; }
  50%      { box-shadow:0 0 35px #d4af3766,inset 0 0 25px #d4af3722; }
}
@keyframes ticker {
  0%   { transform:translateX(0); }
  100% { transform:translateX(-50%); }
}
@keyframes fadeUp {
  from { opacity:0; transform:translateY(20px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes houseGlow {
  0%,100% { box-shadow:0 0 25px #740001aa; }
  50%      { box-shadow:0 0 55px #740001ff,0 0 80px #d4af3766; }
}
@keyframes winnerPop {
  0%   { transform:scale(0); opacity:0; }
  70%  { transform:scale(1.15); opacity:1; }
  100% { transform:scale(1);   opacity:1; }
}
@keyframes prizeFloat {
  0%,100% { transform:translateY(0) scale(1); }
  50%      { transform:translateY(-6px) scale(1.03); }
}
@keyframes candleFlicker {
  0%,100% { opacity:0.7; }
  25%      { opacity:1; }
  75%      { opacity:0.85; }
}

.hp-font { font-family:'Cinzel',serif; }
.hp-deco  { font-family:'Cinzel Decorative',serif; }
.gold-text {
  background:linear-gradient(90deg,#b8860b,#ffd700,#d4af37,#ffd700,#b8860b);
  background-size:200% auto;
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  background-clip:text;
  animation:shimmer 3s linear infinite;
}
`;

/* ─── Star field ───────────────────────────────────── */
const StarField = () => {
  const stars = React.useMemo(() => Array.from({length:130},(_,i)=>({
    id:i, top:`${Math.random()*100}%`, left:`${Math.random()*100}%`,
    size:Math.random()*2.5+0.5,
    delay:`${Math.random()*5}s`, dur:`${Math.random()*3+2}s`,
  })),[]);
  return (
    <div style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden'}}>
      {stars.map(s=>(
        <div key={s.id} style={{position:'absolute',top:s.top,left:s.left,
          width:`${s.size}px`,height:`${s.size}px`,borderRadius:'50%',background:'#fff',
          animation:`twinkle ${s.dur} ${s.delay} ease-in-out infinite`}}/>
      ))}
    </div>
  );
};
const Sparkles = () => {
  const items = React.useMemo(()=>Array.from({length:16},(_,i)=>({
    id:i,top:`${10+Math.random()*80}%`,left:`${Math.random()*100}%`,
    delay:`${Math.random()*6}s`,dur:`${3+Math.random()*4}s`,size:Math.random()*10+6,
  })),[]);
  return (
    <div style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden'}}>
      {items.map(s=>(
        <div key={s.id} style={{position:'absolute',top:s.top,left:s.left,
          fontSize:`${s.size}px`,animation:`starFloat ${s.dur} ${s.delay} ease-in-out infinite`,
          opacity:0.45,color:'#d4af37'}}>✦</div>
      ))}
    </div>
  );
};
const Divider = () => (
  <div style={{display:'flex',alignItems:'center',gap:'8px',margin:'6px 0'}}>
    <div style={{flex:1,height:'1px',background:'linear-gradient(to right,transparent,#d4af3766,transparent)'}}/>
    <span style={{color:'#d4af37',fontSize:'11px'}}>✦</span>
    <div style={{flex:1,height:'1px',background:'linear-gradient(to right,transparent,#d4af3766,transparent)'}}/>
  </div>
);

/* ══════════════════════════════════════════════════════════ */
export default function BingoPR() {
  const { id: urlId } = useParams();
  const navigate = useNavigate();

  /* room picker (when no ID in URL) */
  const [rooms,        setRooms]        = useState([]);
  const [selectedId,   setSelectedId]   = useState(urlId || null);
  const [showPicker,   setShowPicker]   = useState(!urlId);

  /* room display state */
  const socketRef = useRef(null);
  const [room,        setRoom]        = useState(null);
  const [rounds,      setRounds]      = useState([]);
  const [drawn,       setDrawn]       = useState([]);
  const [lastDrawn,   setLastDrawn]   = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [phase,       setPhase]       = useState('waiting');
  const [winners,     setWinners]     = useState([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [animKey,     setAnimKey]     = useState(0);

  const roomId = selectedId;
  const playerUrl = roomId ? `${window.location.origin}/bingo/play/${roomId}` : '';

  /* load all rooms for picker */
  useEffect(() => {
    if (showPicker || !urlId) {
      api.get('/bingo/rooms').then(r => setRooms(r.data)).catch(()=>{});
    }
  }, []);

  /* load room detail when ID is known */
  useEffect(() => {
    if (!roomId) return;
    api.get(`/bingo/rooms/${roomId}`).then(r => {
      setRoom(r.data);
      setRounds(r.data.rounds || []);
      const active = (r.data.rounds||[]).find(rnd => rnd.status==='active');
      if (active) {
        setActiveRound(active);
        setDrawn(active.drawn_numbers || []);
        if (active.drawn_numbers?.length>0) {
          setLastDrawn(active.drawn_numbers[active.drawn_numbers.length-1]);
          setPhase('active');
        }
      }
    }).catch(console.error);
  }, [roomId]);

  /* socket */
  useEffect(() => {
    if (!roomId) return;
    const socket = io(import.meta.env.VITE_SOCKET_URL||'http://localhost:5000',{
      auth:{}, transports:['websocket'],
    });
    socketRef.current = socket;
    socket.emit('bingo:join_room',{roomId, alias:'PR_DISPLAY'});
    socket.on('bingo:player_count',({count})=>setPlayerCount(count));
    socket.on('bingo:number_drawn',({number,drawn:d})=>{
      setDrawn(d); setLastDrawn(number); setAnimKey(k=>k+1); setPhase('active');
    });
    socket.on('bingo:round_started',({round})=>{
      setActiveRound(round); setDrawn([]); setLastDrawn(null); setWinners([]); setPhase('active');
    });
    socket.on('bingo:round_ended',()=>setPhase('round_end'));
    socket.on('bingo:winner',w=>setWinners(prev=>[...prev,w]));
    socket.on('bingo:game_ended',()=>{ setPhase('game_end'); socket.disconnect(); });
    return ()=>socket.disconnect();
  }, [roomId]);

  const activeRoundIdx = rounds.findIndex(r=>r.id===activeRound?.id);

  /* prize image helper — inventory image takes priority over round's prize_image */
  const getPrizeImage = (rnd) => rnd?.prize_inventory?.image || rnd?.prize_image || null;

  /* ════ ROOM PICKER overlay ════ */
  if (showPicker || !roomId) {
    return (
      <div style={{minHeight:'100dvh',position:'relative',overflow:'hidden',
        background:'radial-gradient(ellipse at 20% 20%,#1a0a2e,#0a0a1a 55%,#0d0800)',
        fontFamily:"'Cinzel',serif",color:'#e8d5a3',
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      }}>
        <style>{STYLES}</style>
        <StarField/><Sparkles/>
        <div style={{position:'absolute',top:0,left:0,width:'40%',height:'40%',
          background:'radial-gradient(circle at top left,#4a0001,transparent 70%)',opacity:0.2,pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:0,right:0,width:'40%',height:'40%',
          background:'radial-gradient(circle at bottom right,#1a472a,transparent 70%)',opacity:0.2,pointerEvents:'none'}}/>

        <div style={{zIndex:10,textAlign:'center',animation:'fadeUp 0.7s ease',maxWidth:'520px',width:'100%',padding:'24px'}}>
          <div className="hp-deco gold-text" style={{fontSize:'clamp(14px,2.5vw,28px)',letterSpacing:'5px',marginBottom:'8px'}}>
            ✦ BINGO MAGICUM ✦
          </div>
          <div className="hp-font" style={{fontSize:'clamp(18px,3vw,36px)',fontWeight:900,color:'#f5e6c8',
            textShadow:'0 0 30px #d4af3766',marginBottom:'28px'}}>
            เลือกห้องที่ต้องการแสดง
          </div>
          <Divider/>
          <div style={{display:'flex',flexDirection:'column',gap:'10px',marginTop:'20px'}}>
            {rooms.length === 0 && (
              <div style={{color:'rgba(245,230,200,0.3)',fontSize:'14px',padding:'20px'}}>
                ⏳ กำลังโหลด หรือยังไม่มีห้องที่เปิดอยู่
              </div>
            )}
            {rooms.map(rm=>(
              <div key={rm.id}
                onClick={()=>{ setSelectedId(rm.id); setShowPicker(false); }}
                style={{
                  padding:'14px 20px',borderRadius:'6px',cursor:'pointer',textAlign:'left',
                  background:'rgba(212,175,55,0.07)',
                  border:'1px solid rgba(212,175,55,0.3)',
                  transition:'all 0.2s',
                }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(212,175,55,0.15)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(212,175,55,0.07)'}
              >
                <div className="hp-font" style={{fontWeight:700,fontSize:'clamp(14px,1.8vw,20px)',color:'#f5e6c8'}}>
                  {rm.name}
                </div>
                <div style={{fontSize:'12px',color:'rgba(212,175,55,0.6)',marginTop:'4px'}}>
                  {rm.total_rounds} รอบ
                  {rm.ticket_price>0 && <span style={{marginLeft:'10px',color:'#d4af37'}}>🪙 {fmt(rm.ticket_price)}/ใบ</span>}
                  <span style={{marginLeft:'10px',
                    color:rm.status==='playing'?'#34d399':rm.status==='finished'?'#6b7280':'#a78bfa'}}>
                    {rm.status==='playing'?'🎲 กำลังเล่น':rm.status==='finished'?'จบแล้ว':'รอเล่น'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Divider/>
          <div style={{marginTop:'16px'}}>
            <button onClick={()=>navigate('/bingo')}
              style={{padding:'8px 20px',borderRadius:'4px',
                border:'1px solid rgba(212,175,55,0.2)',background:'transparent',
                color:'rgba(212,175,55,0.5)',cursor:'pointer',fontSize:'13px',fontFamily:"'Cinzel',serif"}}>
              ← กลับ Bingo
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ════ GAME END ════ */
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
        <p className="hp-font" style={{fontSize:'clamp(16px,2.5vw,28px)',color:'rgba(245,230,200,0.5)',zIndex:1}}>
          เกมจบแล้ว ✦ ขอบคุณทุกคนที่เข้าร่วม
        </p>
        <button onClick={()=>setShowPicker(true)}
          style={{marginTop:'24px',padding:'10px 24px',borderRadius:'4px',cursor:'pointer',
            border:'1px solid #d4af3744',background:'rgba(212,175,55,0.1)',
            color:'#d4af37',fontFamily:"'Cinzel',serif",fontSize:'14px',zIndex:1}}>
          ← เลือกห้องอื่น
        </button>
      </div>
    );
  }

  /* ════ WAITING phase ════ */
  if (phase === 'waiting' || !activeRound) {
    const prizesForDisplay = rounds.filter(r=>r.prize||getPrizeImage(r));
    return (
      <div style={{minHeight:'100dvh',position:'relative',overflow:'hidden',
        background:'radial-gradient(ellipse at 20% 20%,#1a0a2e,#0a0a1a 55%,#0d0800)',
        fontFamily:"'Cinzel',serif",color:'#e8d5a3',
        display:'flex',flexDirection:'column',
      }}>
        <style>{STYLES}</style>
        <StarField/><Sparkles/>
        <div style={{position:'absolute',top:0,left:0,width:'40%',height:'40%',
          background:'radial-gradient(circle at top left,#4a0001,transparent 70%)',opacity:0.2,pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:0,right:0,width:'40%',height:'40%',
          background:'radial-gradient(circle at bottom right,#1a472a,transparent 70%)',opacity:0.2,pointerEvents:'none'}}/>

        {/* Header */}
        <div style={{flexShrink:0,padding:'10px 24px',zIndex:10,
          background:'rgba(10,8,20,0.85)',backdropFilter:'blur(16px)',
          borderBottom:'1px solid #d4af3722',
          display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div className="hp-deco gold-text" style={{fontSize:'clamp(14px,2vw,22px)',letterSpacing:'4px'}}>
            ✦ BINGO MAGICUM
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            {room?.ticket_price>0 && (
              <div style={{padding:'4px 16px',borderRadius:'4px',
                background:'linear-gradient(135deg,#740001aa,#4a0001aa)',
                border:'1px solid #d4af3766',fontSize:'clamp(13px,1.6vw,20px)',
                fontWeight:700,color:'#d4af37',fontFamily:"'Cinzel',serif"}}>
                🪙 {fmt(room.ticket_price)} / ใบ
              </div>
            )}
            {playerCount>0 && (
              <div style={{padding:'4px 12px',borderRadius:'4px',
                background:'rgba(26,71,42,0.4)',border:'1px solid #2a623d66',
                color:'#34d399',fontSize:'13px',fontFamily:"'Cinzel',serif"}}>
                👥 {playerCount}
              </div>
            )}
            <button onClick={()=>setShowPicker(true)}
              style={{padding:'4px 12px',borderRadius:'4px',border:'1px solid #d4af3733',
                background:'transparent',color:'rgba(212,175,55,0.4)',cursor:'pointer',
                fontSize:'11px',fontFamily:"'Cinzel',serif"}}>
              ✦ เปลี่ยนห้อง
            </button>
          </div>
        </div>

        {/* Body: prizes left + QR right */}
        <div style={{flex:1,display:'flex',zIndex:5,overflow:'hidden'}}>

          {/* Left: Prize showcase */}
          <div style={{flex:1,padding:'24px',overflowY:'auto',
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'16px'}}>
            <div className="hp-font" style={{fontSize:'clamp(14px,1.8vw,22px)',color:'#f5e6c8',fontWeight:900,
              textAlign:'center',textShadow:'0 0 30px #d4af3766',marginBottom:'4px'}}>
              {room?.name}
            </div>
            <Divider/>
            <div className="hp-deco" style={{textAlign:'center',letterSpacing:'3px',
              color:'#d4af37',fontSize:'clamp(11px,1.3vw,16px)'}}>
              ✦ ของรางวัล ✦
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'16px',justifyContent:'center'}}>
              {prizesForDisplay.map((rnd,i)=>{
                const img = getPrizeImage(rnd);
                return (
                  <div key={rnd.id} style={{
                    borderRadius:'8px',padding:'16px',textAlign:'center',width:'clamp(140px,18vw,220px)',
                    background:'linear-gradient(135deg,rgba(116,0,1,0.2),rgba(74,0,1,0.15))',
                    border:'1px solid rgba(212,175,55,0.3)',
                    animation:`prizeFloat ${3+i*0.4}s ease-in-out infinite, borderGlow 3s ease-in-out infinite`,
                    animationDelay:`${i*0.3}s`,
                  }}>
                    {img ? (
                      <img src={img} alt={rnd.prize||rnd.prize_inventory?.name}
                        style={{width:'100%',height:'clamp(80px,12vw,160px)',objectFit:'contain',
                          borderRadius:'6px',marginBottom:'10px',
                          filter:'drop-shadow(0 4px 20px rgba(212,175,55,0.3))'}}
                        onError={e=>e.target.style.display='none'}/>
                    ) : (
                      <div style={{width:'100%',height:'clamp(80px,12vw,160px)',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:'clamp(40px,6vw,80px)',marginBottom:'10px'}}>🎁</div>
                    )}
                    <div className="hp-font" style={{fontWeight:700,
                      fontSize:'clamp(11px,1.3vw,16px)',color:'#f5e6c8',lineHeight:1.3,marginBottom:'4px'}}>
                      {rnd.prize||rnd.prize_inventory?.name||'รางวัล'}
                    </div>
                    <div style={{fontSize:'clamp(9px,1vw,13px)',color:'rgba(212,175,55,0.6)'}}>
                      รอบ {rnd.round_number} {rnd.is_golden?'⚡':''}
                    </div>
                    {(rnd.prize_value||rnd.prize_inventory?.value)>0 && (
                      <div style={{marginTop:'4px',fontSize:'clamp(10px,1.1vw,14px)',
                        color:'#d4af37',fontWeight:700}}>
                        {fmt(rnd.prize_value||rnd.prize_inventory?.value)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: QR */}
          <div style={{width:'clamp(200px,25vw,340px)',flexShrink:0,
            borderLeft:'1px solid #d4af3722',
            background:'rgba(10,8,20,0.5)',
            display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
            padding:'24px',gap:'20px'}}>
            <div className="hp-deco" style={{textAlign:'center',letterSpacing:'3px',
              color:'#d4af37',fontSize:'clamp(11px,1.3vw,16px)'}}>
              📱 สแกนเพื่อเล่น
            </div>
            <div style={{padding:'18px',borderRadius:'8px',background:'rgba(245,230,200,0.95)',
              boxShadow:'0 0 60px #d4af3788,0 0 120px #d4af3733',
              animation:'borderGlow 2.5s ease-in-out infinite'}}>
              <QRCodeSVG value={playerUrl} size={Math.min(window.innerWidth*0.18,240)}/>
            </div>
            <div className="hp-font" style={{fontSize:'clamp(10px,1.2vw,14px)',
              color:'rgba(212,175,55,0.5)',textAlign:'center',letterSpacing:'1px'}}>
              {playerUrl}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ════ ACTIVE / ROUND_END ════ */
  const colColor = lastDrawn ? COL_COLOR[colOf(lastDrawn)] : '#d4af37';
  const activeRoundImg = getPrizeImage(activeRound);

  return (
    <div style={{minHeight:'100dvh',maxHeight:'100dvh',overflow:'hidden',position:'relative',
      background:'radial-gradient(ellipse at 15% 15%,#1a0a2e 0%,#0a0a1a 55%,#0d0800 100%)',
      fontFamily:"'Cinzel',serif",color:'#e8d5a3',
      display:'flex',flexDirection:'column',
    }}>
      <style>{STYLES}</style>
      <StarField/><Sparkles/>
      <div style={{position:'absolute',top:0,left:0,width:'35%',height:'45%',
        background:'radial-gradient(circle at top left,#4a0001,transparent 70%)',opacity:0.25,pointerEvents:'none'}}/>
      <div style={{position:'absolute',bottom:0,right:0,width:'35%',height:'45%',
        background:'radial-gradient(circle at bottom right,#1a472a,transparent 70%)',opacity:0.25,pointerEvents:'none'}}/>

      {/* ── Header ── */}
      <div style={{flexShrink:0,padding:'7px 20px',zIndex:10,
        background:'rgba(10,8,20,0.9)',backdropFilter:'blur(16px)',
        borderBottom:'1px solid #d4af3733',
        display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
          <span className="hp-deco gold-text" style={{fontSize:'clamp(12px,1.6vw,20px)',letterSpacing:'3px'}}>
            ✦ BINGO
          </span>
          <span style={{color:'#d4af3733'}}>|</span>
          <span className="hp-font" style={{fontSize:'clamp(13px,1.6vw,20px)',color:'#f5e6c8',fontWeight:700}}>
            {room?.name}
          </span>
          {room?.ticket_price>0 && (
            <div style={{padding:'3px 14px',borderRadius:'4px',
              background:'linear-gradient(135deg,#740001aa,#4a0001aa)',
              border:'1px solid #d4af3766',
              fontSize:'clamp(12px,1.4vw,18px)',fontWeight:700,color:'#d4af37',fontFamily:"'Cinzel',serif"}}>
              🪙 {fmt(room.ticket_price)} / ใบ
            </div>
          )}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          {activeRound?.is_golden && (
            <div style={{padding:'3px 14px',borderRadius:'4px',fontWeight:800,
              background:'linear-gradient(90deg,#d4af37,#f59e0b)',color:'#1a0a2e',
              fontSize:'clamp(11px,1.3vw,16px)',animation:'candleFlicker 1s infinite',fontFamily:"'Cinzel',serif"}}>
              ⚡ รอบนาทีทอง!
            </div>
          )}
          <div style={{padding:'3px 14px',borderRadius:'4px',
            background:'rgba(212,175,55,0.1)',border:'1px solid #d4af3744',
            fontSize:'clamp(11px,1.3vw,15px)',color:'#d4af37',fontFamily:"'Cinzel',serif"}}>
            รอบ {activeRoundIdx+1}/{rounds.length} — {PATTERN_LABEL[activeRound?.pattern]||activeRound?.pattern}
          </div>
          <div style={{fontSize:'clamp(13px,1.6vw,20px)',color:'rgba(245,230,200,0.4)',fontFamily:"'Cinzel',serif"}}>
            <span style={{color:'#c084fc',fontWeight:700,fontSize:'clamp(16px,2vw,24px)'}}>{drawn.length}</span>
            <span style={{fontSize:'11px'}}>/75</span>
          </div>
          {playerCount>0 && (
            <div style={{padding:'3px 12px',borderRadius:'4px',
              background:'rgba(26,71,42,0.4)',border:'1px solid #2a623d66',
              color:'#34d399',fontSize:'clamp(11px,1.3vw,14px)',fontFamily:"'Cinzel',serif"}}>
              👥 {playerCount}
            </div>
          )}
          <button onClick={()=>setShowPicker(true)}
            style={{padding:'3px 10px',borderRadius:'4px',border:'1px solid #d4af3733',
              background:'transparent',color:'rgba(212,175,55,0.35)',cursor:'pointer',
              fontSize:'11px',fontFamily:"'Cinzel',serif"}}>
            ✦ เปลี่ยนห้อง
          </button>
        </div>
      </div>

      {/* ── Main 3-column body ── */}
      <div style={{flex:1,display:'flex',minHeight:0,zIndex:5,position:'relative'}}>

        {/* ═══ LEFT: All Prizes ═══ */}
        <div style={{width:'clamp(180px,21vw,300px)',flexShrink:0,
          borderRight:'1px solid #d4af3722',
          background:'rgba(10,8,20,0.6)',backdropFilter:'blur(12px)',
          overflowY:'auto',padding:'12px 10px',
          display:'flex',flexDirection:'column',gap:'8px'}}>
          <div className="hp-deco" style={{textAlign:'center',letterSpacing:'3px',
            color:'#d4af37',fontSize:'clamp(10px,1.1vw,14px)',marginBottom:'2px'}}>
            ✦ ของรางวัล ✦
          </div>
          <Divider/>
          {rounds.map((rnd,i)=>{
            const isActive = rnd.id===activeRound?.id;
            const isDone   = rnd.status==='finished';
            const img      = getPrizeImage(rnd);
            const prizeName = rnd.prize||rnd.prize_inventory?.name||'';
            return (
              <div key={rnd.id} style={{
                borderRadius:'6px',padding:'10px',
                background:isActive?'linear-gradient(135deg,rgba(116,0,1,0.35),rgba(74,0,1,0.3))'
                  : isDone?'rgba(255,255,255,0.02)':'rgba(212,175,55,0.05)',
                border:`1px solid ${isActive?'#d4af3777':isDone?'#ffffff11':'#d4af3733'}`,
                animation:isActive?'houseGlow 2.5s ease-in-out infinite':'none',
                opacity:isDone?0.4:1,
                transition:'all 0.3s',
              }}>
                {/* Prize image */}
                {img && (
                  <img src={img} alt={prizeName}
                    style={{width:'100%',height:'clamp(70px,10vw,130px)',objectFit:'contain',
                      borderRadius:'4px',marginBottom:'8px',
                      filter:isActive?'drop-shadow(0 0 12px rgba(212,175,55,0.5))':'none',
                      animation:isActive?`prizeFloat 3s ease-in-out infinite`:'none'}}
                    onError={e=>e.target.style.display='none'}/>
                )}
                {!img && (
                  <div style={{fontSize:'clamp(24px,3.5vw,44px)',textAlign:'center',
                    marginBottom:'6px',filter:isActive?'drop-shadow(0 0 8px #d4af37)':'none',
                    animation:isActive?`prizeFloat 3s ease-in-out infinite`:'none'}}>
                    🎁
                  </div>
                )}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'3px'}}>
                  <span className="hp-font" style={{
                    fontSize:'clamp(9px,1vw,13px)',
                    color:isActive?'#d4af37':'rgba(245,230,200,0.4)',fontWeight:700,
                  }}>
                    รอบ {rnd.round_number} {rnd.is_golden?'⚡':''}
                    {isDone&&<span style={{color:'#34d399',marginLeft:'4px'}}>✓</span>}
                  </span>
                  <span style={{fontSize:'clamp(8px,0.9vw,11px)',color:'rgba(245,230,200,0.25)'}}>
                    {PATTERN_LABEL[rnd.pattern]||rnd.pattern}
                  </span>
                </div>
                {prizeName && (
                  <div style={{fontSize:'clamp(10px,1.1vw,15px)',fontWeight:700,
                    color:isActive?'#f5e6c8':'rgba(245,230,200,0.5)',lineHeight:1.3}}>
                    {prizeName}
                  </div>
                )}
                {(rnd.prize_value||rnd.prize_inventory?.value)>0 && (
                  <div style={{fontSize:'clamp(9px,1vw,13px)',color:'#d4af37',fontWeight:700,marginTop:'2px'}}>
                    {fmt(rnd.prize_value||rnd.prize_inventory?.value)}
                  </div>
                )}
                {isActive && (
                  <div style={{marginTop:'5px',padding:'2px 8px',borderRadius:'3px',
                    display:'inline-block',
                    background:'rgba(212,175,55,0.15)',border:'1px solid #d4af3744',
                    fontSize:'clamp(8px,0.9vw,11px)',color:'#d4af37',letterSpacing:'1px',fontFamily:"'Cinzel',serif"}}>
                    ✦ รอบนี้กำลังเล่น
                  </div>
                )}
              </div>
            );
          })}
          <Divider/>
          {/* Small QR */}
          <div style={{textAlign:'center',padding:'6px 0'}}>
            <div className="hp-font" style={{fontSize:'clamp(8px,0.9vw,11px)',color:'#d4af3788',
              letterSpacing:'2px',marginBottom:'6px'}}>สแกนเพื่อเล่น</div>
            <div style={{display:'inline-block',padding:'6px',borderRadius:'4px',
              background:'rgba(245,230,200,0.9)',boxShadow:'0 0 18px #d4af3755'}}>
              <QRCodeSVG value={playerUrl} size={Math.min(window.innerWidth*0.08,90)}/>
            </div>
          </div>
        </div>

        {/* ═══ CENTER: Big drawn number ═══ */}
        <div style={{flex:1,display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',gap:'14px',
          padding:'16px',minWidth:0}}>

          {phase==='round_end' && (
            <div style={{padding:'10px 32px',borderRadius:'4px',textAlign:'center',
              background:'rgba(212,175,55,0.1)',border:'1px solid #d4af3766',
              animation:'borderGlow 1.2s ease-in-out infinite'}}>
              <div className="hp-deco" style={{fontSize:'clamp(16px,2.2vw,30px)',color:'#d4af37',fontWeight:700}}>
                🏁 จบรอบนี้แล้ว
              </div>
            </div>
          )}

          {/* Active round prize image (center) */}
          {activeRoundImg && phase!=='round_end' && (
            <div style={{textAlign:'center',opacity:0.18,position:'absolute',
              top:'50%',left:'50%',transform:'translate(-50%,-50%)',
              width:'clamp(150px,20vw,280px)',pointerEvents:'none',zIndex:0}}>
              <img src={activeRoundImg} alt=""
                style={{width:'100%',objectFit:'contain',filter:'blur(2px)'}}
                onError={e=>e.target.style.display='none'}/>
            </div>
          )}

          {lastDrawn ? (
            <div key={animKey} style={{textAlign:'center',zIndex:2,
              animation:'spellReveal 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards'}}>
              <div style={{fontFamily:"'Cinzel Decorative',serif",
                fontSize:'clamp(60px,10vw,140px)',fontWeight:900,lineHeight:0.85,
                color:colColor,textShadow:`0 0 60px ${colColor}aa,0 0 120px ${colColor}44`}}>
                {colOf(lastDrawn)}
              </div>
              <div style={{width:'3px',height:'clamp(36px,5vw,70px)',
                background:`linear-gradient(to bottom,transparent,${colColor},transparent)`,margin:'5px auto'}}/>
              <div style={{fontFamily:"'Cinzel',serif",
                fontSize:'clamp(90px,16vw,220px)',fontWeight:900,lineHeight:0.85,
                color:'#f5e6c8',
                textShadow:`0 0 80px ${colColor}88,0 0 160px ${colColor}33,0 6px 40px rgba(0,0,0,0.6)`}}>
                {lastDrawn}
              </div>
              <div style={{marginTop:'10px',fontFamily:"'Cinzel',serif",
                fontSize:'clamp(10px,1.4vw,17px)',
                color:'rgba(245,230,200,0.3)',letterSpacing:'4px',textTransform:'uppercase'}}>
                Numerus Extractus
              </div>
            </div>
          ) : (
            <div style={{textAlign:'center',zIndex:2}}>
              <div className="hp-deco" style={{fontSize:'clamp(22px,3.5vw,50px)',
                color:'rgba(212,175,55,0.3)',animation:'goldGlow 2s ease-in-out infinite'}}>
                {phase==='active'?'✦ Expectans... ✦':'✦ Parans... ✦'}
              </div>
            </div>
          )}

          {/* Winners */}
          {winners.length>0 && (
            <div style={{textAlign:'center',padding:'12px 24px',borderRadius:'4px',zIndex:3,
              background:'linear-gradient(135deg,rgba(116,0,1,0.3),rgba(212,175,55,0.15))',
              border:'1px solid #d4af3766',
              animation:'winnerPop 0.5s ease,houseGlow 2s ease-in-out infinite'}}>
              <div className="hp-deco" style={{color:'#d4af37',
                fontSize:'clamp(13px,1.7vw,22px)',marginBottom:'8px',letterSpacing:'3px'}}>
                🏆 Vincitor!
              </div>
              <div style={{display:'flex',gap:'10px',flexWrap:'wrap',justifyContent:'center'}}>
                {winners.map((w,i)=>(
                  <span key={i} className="hp-font" style={{
                    padding:'5px 16px',borderRadius:'3px',fontWeight:700,
                    fontSize:'clamp(14px,2vw,24px)',
                    background:'rgba(212,175,55,0.2)',border:'1px solid #d4af3766',color:'#ffd700'}}>
                    ✦ {w.alias}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ RIGHT: B/I/N/G/O grid ═══ */}
        <div style={{width:'clamp(180px,21vw,320px)',flexShrink:0,
          borderLeft:'1px solid #d4af3722',
          background:'rgba(10,8,20,0.6)',backdropFilter:'blur(12px)',
          overflowY:'auto',padding:'12px 8px'}}>
          <div className="hp-deco" style={{textAlign:'center',letterSpacing:'3px',
            color:'#d4af37',fontSize:'clamp(10px,1.1vw,14px)',marginBottom:'6px'}}>
            ✦ Numeri Extracti ✦
          </div>
          <Divider/>
          <div style={{display:'flex',gap:'4px',marginTop:'8px',height:'calc(100% - 50px)'}}>
            {BINGO_COL.map(col=>{
              const [lo,hi]=COL_RANGE[col];
              const all=Array.from({length:hi-lo+1},(_,i)=>lo+i);
              return (
                <div key={col} style={{flex:1,display:'flex',flexDirection:'column',gap:'2px'}}>
                  <div style={{textAlign:'center',fontFamily:"'Cinzel Decorative',serif",
                    fontSize:'clamp(13px,1.7vw,22px)',fontWeight:900,
                    color:COL_COLOR[col],textShadow:`0 0 20px ${COL_COLOR[col]}88`,
                    padding:'3px 0',marginBottom:'3px',
                    borderBottom:`2px solid ${COL_COLOR[col]}44`}}>{col}</div>
                  {all.map(n=>{
                    const isDrawn =drawn.includes(n);
                    const isLatest=n===lastDrawn;
                    return (
                      <div key={n} style={{
                        textAlign:'center',padding:'clamp(2px,0.3vw,5px) 2px',borderRadius:'2px',
                        fontFamily:"'Cinzel',serif",fontWeight:isDrawn?800:500,
                        fontSize:'clamp(9px,1.1vw,15px)',
                        background:isLatest?COL_COLOR[col]:isDrawn?`${COL_COLOR[col]}22`:'transparent',
                        color:isLatest?'#0a0a1a':isDrawn?COL_COLOR[col]:'rgba(245,230,200,0.15)',
                        border:`1px solid ${isDrawn?COL_COLOR[col]+'44':'transparent'}`,
                        transition:'all 0.25s',
                        boxShadow:isLatest?`0 0 10px ${COL_COLOR[col]}`:'none',
                      }}>{n}</div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom ticker ── */}
      {drawn.length>0 && (
        <div style={{flexShrink:0,borderTop:'1px solid #d4af3722',
          background:'rgba(10,8,20,0.85)',backdropFilter:'blur(12px)',
          padding:'6px 0',overflow:'hidden',zIndex:10}}>
          <div style={{display:'flex',gap:'8px',alignItems:'center',
            animation:`ticker ${Math.max(drawn.length*2,14)}s linear infinite`,
            width:'max-content'}}>
            {[...drawn,...drawn].map((n,i)=>{
              const c=colOf(n);
              return (
                <span key={i} style={{
                  display:'inline-flex',alignItems:'center',gap:'3px',
                  padding:'3px 12px',borderRadius:'3px',whiteSpace:'nowrap',
                  fontFamily:"'Cinzel',serif",fontWeight:700,
                  fontSize:'clamp(10px,1.3vw,15px)',
                  background:n===lastDrawn&&i<drawn.length?COL_COLOR[c]:`${COL_COLOR[c]}18`,
                  color:n===lastDrawn&&i<drawn.length?'#0a0a1a':COL_COLOR[c],
                  border:`1px solid ${COL_COLOR[c]}44`,
                  boxShadow:n===lastDrawn&&i<drawn.length?`0 0 10px ${COL_COLOR[c]}`:'none',
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
