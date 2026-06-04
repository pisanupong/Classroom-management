import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/* ══════════════════════════════════════════════════
   AUDIO ENGINE
══════════════════════════════════════════════════ */
const AudioCtx = typeof window !== 'undefined' ? new (window.AudioContext || window.webkitAudioContext)() : null;
const beep = (freq, dur, type = 'square', vol = 0.18, delay = 0) => {
  if (!AudioCtx) return;
  const osc = AudioCtx.createOscillator();
  const gain = AudioCtx.createGain();
  osc.connect(gain); gain.connect(AudioCtx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, AudioCtx.currentTime + delay);
  gain.gain.setValueAtTime(vol, AudioCtx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, AudioCtx.currentTime + delay + dur);
  osc.start(AudioCtx.currentTime + delay);
  osc.stop(AudioCtx.currentTime + delay + dur + 0.05);
};
const sfxRankUp = () => { [523,659,784,1047].forEach((f,i) => beep(f,0.07,undefined,0.14,i*0.07)); };
const sfxSlide  = () => { [400,320,220,160].forEach((f,i) => beep(f,0.08,'sawtooth',0.12,i*0.06)); };
const sfxCoin   = () => { beep(988,0.04); beep(1319,0.1,undefined,undefined,0.05); };
const sfxPop    = () => { beep(880,0.06); beep(1320,0.08,undefined,undefined,0.07); };

/* ══════════════════════════════════════════════════
   SPRITE SYSTEM
══════════════════════════════════════════════════ */
const SKIN  = '#F8C090';
const SHOES = '#202020';
const WHITE = '#F0F0F0';
const UNI = [
  { body:'#1C3D7A', pants:'#141428', hair:'#1A0800' },
  { body:'#1C3D7A', pants:'#1C3D7A', hair:'#0A0606', skirt:true },
  { body:'#2B2B4A', pants:'#121220', hair:'#3C1800' },
  { body:'#1C3D7A', pants:'#1C3D7A', hair:'#5C2800', skirt:true },
  { body:'#1A4C2A', pants:'#141414', hair:'#0A0808' },
  { body:'#1C3D7A', pants:'#1C3D7A', hair:'#8A2800', skirt:true },
  { body:'#3A5C8E', pants:'#222230', hair:'#D0A050' },
  { body:'#1C3D7A', pants:'#1C3D7A', hair:'#080606', skirt:true },
  { body:'#4A2870', pants:'#1C1C30', hair:'#1A0A00' },
  { body:'#1C3D7A', pants:'#1C3D7A', hair:'#483018', skirt:true },
];

function buildSprite(u, frame) {
  const px = [];
  const p = (x, y, c) => px.push({ x, y, c });
  [[6,0],[7,0],[8,0],[9,0]].forEach(([x,y])=>p(x,y,u.hair));
  [[5,1],[6,1],[9,1],[10,1]].forEach(([x,y])=>p(x,y,u.hair));
  for(let x=5;x<=10;x++) for(let y=2;y<=5;y++) p(x,y,SKIN);
  p(5,1,u.hair); p(10,1,u.hair);
  p(6,3,'#202020'); p(9,3,'#202020');
  p(7,5,'#C06060'); p(8,5,'#C06060');
  p(7,6,SKIN); p(8,6,SKIN);
  for(let x=5;x<=10;x++) for(let y=7;y<=11;y++) p(x,y,u.body);
  p(7,7,WHITE); p(8,7,WHITE);
  p(7,9,'#888'); p(7,10,'#888');
  if (frame === 0) {
    for(let y=12;y<=16;y++){ p(5,y,u.pants); p(6,y,u.pants); p(9,y,u.pants); p(10,y,u.pants); }
    for(let x=5;x<=6;x++) p(x,17,SHOES);
    for(let x=9;x<=10;x++) p(x,17,SHOES);
    for(let y=8;y<=11;y++) p(4,y,SKIN);
    for(let y=8;y<=11;y++) p(11,y,SKIN);
  } else if (frame === 1) {
    for(let y=12;y<=15;y++) p(5,y,u.pants);
    for(let y=12;y<=15;y++) p(6,y,u.pants);
    for(let y=13;y<=17;y++) p(9,y,u.pants);
    for(let y=13;y<=17;y++) p(10,y,u.pants);
    p(5,16,u.pants); p(6,16,u.pants);
    p(5,17,SHOES); p(6,17,SHOES);
    p(9,18,SHOES); p(10,18,SHOES);
    p(12,7,SKIN); p(13,6,SKIN); p(13,5,SKIN); p(13,4,SKIN);
    p(4,9,SKIN); p(4,10,SKIN); p(3,11,SKIN);
  } else {
    for(let y=13;y<=17;y++) p(5,y,u.pants);
    for(let y=13;y<=17;y++) p(6,y,u.pants);
    for(let y=12;y<=15;y++) p(9,y,u.pants);
    for(let y=12;y<=15;y++) p(10,y,u.pants);
    p(9,16,u.pants); p(10,16,u.pants);
    p(5,18,SHOES); p(6,18,SHOES);
    p(9,17,SHOES); p(10,17,SHOES);
    p(3,7,SKIN); p(2,6,SKIN); p(2,5,SKIN); p(2,4,SKIN);
    p(11,9,SKIN); p(11,10,SKIN); p(12,11,SKIN);
  }
  if (u.skirt) {
    for(let x=4;x<=11;x++) p(x,11,u.pants);
    for(let x=4;x<=11;x++) p(x,12,u.body);
  }
  return px;
}

const SpriteView = ({ uniIdx, frame, customGrid, scale = 5, filter = 'none' }) => {
  if (customGrid) {
    const CW = customGrid.length === 32*48 ? 32 : 16;
    const CH = customGrid.length === 32*48 ? 48 : 24;
    const S = scale;
    return (
      <svg width={CW*S} height={CH*S} style={{ imageRendering:'pixelated', display:'block', filter }}>
        {customGrid.map((c, i) => {
          if (!c) return null;
          const x = i % CW, y = Math.floor(i / CW);
          return <rect key={i} x={x*S} y={y*S} width={S} height={S} fill={c} />;
        })}
      </svg>
    );
  }
  const u = UNI[uniIdx % UNI.length];
  const px = buildSprite(u, frame);
  const W = 16, H = 20, S = scale;
  return (
    <svg width={W*S} height={H*S} viewBox={`0 0 ${W} ${H}`}
      style={{ imageRendering:'pixelated', display:'block', filter }}>
      {px.map((p, i) => <rect key={i} x={p.x} y={p.y} width={1} height={1} fill={p.c} />)}
    </svg>
  );
};

/* ══════════════════════════════════════════════════
   FIRE PARTICLES (pre-seeded, no Math.random in render)
══════════════════════════════════════════════════ */
const SPARKS = Array.from({length:16}, (_, i) => ({
  x:   5 + (i * 43 % 90),
  dur: 0.45 + (i * 0.09 % 0.55),
  del: (i * 0.11) % 0.8,
  sz:  4 + (i * 7 % 8),
  col: ['#ff3300','#ff6600','#ff9900','#ffcc00','#ff4400'][i % 5],
}));

const FireParticles = () => (
  <div style={{position:'absolute', bottom:'100%', left:'50%', transform:'translateX(-50%)',
    width:100, height:60, pointerEvents:'none', overflow:'visible'}}>
    {SPARKS.map((s,i) => (
      <div key={i} style={{
        position:'absolute', bottom:0, left:`${s.x}%`,
        width:s.sz, height:s.sz, borderRadius:'50%', background:s.col,
        animation:`spark ${s.dur}s ease-out ${s.del}s infinite`,
      }}/>
    ))}
  </div>
);

/* ══════════════════════════════════════════════════
   SPEECH BUBBLE
══════════════════════════════════════════════════ */
const MSGS = {
  rank1:    ['ตามมาให้ทันซี่~', 'บัลลังก์นี้ของฉัน!', 'ผมไม่มีคู่แข่ง 😌'],
  rankUp:   ['เย้! ขึ้นอันดับแล้ว! 🎉', 'ก้าวต่อไป! 💪', 'ไม่มีใครหยุดได้!'],
  rankDown: ['ฝากไว้ก่อนเถอะ!', 'แค่พักสักครู่...', 'โอย~ 😵'],
  onFire:   ['ติดสปีดแล้ว!! 🔥', 'ฉันลุกไหม้แล้ว!', 'ใครจะหยุดฉันได้?'],
  normal:   ['สู้ๆ นะ! 💪', 'วันนี้ขยันไหมเนี่ย?', 'เดี๋ยวก็ขึ้นอันดับเอง~'],
};
const pickMsg = (state, id) => {
  const arr = MSGS[state] || MSGS.normal;
  return arr[id % arr.length];
};

const SpeechBubble = ({ text }) => (
  <div style={{
    position:'absolute', bottom:'108%', left:'50%', transform:'translateX(-50%)',
    background:'#fffbe6', border:'2px solid #c8900a',
    borderRadius:10, padding:'7px 13px', whiteSpace:'nowrap',
    zIndex:300, pointerEvents:'none',
    fontFamily:'"Press Start 2P",monospace', fontSize:9, color:'#333',
    boxShadow:'3px 5px 12px rgba(0,0,0,0.4)',
    animation:'bubblePop 0.25s cubic-bezier(0.34,1.56,0.64,1)',
  }}>
    {text}
    <div style={{position:'absolute',bottom:-10,left:'50%',transform:'translateX(-50%)',
      borderLeft:'9px solid transparent',borderRight:'9px solid transparent',borderTop:'10px solid #c8900a'}}/>
    <div style={{position:'absolute',bottom:-7,left:'50%',transform:'translateX(-50%)',
      borderLeft:'7px solid transparent',borderRight:'7px solid transparent',borderTop:'9px solid #fffbe6'}}/>
  </div>
);

/* ══════════════════════════════════════════════════
   HISTORY GRAPH — 7-day SVG pop-up
══════════════════════════════════════════════════ */
const HistoryGraph = ({ player, onClose }) => {
  const days = ['จ','อ','พ','พฤ','ศ','ส','อา'];
  const pts = player.total_points;
  const history = days.map((d, i) => {
    const ratio = 0.3 + (((i * 7919 + player.id * 1009) % 100) / 140);
    return { day: d, pts: Math.round(pts * ratio * (i === 6 ? 1 : 1)) };
  });
  history[6] = { day:'อา', pts };
  const maxH = Math.max(...history.map(h=>h.pts), 1);
  const W=280, H=110, P=22;
  const pts2 = history.map((h,i)=>{
    const x = P + (i/(history.length-1))*(W-P*2);
    const y = H - P - (h.pts/maxH)*(H-P*2);
    return [x, y];
  });
  const polyline = pts2.map(([x,y])=>`${x},${y}`).join(' ');
  const area = [...pts2, [pts2[pts2.length-1][0], H-P], [pts2[0][0], H-P]].map(([x,y])=>`${x},${y}`).join(' ');

  return (
    <div style={{position:'fixed',inset:0,zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',
      background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)'}}
      onClick={onClose}>
      <div style={{background:'#080818',border:'2px solid #5050ff',borderRadius:14,padding:24,minWidth:340}}
        onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:10,color:'#ffe000',textAlign:'center',marginBottom:14}}>
          📊 {player.name.split(' ')[0]} — 7 วัน
        </div>
        <svg width={W} height={H} style={{display:'block',margin:'0 auto'}}>
          {[0,0.25,0.5,0.75,1].map((r,i)=>(
            <line key={i} x1={P} y1={P+r*(H-P*2)} x2={W-P} y2={P+r*(H-P*2)}
              stroke="#1a1a3a" strokeWidth={1}/>
          ))}
          <polygon points={area} fill="rgba(124,58,237,0.2)"/>
          <polyline points={polyline} fill="none" stroke="#a78bfa" strokeWidth={2.5} strokeLinejoin="round"/>
          {pts2.map(([x,y],i)=>(
            <g key={i}>
              <circle cx={x} cy={y} r={i===6?6:4} fill={i===6?'#ffe000':'#7c3aed'} stroke="#fff" strokeWidth={1.5}/>
              <text x={x} y={H-4} textAnchor="middle" fill="#505080" fontSize={7}
                fontFamily='"Press Start 2P",monospace'>{history[i].day}</text>
              {i===6&&<text x={x} y={y-10} textAnchor="middle" fill="#ffe000" fontSize={7}
                fontFamily='"Press Start 2P",monospace'>{history[i].pts}</text>}
            </g>
          ))}
        </svg>
        <div style={{textAlign:'center',marginTop:8,fontFamily:'"Press Start 2P",monospace',fontSize:8,color:'#606080'}}>
          คะแนนปัจจุบัน: <span style={{color:'#00e870'}}>{pts} PT</span>
        </div>
        <button onClick={onClose} style={{marginTop:14,width:'100%',padding:'8px',
          fontFamily:'"Press Start 2P",monospace',fontSize:9,background:'#c00',border:'none',
          color:'#fff',cursor:'pointer',borderRadius:6}}>✕ CLOSE</button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   CARTOON CLIFF BACKGROUND
══════════════════════════════════════════════════ */
const CliffBackground = () => (
  <div style={{position:'absolute',inset:0,overflow:'hidden'}}>
    {/* Sky */}
    <div style={{position:'absolute',inset:0,
      background:'linear-gradient(180deg,#4a9eda 0%,#87ceeb 35%,#b8e4f8 65%,#d8f2ff 100%)'}}/>

    {/* Sun glow */}
    <div style={{position:'absolute',top:'6%',left:'50%',transform:'translateX(-50%)',
      width:120,height:120,borderRadius:'50%',
      background:'radial-gradient(circle,rgba(255,248,180,0.7) 0%,rgba(255,220,80,0.3) 40%,transparent 70%)'}}/>

    {/* Cloud A */}
    <div style={{position:'absolute',top:'9%',left:'4%',animation:'cloudDrift 7s ease-in-out infinite alternate'}}>
      <div style={{position:'relative',width:130,height:50}}>
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:35,background:'rgba(255,255,255,0.92)',borderRadius:20}}/>
        <div style={{position:'absolute',bottom:18,left:15,width:55,height:40,background:'rgba(255,255,255,0.92)',borderRadius:20}}/>
        <div style={{position:'absolute',bottom:22,left:48,width:65,height:35,background:'rgba(255,255,255,0.92)',borderRadius:20}}/>
      </div>
    </div>
    {/* Cloud B */}
    <div style={{position:'absolute',top:'6%',right:'6%',animation:'cloudDrift 9s ease-in-out 2s infinite alternate-reverse'}}>
      <div style={{position:'relative',width:150,height:55}}>
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:38,background:'rgba(255,255,255,0.88)',borderRadius:22}}/>
        <div style={{position:'absolute',bottom:22,left:25,width:70,height:42,background:'rgba(255,255,255,0.88)',borderRadius:20}}/>
        <div style={{position:'absolute',bottom:30,left:55,width:55,height:32,background:'rgba(255,255,255,0.88)',borderRadius:18}}/>
      </div>
    </div>
    {/* Cloud C */}
    <div style={{position:'absolute',top:'18%',left:'30%',animation:'cloudDrift 11s ease-in-out 1s infinite alternate'}}>
      <div style={{position:'relative',width:100,height:40}}>
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:28,background:'rgba(255,255,255,0.75)',borderRadius:16}}/>
        <div style={{position:'absolute',bottom:14,left:20,width:50,height:30,background:'rgba(255,255,255,0.75)',borderRadius:16}}/>
      </div>
    </div>

    {/* Background mountain silhouettes */}
    <svg style={{position:'absolute',bottom:'22%',left:0,width:'100%',height:'52%'}} viewBox="0 0 800 300" preserveAspectRatio="none">
      <polygon points="0,300 80,60 160,300"  fill="#7a8fa0" opacity={0.45}/>
      <polygon points="120,300 260,30 400,300" fill="#6a7f90" opacity={0.5}/>
      <polygon points="350,300 490,55 630,300" fill="#8090a0" opacity={0.45}/>
      <polygon points="580,300 700,40 800,300" fill="#7080a0" opacity={0.5}/>
      <polygon points="200,300 310,80 420,300" fill="#aabbc0" opacity={0.3}/>
      {/* Mist */}
      <rect x="0" y="200" width="800" height="100" fill="rgba(190,215,235,0.4)"/>
    </svg>

    {/* Left cliff wall */}
    <div style={{position:'absolute',left:0,top:'8%',bottom:0,width:'18%',
      background:'linear-gradient(90deg,#5a4a2e 0%,#7a6040 55%,#9a7a52 100%)',
      clipPath:'polygon(0 0,100% 8%,100% 78%,75% 100%,0 100%)'}}>
      {[10,25,40,55,70,85].map((y,i)=>(
        <div key={i} style={{position:'absolute',top:`${y}%`,left:'30%',
          width:`${30+i%3*10}%`,height:2,background:'rgba(0,0,0,0.2)'}}/>
      ))}
      {/* Moss patches */}
      {[15,35,60,80].map((y,i)=>(
        <div key={i} style={{position:'absolute',top:`${y}%`,left:'55%',
          width:12,height:20+i*4,background:'#3a7020',borderRadius:'0 0 6px 6px',opacity:0.7}}/>
      ))}
    </div>

    {/* Right cliff wall */}
    <div style={{position:'absolute',right:0,top:'12%',bottom:0,width:'16%',
      background:'linear-gradient(270deg,#5a4a2e 0%,#7a6040 55%,#9a7a52 100%)',
      clipPath:'polygon(0 10%,100% 0,100% 100%,25% 100%,0 80%)'}}>
      {[12,28,44,60,76].map((y,i)=>(
        <div key={i} style={{position:'absolute',top:`${y}%`,right:'25%',
          width:`${25+i%3*8}%`,height:2,background:'rgba(0,0,0,0.18)'}}/>
      ))}
    </div>

    {/* Stone staircase path */}
    <svg style={{position:'absolute',inset:0,width:'100%',height:'100%'}} viewBox="0 0 400 900" preserveAspectRatio="none">
      {Array.from({length:22},(_,i)=>{
        const y = 840 - i*35;
        const x = i%2===0 ? 105 : 215;
        return <rect key={i} x={x} y={y} width={75} height={9} rx={3}
          fill="rgba(165,145,105,0.65)" stroke="rgba(100,80,40,0.5)" strokeWidth={1}/>;
      })}
      {/* Connecting path */}
      {Array.from({length:22},(_,i)=>{
        if(i===0) return null;
        const y1=840-(i-1)*35+(i%2===0?0:9);
        const x1=i%2===0?180:260;
        const y2=840-i*35;
        const x2=i%2===0?105:215;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="rgba(140,115,75,0.5)" strokeWidth={5}/>;
      })}
    </svg>

    {/* Castle tower at top */}
    <div style={{position:'absolute',top:'0%',left:'50%',transform:'translateX(-50%)',zIndex:10,
      display:'flex',flexDirection:'column',alignItems:'center'}}>
      {/* Trophy flag */}
      <div style={{fontSize:32,filter:'drop-shadow(0 0 10px gold) drop-shadow(0 0 20px orange)',
        animation:'crownGlow 2s ease-in-out infinite',marginBottom:-4}}>🏆</div>
      {/* Battlements */}
      <div style={{display:'flex',gap:2}}>
        {[0,1,2,3,4].map(i=>(
          <div key={i} style={{width:14,height:18,background:'#8a7a5e',border:'2px solid #6a5a3a',
            boxShadow:'inset 1px 1px 0 rgba(255,255,255,0.15)'}}/>
        ))}
      </div>
      {/* Tower body */}
      <div style={{width:72,background:'#9a8a6a',border:'3px solid #6a5a3a',
        boxShadow:'inset 2px 0 0 rgba(255,255,255,0.1),-2px 0 0 rgba(0,0,0,0.2)',height:55,position:'relative'}}>
        <div style={{position:'absolute',top:8,left:8,width:14,height:18,background:'#1a0808',
          boxShadow:'inset 1px 1px 3px rgba(255,180,0,0.3)'}}/>
        <div style={{position:'absolute',top:8,right:8,width:14,height:18,background:'#1a0808',
          boxShadow:'inset 1px 1px 3px rgba(255,180,0,0.3)'}}/>
        <div style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',
          width:18,height:22,background:'#2a1808'}}/>
      </div>
    </div>

    {/* Rock ledge platforms (decorative) */}
    {[20,38,55,72].map((top,i)=>(
      <div key={i} style={{position:'absolute',top:`${top}%`,left:`${i%2===0?'14%':'68%'}`,
        width:'18%',height:10,
        background:'linear-gradient(180deg,#7a6040 0%,#5a4020 100%)',
        borderRadius:'0 0 4px 4px',boxShadow:'0 4px 8px rgba(0,0,0,0.5)',zIndex:3}}>
        {/* Moss */}
        <div style={{position:'absolute',top:-4,left:'20%',width:'60%',height:6,
          background:'#3a7020',borderRadius:3,opacity:0.8}}/>
      </div>
    ))}

    {/* Bottom vegetation */}
    <div style={{position:'absolute',bottom:0,left:0,right:0,height:'15%',
      background:'linear-gradient(180deg,rgba(50,110,30,0.9) 0%,#1a4a0a 100%)',zIndex:4}}>
      {[3,9,17,25,35,47,55,63,73,82,90,97].map((x,i)=>(
        <div key={i} style={{position:'absolute',bottom:0,left:`${x}%`,
          width:i%3===0?28:18,height:i%3===0?55:38,
          background:i%4===0?'#1a5a08':'#2a6a12',
          clipPath:'polygon(50% 0%,100% 100%,0% 100%)',opacity:0.85}}/>
      ))}
      {/* Ground rocks */}
      {[8,22,40,60,78,92].map((x,i)=>(
        <div key={i} style={{position:'absolute',bottom:2,left:`${x}%`,
          width:14+i%3*8,height:10+i%3*4,
          background:'#5a4a30',borderRadius:'50% 50% 40% 40%',opacity:0.7}}/>
      ))}
    </div>

    {/* Atmospheric overlay */}
    <div style={{position:'absolute',inset:0,background:'rgba(0,15,35,0.22)'}}/>
  </div>
);

/* ══════════════════════════════════════════════════
   CHARACTER CARD  (on-cliff character unit)
══════════════════════════════════════════════════ */
const CHAR_STATE_MSGS = (state, id) => pickMsg(state, id);

const CharacterCard = ({ player, rank, total, state, isHotStreak, bubbleVisible, onBubbleDismiss, onClickChar, onClickHistory }) => {
  const topPct  = total <= 1 ? 50 : 10 + (rank / (total - 1)) * 72;
  const leftPct = rank % 2 === 0 ? 28 : 72; // สลับซ้าย-ขวา
  const flipX   = rank % 2 === 0;            // หันเข้าหากัน
  const uniIdx = (player.id || rank) % UNI.length;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f+1)%3), 280 + rank * 17);
    return () => clearInterval(t);
  }, [rank]);

  const spriteFilter = isHotStreak
    ? 'drop-shadow(0 0 8px #ff6600) drop-shadow(0 0 16px #ff4400)'
    : state === 'rank1'
    ? 'drop-shadow(0 0 6px #ffe000) drop-shadow(0 0 12px #ffaa00)'
    : 'none';

  return (
    <div style={{
      position:'absolute', left:`${leftPct}%`, top:`${topPct}%`,
      transform:'translate(-50%, -50%)',
      transition:'top 1.8s cubic-bezier(0.34,1.2,0.64,1)',
      zIndex: 50 - rank,
      display:'flex', flexDirection:'column', alignItems:'center',
    }}>
      {/* On fire glow ring */}
      {isHotStreak && (
        <div style={{position:'absolute',inset:-12,borderRadius:'50%',
          animation:'fireGlow 0.8s ease-in-out infinite',zIndex:-1}}/>
      )}
      {/* Fire particles */}
      {isHotStreak && <FireParticles />}

      {/* Crown for rank 1 */}
      {state === 'rank1' && (
        <div style={{fontSize:26,animation:'crownGlow 1.8s ease-in-out infinite',lineHeight:1,marginBottom:2}}>👑</div>
      )}

      {/* ON FIRE badge */}
      {isHotStreak && (
        <div style={{
          fontFamily:'"Press Start 2P",monospace', fontSize:7,
          color:'#fff', background:'linear-gradient(90deg,#ff3300,#ff8800)',
          padding:'3px 7px', borderRadius:4, marginBottom:3,
          boxShadow:'0 0 10px #ff6600', animation:'blink 0.7s infinite',
        }}>🔥 ON FIRE</div>
      )}

      {/* Speech bubble */}
      {bubbleVisible && <SpeechBubble text={bubbleVisible}/>}

      {/* Name + score chip */}
      <div
        onClick={() => onClickHistory(player)}
        style={{
          background:'rgba(0,8,40,0.92)', border:'2px solid #4060e0',
          padding:'5px 10px', marginBottom:4, cursor:'pointer',
          boxShadow:'0 0 8px rgba(64,96,224,0.5)', whiteSpace:'nowrap',
          transition:'transform 0.15s',
        }}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
      >
        <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:13,color:'#ffe000',lineHeight:1.4,
          textShadow:'0 0 8px #ffaa00',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis'}}>
          {player.name.split(' ')[0].slice(0,8)}
        </div>
        <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:11,color:'#00e870',
          textShadow:'0 0 5px #00ff50'}}>
          {player.total_points.toLocaleString()}
          <span style={{fontSize:8,color:'#008840',marginLeft:4}}>PT</span>
        </div>
      </div>

      {/* Sprite — clickable */}
      <div
        onClick={() => onClickChar(player, state)}
        style={{
          cursor:'pointer', transform: flipX ? 'scaleX(-1)' : 'none',
          animation: state==='rankUp' ? 'rankUpBounce 0.6s ease-out'
            : state==='rankDown' ? 'rankDownShake 0.5s ease-out'
            : state==='rank1' ? 'float 2.5s ease-in-out infinite'
            : 'none',
        }}
      >
        <SpriteView uniIdx={uniIdx} frame={frame}
          customGrid={player.character_data?.grid || null}
          scale={4.5} filter={spriteFilter}/>
      </div>

      {/* Rank badge */}
      <div style={{
        fontFamily:'"Press Start 2P",monospace', fontSize:10,
        color: rank===0?'#ffe000':rank===1?'#c0c0c0':rank===2?'#cd7f32':'#8080a0',
        marginTop:3,
        textShadow: rank<3 ? '0 0 6px currentColor' : 'none',
      }}>
        {rank===0?'🥇':rank===1?'🥈':rank===2?'🥉':`#${rank+1}`}
      </div>

      {/* Ledge platform */}
      <div style={{
        width:110, height:12, marginTop:2,
        background:'linear-gradient(180deg,#8a6a3a 0%,#5a4020 100%)',
        borderRadius:'0 0 6px 6px',
        boxShadow:'0 4px 10px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.08)',
      }}/>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   COMPACT RANK TABLE (side panel)
══════════════════════════════════════════════════ */
const RankTable = ({ players, prevRanks }) => (
  <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden'}}>
    <div style={{display:'grid',gridTemplateColumns:'50px 1fr 90px 30px',
      background:'#000080',borderBottom:'2px solid #4040ff',padding:'6px 8px',gap:4}}>
      {['RANK','STUDENT','SCORE','±'].map(h=>(
        <span key={h} style={{fontFamily:'"Press Start 2P",monospace',fontSize:9,color:'#ffe000',
          textAlign:h==='SCORE'||h==='±'?'center':'left'}}>{h}</span>
      ))}
    </div>
    <div style={{flex:1,overflowY:'auto'}}>
      {players.map((p,i)=>{
        const prev  = prevRanks[p.id];
        const moved = prev !== undefined ? prev - i : 0;
        const u     = UNI[i % UNI.length];
        return (
          <div key={p.id} style={{display:'grid',gridTemplateColumns:'50px 1fr 90px 30px',
            padding:'7px 8px',gap:4,alignItems:'center',
            background:i%2===0?'#060818':'#040610',borderBottom:'1px solid #101830'}}>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              {i<3
                ? <span style={{fontSize:18}}>{'🥇🥈🥉'[i]}</span>
                : <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:11,color:'#606080',width:22,textAlign:'center'}}>{i+1}</span>}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
              <div style={{width:13,height:13,borderRadius:'50%',background:u.hair,border:`2px solid ${SKIN}`,flexShrink:0}}/>
              <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:9,color:i<3?'#ffe000':'#b0b0d0',
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
            </div>
            <div style={{textAlign:'center'}}>
              <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:10,color:'#00e870'}}>{p.total_points}</span>
              <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#304830',marginLeft:3}}>PT</span>
            </div>
            <div style={{textAlign:'center',fontSize:16}}>
              {moved>0?<span style={{color:'#40ff40'}}>▲</span>
                :moved<0?<span style={{color:'#ff4040'}}>▼</span>
                :<span style={{color:'#404060'}}>—</span>}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

/* ══════════════════════════════════════════════════
   EVENT LOG
══════════════════════════════════════════════════ */
const BASE_EVENTS = [
  { text:'ระบบพร้อมใช้งาน ★ THE CLIMB — LEADERBOARD', color:'#ffe000' },
  { text:'คลิกตัวละครเพื่อให้พูด / คลิกชื่อเพื่อดูกราฟ', color:'#80c0ff' },
];

const EventLog = ({ players, prevPtsRef }) => {
  const [log, setLog] = useState(BASE_EVENTS);
  const endRef = useRef(null);
  useEffect(() => {
    players.forEach(p => {
      const old = prevPtsRef.current?.[p.id];
      if (old === undefined || old === p.total_points) return;
      const diff = p.total_points - old;
      setLog(l => [...l.slice(-9), {
        text: diff > 0 ? `[${p.name.split(' ')[0]}] ได้รับ +${diff} แต้ม 🎉` : `[${p.name.split(' ')[0]}] โดนตัด ${diff} แต้ม`,
        color: diff > 0 ? '#80ff80' : '#ff8080',
      }]);
      diff > 0 ? sfxPop() : sfxSlide();
    });
  }, [players]);
  useEffect(() => { endRef.current?.scrollIntoView({behavior:'smooth'}); }, [log]);
  return (
    <div style={{border:'2px solid #303060',background:'#000810',flexShrink:0}}>
      <div style={{background:'#000060',padding:'4px 8px',borderBottom:'2px solid #3030a0',
        display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#ffe000'}}>▶ EVENT LOG</span>
        <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:5,color:'#404080'}}>{log.length}</span>
      </div>
      <div style={{height:80,overflowY:'auto',padding:'4px 8px'}}>
        {log.map((e,i)=>(
          <div key={i} style={{display:'flex',gap:6,marginBottom:3,alignItems:'flex-start'}}>
            <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:5,color:'#303050',flexShrink:0}}>{String(i+1).padStart(2,'0')}.</span>
            <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:6,color:e.color,lineHeight:1.7}}>{e.text}</span>
          </div>
        ))}
        <div ref={endRef}/>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   MAIN LEADERBOARD
══════════════════════════════════════════════════ */
const Leaderboard = () => {
  const navigate = useNavigate();
  const [players, setPlayers]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [prevRanks, setPrevRanks]   = useState({});
  const [rankStates, setRankStates] = useState({}); // { id: 'rank1'|'rankUp'|'rankDown'|'normal' }
  const [hotStreak, setHotStreak]   = useState(null);
  const [bubbles, setBubbles]       = useState({}); // { id: text }
  const [history, setHistory]       = useState(null); // player for history graph
  const prevPtsRef = useRef({});
  const prevScores = useRef({});

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/leaderboard');
      const sorted = [...res.data].sort((a,b) => b.total_points - a.total_points);

      // Detect rank changes + hot streak
      setPlayers(prev => {
        const oldRanks = {};
        prev.forEach((p,i) => { oldRanks[p.id] = i; });
        setPrevRanks(oldRanks);

        const newStates = {};
        let maxGain = 0, hotId = null;

        sorted.forEach((p, i) => {
          const oldRank = oldRanks[p.id];
          const oldPts  = prevScores.current[p.id] ?? p.total_points;
          const gain    = p.total_points - oldPts;

          if (gain > maxGain) { maxGain = gain; hotId = p.id; }
          if (i === 0)        newStates[p.id] = 'rank1';
          else if (oldRank !== undefined && i < oldRank) { newStates[p.id] = 'rankUp'; sfxRankUp(); }
          else if (oldRank !== undefined && i > oldRank) { newStates[p.id] = 'rankDown'; sfxSlide(); }
          else newStates[p.id] = 'normal';

          prevScores.current[p.id] = p.total_points;
        });

        setRankStates(newStates);
        setHotStreak(hotId);
        return sorted;
      });
    } catch(err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15000);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleClickChar = (player, state) => {
    sfxPop();
    const msgState = hotStreak === player.id ? 'onFire'
      : state === 'rank1' ? 'rank1'
      : state === 'rankUp' ? 'rankUp'
      : state === 'rankDown' ? 'rankDown' : 'normal';
    const text = pickMsg(msgState, player.id);
    setBubbles(b => ({ ...b, [player.id]: text }));
    setTimeout(() => setBubbles(b => { const n={...b}; delete n[player.id]; return n; }), 3500);
  };

  return (
    <div style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:8px;height:8px;}
        ::-webkit-scrollbar-track{background:#000020;}
        ::-webkit-scrollbar-thumb{background:#303080;border-radius:4px;}
        ::-webkit-scrollbar-thumb:hover{background:#5050c0;}
        @keyframes glow{0%,100%{text-shadow:0 0 6px #ffe000}50%{text-shadow:0 0 18px #ffe000,0 0 32px #ff8000}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes ticker{from{transform:translateX(100vw)}to{transform:translateX(-100%)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes crownGlow{0%,100%{filter:drop-shadow(0 0 5px #ffe000) drop-shadow(0 0 10px #ff8800)}50%{filter:drop-shadow(0 0 14px #ffe000) drop-shadow(0 0 26px #ff6600) drop-shadow(0 0 40px #ffcc00)}}
        @keyframes fireGlow{0%,100%{box-shadow:0 0 15px 6px rgba(255,100,0,0.5)}50%{box-shadow:0 0 30px 14px rgba(255,50,0,0.7)}}
        @keyframes spark{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-55px) scale(0.2)}}
        @keyframes rankUpBounce{0%{transform:translateY(0) scale(1)}30%{transform:translateY(-28px) scale(1.18)}65%{transform:translateY(-14px) scale(1.08)}100%{transform:translateY(0) scale(1)}}
        @keyframes rankDownShake{0%{transform:translateX(0)}20%{transform:translateX(-10px) rotate(-4deg)}40%{transform:translateX(10px) rotate(4deg)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}100%{transform:translateX(0)}}
        @keyframes bubblePop{0%{transform:translate(-50%,0) scale(0);opacity:0}70%{transform:translate(-50%,0) scale(1.1)}100%{transform:translate(-50%,0) scale(1);opacity:1}}
        @keyframes cloudDrift{from{transform:translateX(-15px)}to{transform:translateX(15px)}}
      `}</style>

      {/* ── Top bar ── */}
      <div style={{position:'relative',zIndex:100,display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'6px 12px',background:'#000070',borderBottom:'3px solid #2020dd',
        boxShadow:'0 3px 0 #5050ff'}}>
        <button onClick={()=>navigate('/dashboard')}
          style={{fontFamily:'"Press Start 2P",monospace',fontSize:8,padding:'5px 10px',
            background:'#c00',border:'2px solid #800',color:'#fff',cursor:'pointer',boxShadow:'2px 2px 0 #400'}}>
          ◄ BACK
        </button>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:12,color:'#ffe000',
            animation:'glow 2s infinite',letterSpacing:3}}>⛰ THE CLIMB ⛰</div>
          <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:6,color:'#80c0ff',marginTop:2,
            animation:'blink 1.5s infinite'}}>CLASS CHAMPIONSHIP — REACH THE SUMMIT</div>
        </div>
        <button onClick={()=>{sfxCoin();fetchData();}}
          style={{fontFamily:'"Press Start 2P",monospace',fontSize:8,padding:'5px 10px',
            background:'#060',border:'2px solid #030',color:'#fff',cursor:'pointer',boxShadow:'2px 2px 0 #020'}}>
          ► UPDATE
        </button>
      </div>

      {/* ── Ticker ── */}
      <div style={{position:'relative',zIndex:100,overflow:'hidden',height:38,background:'#000',
        borderBottom:'2px solid #00c030',display:'flex',alignItems:'center'}}>
        <div style={{whiteSpace:'nowrap',animation:'ticker 30s linear infinite',display:'inline-block'}}>
          <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:14,color:'#00e040',
            textShadow:'0 0 10px #00ff40,0 0 20px #00aa20'}}>
            {'　'.repeat(2)}
            {players.slice(0,3).map((p,i)=>`${['★ 1ST','★ 2ND','★ 3RD'][i]}  ${p.name}  ${p.total_points}PT　　`).join('')}
            ✦ KEEP CLIMBING ✦　がんばれ！　CHALLENGE YOUR LIMITS ✦　びっくり熱血！
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{position:'relative',zIndex:10,flex:1,display:'flex',gap:0,overflow:'hidden'}}>

        {/* ═══ CLIFF SCENE (main) ═══ */}
        <div style={{flex:1,position:'relative',overflowY:'auto',overflowX:'hidden'}}>
          {/* scroll hint */}
          <div style={{position:'sticky',top:0,left:0,right:0,zIndex:200,pointerEvents:'none',
            display:'flex',justifyContent:'center'}}>
            <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'rgba(255,224,0,0.7)',
              background:'rgba(0,0,40,0.6)',padding:'3px 10px',borderRadius:'0 0 8px 8px',
              letterSpacing:1}}>▼ เลื่อนดูอันดับอื่น ▼</span>
          </div>

          {/* tall scene container — characters spread over 1400 px */}
          <div style={{position:'relative',width:'100%',height:1400}}>
            <CliffBackground/>
            {loading ? (
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:20}}>
                <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:12,color:'#ffe000',
                  animation:'blink 0.5s infinite',textShadow:'0 0 20px #ffe000'}}>LOADING...</span>
              </div>
            ) : (
              <div style={{position:'absolute',inset:0,zIndex:20}}>
                {players.slice(0,10).map((p, i) => (
                  <CharacterCard
                    key={p.id}
                    player={p}
                    rank={i}
                    total={Math.min(players.length, 10)}
                    state={rankStates[p.id] || 'normal'}
                    isHotStreak={hotStreak === p.id}
                    bubbleVisible={bubbles[p.id] || null}
                    onClickChar={handleClickChar}
                    onClickHistory={setHistory}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT PANEL ═══ */}
        <div style={{width:460,flexShrink:0,display:'flex',flexDirection:'column',gap:5,overflow:'hidden',
          background:'rgba(0,0,20,0.92)',borderLeft:'2px solid #202050',padding:5}}>
          {/* Rank table */}
          <div style={{flex:1,display:'flex',overflow:'hidden',border:'2px solid #202050',background:'rgba(0,0,24,0.95)'}}>
            <RankTable players={players} prevRanks={prevRanks}/>
          </div>
          {/* Event log */}
          <EventLog players={players} prevPtsRef={prevPtsRef}/>
        </div>

      </div>

      {/* ── Footer ── */}
      <div style={{position:'relative',zIndex:100,padding:'4px 12px',background:'#000028',
        borderTop:'2px solid #202060',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:16}}>
          {[['#0ea5e9','นักเรียน'],['#7c3aed','ครู'],['#f59e0b','Admin'],['#ef4444','Super']].map(([c,l],i)=>(
            <span key={i} style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{display:'inline-block',width:8,height:8,background:c,border:'1px solid #fff'}}/>
              <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:6,color:'#505070'}}>{l}</span>
            </span>
          ))}
        </div>
        <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:5,color:'#252545',animation:'blink 2s infinite'}}>
          © THE CLIMB — NEKKETSU CLASSROOM
        </span>
      </div>

      {/* ── History Graph Modal ── */}
      {history && <HistoryGraph player={history} onClose={()=>setHistory(null)}/>}
    </div>
  );
};

export default Leaderboard;
