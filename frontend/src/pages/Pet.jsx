import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

/* ══════════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════════ */
const PET_TYPES = {
  CAT:    { name:'แมว',          emoji:'🐱', color:'#f97316', pale:'#fed7aa', eggLabel:'ไข่สีทอง',    desc:'ขี้เล่น ฉลาด เป็นอิสระ' },
  DOG:    { name:'หมา',          emoji:'🐶', color:'#d97706', pale:'#fde68a', eggLabel:'ไข่นุ่มฟู',   desc:'ซื่อสัตย์ ร่าเริง เป็นเพื่อน' },
  RABBIT: { name:'กระต่าย',      emoji:'🐰', color:'#818cf8', pale:'#e0e7ff', eggLabel:'ไข่ดาว',      desc:'น่ารัก อ่อนโยน ขี้อาย' },
  DRAGON: { name:'มังกร',        emoji:'🐲', color:'#059669', pale:'#6ee7b7', eggLabel:'ไข่มังกร',   desc:'แข็งแกร่ง ทรงพลัง หายาก' },
  SPIRIT: { name:'วิญญาณ',       emoji:'👻', color:'#a855f7', pale:'#e9d5ff', eggLabel:'ไข่วิเศษ',   desc:'ลึกลับ มหัศจรรย์ หายากที่สุด' },
};

const STAGES = [
  { key:'EGG',   minXp:0,   label:'🥚 ไข่',       nextXp:30  },
  { key:'BABY',  minXp:30,  label:'🐣 เด็กน้อย',  nextXp:150 },
  { key:'ADULT', minXp:150, label:'⚔️ ผู้ใหญ่',   nextXp:500 },
  { key:'ELDER', minXp:500, label:'👑 ผู้เฒ่า',   nextXp:null },
];

const MOODS = {
  ecstatic:{ min:85, label:'ยิ้มแย้ม!', color:'#10b981', emoji:'🤩' },
  happy:   { min:60, label:'มีความสุข', color:'#34d399', emoji:'😊' },
  okay:    { min:35, label:'พอไหว...',  color:'#fbbf24', emoji:'😐' },
  hungry:  { min:15, label:'หิวแล้ว!', color:'#f97316', emoji:'😟' },
  starving:{ min:0,  label:'หิวมาก!!', color:'#ef4444', emoji:'😭' },
};

function getMood(h) {
  for (const [k,m] of Object.entries(MOODS)) if (h >= m.min) return { key:k,...m };
  return { key:'starving',...MOODS.starving };
}
function getStage(xp) {
  for (let i=STAGES.length-1;i>=0;i--) if (xp>=STAGES[i].minXp) return STAGES[i];
  return STAGES[0];
}
function isValidWord(w) { return /^[a-zA-Zก-๙฀-๿\s-]+$/.test(w); }
function rnd(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

/* ── Chat response ── */
function getPetResponse(msg, mood, stage, petType) {
  if (stage.key==='EGG') return rnd(['...','*โยกตัว*','*ไม่มีเสียง*','*เปลือกไข่สั่น นิดหน่อย*']);
  const lower = msg.toLowerCase();
  if (/สวัสดี|หวัดดี|hello|hi\b|hey/.test(lower))
    return rnd(['สวัสดีครับ! '+mood.emoji, 'หวัดดี~ มีอะไรให้ช่วยไหม?', 'ยินดีที่ได้คุยด้วยนะ!']);
  if (/ชื่อ|name/.test(lower))
    return rnd([`ฉันเป็น${PET_TYPES[petType]?.name} นะ~`, 'เรียกฉันว่าน้องก็ได้ครับ 😊']);
  if (/หิว|อาหาร|กิน|hungry|food|eat/.test(lower))
    return (mood.key==='starving'||mood.key==='hungry')
      ? rnd(['หิวมากเลย... พิมพ์คำศัพท์ให้กินด้วยนะ 😢','ท้องร้องแล้ว ช่วยด้วย!'])
      : rnd(['ตอนนี้อิ่มอยู่นะ~','ไม่หิวแล้ว ขอบคุณที่ถามนะ 😊']);
  if (/รัก|love|น่ารัก|cute|เก่ง|สวย|หล่อ/.test(lower))
    return rnd(['หัวใจจะแตกแล้ว! 💕','รักเจ้าของมากมายเหมือนกัน~','อบอุ่นใจจัง 🥰','ขอบคุณนะ ดีใจมาก!']);
  if (/เล่น|play|game/.test(lower))
    return rnd(['เล่นด้วยกันได้เลย! 🎮','อยากเล่น! ลองพิมพ์คำใหม่ๆ มาสิ']);
  if (/เป็นยังไง|สบาย|how are/.test(lower))
    return mood.key==='ecstatic'||mood.key==='happy'
      ? rnd(['สบายมาก! อิ่มและมีความสุข 🤩','วันนี้ดีมากๆ เลย~'])
      : mood.key==='starving' ? 'หิวมากเลย ไม่ค่อยสบายใจ... 😭'
      : rnd(['ก็โอเคนะ~','พอไหวครับ 😐']);
  if (/นอน|sleep|ง่วง/.test(lower))
    return rnd(['ง่วงนิดหน่อย แต่ยังไม่อยากนอน~','ถ้าอิ่มแล้วค่อยนอนนะ 😴']);
  if (/ขอบคุณ|thank/.test(lower))
    return rnd(['ยินดีเสมอ! 😊','ไม่เป็นไรเลยนะ~']);
  if (mood.key==='starving') return rnd(['หิวมากเลย... 😭','พิมพ์คำศัพท์ให้กินหน่อยได้ไหม?']);
  if (stage.key==='ELDER') return rnd(['ผู้เฒ่ารู้แล้ว... ความรู้คือพลัง 📖','ใช้เวลานานมากกว่าจะถึงจุดนี้~','ปัญญาเกิดจากการฝึกฝน ✨']);
  return rnd(['โอ้ เหรอ? 🤔','น่าสนใจมาก!','จริงด้อ~','อืม... คิดว่างั้น','ฟังดูดีนะ!','เข้าใจแล้ว~']);
}

/* ══════════════════════════════════════════════════════════
   SVG SPRITES — GLOW HELPER
══════════════════════════════════════════════════════════ */
const Glow = ({ id, color, stdDeviation=4 }) => (
  <defs>
    <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation={stdDeviation} result="blur"/>
      <feFlood floodColor={color} floodOpacity="0.6" result="color"/>
      <feComposite in="color" in2="blur" operator="in" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
);

/* ════════════════════════
   EGG SPRITES
════════════════════════ */
const EggCAT = ({ xp }) => {
  const p = Math.min(1,xp/30);
  return (
    <svg viewBox="0 0 100 120" width={150} height={180}>
      <Glow id="eglow" color="#f97316" stdDeviation={6}/>
      <ellipse cx={50} cy={118} rx={22} ry={5} fill="rgba(0,0,0,0.2)"/>
      <ellipse cx={50} cy={62} rx={34} ry={44} fill="#fef3c7" filter="url(#eglow)"/>
      <ellipse cx={50} cy={62} rx={34} ry={44} fill="url(#catEggGrad)" opacity={0.5}/>
      <defs><radialGradient id="catEggGrad" cx="40%" cy="35%"><stop offset="0%" stopColor="#fbbf24"/><stop offset="100%" stopColor="#f97316"/></radialGradient></defs>
      {/* gold crack pattern */}
      <path d="M50,22 L44,36 L52,44 L46,58" stroke="#f97316" strokeWidth={1.5} fill="none" opacity={p>0.3?0.8:0.2}/>
      <path d="M55,28 L58,40 L54,46" stroke="#fbbf24" strokeWidth={1} fill="none" opacity={p>0.5?0.7:0.1}/>
      {p>0.7 && <path d="M40,50 L36,62 L42,68" stroke="#f97316" strokeWidth={1.5} fill="none"/>}
      {/* cat ear bumps on top */}
      <path d="M32,24 L26,10 L38,22 Z" fill="#f97316" opacity={0.6}/>
      <path d="M68,24 L74,10 L62,22 Z" fill="#f97316" opacity={0.6}/>
      <text x={50} y={112} textAnchor="middle" fontSize={9} fill="#f97316" opacity={0.7}>{Math.round(p*100)}%</text>
    </svg>
  );
};

const EggDOG = ({ xp }) => {
  const p = Math.min(1,xp/30);
  return (
    <svg viewBox="0 0 100 120" width={150} height={180}>
      <Glow id="deglow" color="#d97706" stdDeviation={5}/>
      <ellipse cx={50} cy={118} rx={22} ry={5} fill="rgba(0,0,0,0.2)"/>
      <ellipse cx={50} cy={62} rx={34} ry={44} fill="#fef9c3" filter="url(#deglow)"/>
      {/* fuzzy texture using small circles */}
      {[...Array(18)].map((_,i) => {
        const a=(i/18)*Math.PI*2; const r=28; const cx2=50+r*0.7*Math.cos(a); const cy2=62+r*0.85*Math.sin(a);
        return <circle key={i} cx={cx2} cy={cy2} r={4} fill="#fde68a" opacity={0.7}/>;
      })}
      <ellipse cx={50} cy={62} rx={28} ry={37} fill="#fef9c3" opacity={0.8}/>
      {p>0.5 && <circle cx={43} cy={56} r={4} fill="#92400e" opacity={0.5}/>}
      {p>0.5 && <circle cx={57} cy={56} r={4} fill="#92400e" opacity={0.5}/>}
      <text x={50} y={112} textAnchor="middle" fontSize={9} fill="#d97706" opacity={0.7}>{Math.round(p*100)}%</text>
    </svg>
  );
};

const EggRABBIT = ({ xp }) => {
  const p = Math.min(1,xp/30);
  return (
    <svg viewBox="0 0 100 120" width={150} height={180}>
      <Glow id="reglow" color="#818cf8" stdDeviation={6}/>
      <defs><radialGradient id="rabEgg" cx="35%" cy="30%"><stop offset="0%" stopColor="#e0e7ff"/><stop offset="100%" stopColor="#818cf8"/></radialGradient></defs>
      <ellipse cx={50} cy={118} rx={22} ry={5} fill="rgba(0,0,0,0.2)"/>
      <ellipse cx={50} cy={62} rx={34} ry={44} fill="url(#rabEgg)" filter="url(#reglow)"/>
      {/* stars */}
      {[[35,30],[65,25],[28,50],[72,55],[50,40],[42,70],[60,68]].map(([cx2,cy2],i) => (
        <text key={i} x={cx2} y={cy2} fontSize={i<3?10:7} textAnchor="middle" opacity={p>i*0.12?0.9:0.15}>✦</text>
      ))}
      <text x={50} y={112} textAnchor="middle" fontSize={9} fill="#818cf8" opacity={0.7}>{Math.round(p*100)}%</text>
    </svg>
  );
};

const EggDRAGON = ({ xp }) => {
  const p = Math.min(1,xp/30);
  return (
    <svg viewBox="0 0 100 120" width={150} height={180}>
      <Glow id="drglow" color="#059669" stdDeviation={6}/>
      <defs>
        <linearGradient id="dragEgg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7"/><stop offset="100%" stopColor="#059669"/>
        </linearGradient>
      </defs>
      <ellipse cx={50} cy={118} rx={22} ry={5} fill="rgba(0,0,0,0.2)"/>
      <ellipse cx={50} cy={62} rx={34} ry={44} fill="url(#dragEgg)" filter="url(#drglow)"/>
      {/* scale hex pattern */}
      {[[35,38],[50,32],[65,38],[28,50],[43,52],[57,52],[72,50],[35,64],[50,66],[65,64]].map(([cx2,cy2],i) => (
        <ellipse key={i} cx={cx2} cy={cy2} rx={7} ry={5} fill="#047857" opacity={p>i*0.08?0.4:0.1}/>
      ))}
      {/* gold stripe */}
      <path d="M38,18 Q50,15 62,18 Q68,40 66,62 Q60,80 50,84 Q40,80 34,62 Q32,40 38,18 Z" stroke="#fbbf24" strokeWidth={2} fill="none" opacity={0.6}/>
      <text x={50} y={112} textAnchor="middle" fontSize={9} fill="#059669" opacity={0.7}>{Math.round(p*100)}%</text>
    </svg>
  );
};

const EggSPIRIT = ({ xp }) => {
  const p = Math.min(1,xp/30);
  return (
    <svg viewBox="0 0 100 120" width={150} height={180}>
      <Glow id="spglow" color="#a855f7" stdDeviation={8}/>
      <defs>
        <radialGradient id="spEgg" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#f3e8ff"/>
          <stop offset="60%" stopColor="#a855f7"/>
          <stop offset="100%" stopColor="#6d28d9"/>
        </radialGradient>
      </defs>
      <ellipse cx={50} cy={118} rx={22} ry={5} fill="rgba(0,0,0,0.2)"/>
      <ellipse cx={50} cy={62} rx={34} ry={44} fill="url(#spEgg)" filter="url(#spglow)"/>
      {/* swirl lines */}
      <path d="M50,22 Q70,35 65,55 Q60,72 50,78 Q40,72 35,55 Q30,35 50,22 Z" stroke="#e9d5ff" strokeWidth={2} fill="none" opacity={0.6}/>
      <path d="M50,30 Q62,42 60,58 Q55,68 50,72" stroke="white" strokeWidth={1.5} fill="none" opacity={p>0.4?0.8:0.2}/>
      <path d="M50,30 Q38,42 40,58 Q45,68 50,72" stroke="white" strokeWidth={1.5} fill="none" opacity={p>0.6?0.8:0.2}/>
      {p>0.8 && <text x={50} y={50} textAnchor="middle" fontSize={20}>✨</text>}
      <text x={50} y={112} textAnchor="middle" fontSize={9} fill="#a855f7" opacity={0.7}>{Math.round(p*100)}%</text>
    </svg>
  );
};

/* ════════════════════════
   BABY SPRITES (round chubby)
════════════════════════ */
const BabyCAT = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  const sad = mood.key==='hungry'||mood.key==='starving';
  return (
    <svg viewBox="0 0 100 100" width={160} height={160}>
      <Glow id="bcglow" color="#f97316" stdDeviation={5}/>
      <ellipse cx={50} cy={97} rx={20} ry={4} fill="rgba(0,0,0,0.2)"/>
      {/* tiny ears */}
      <path d="M28,30 L22,16 L36,26 Z" fill="#f97316"/>
      <path d="M28,29 L25,18 L34,26 Z" fill="#fda4af"/>
      <path d="M72,30 L78,16 L64,26 Z" fill="#f97316"/>
      <path d="M72,29 L75,18 L66,26 Z" fill="#fda4af"/>
      {/* round chubby body */}
      <circle cx={50} cy={58} r={34} fill="#f97316" filter="url(#bcglow)"/>
      <ellipse cx={50} cy={66} rx={22} ry={18} fill="#fed7aa"/>
      {/* big cute eyes */}
      <circle cx={38} cy={50} r={10} fill="white"/>
      <circle cx={62} cy={50} r={10} fill="white"/>
      <circle cx={38} cy={50} r={happy?5:6} fill="#1e293b"/>
      <circle cx={62} cy={50} r={happy?5:6} fill="#1e293b"/>
      {happy && <><circle cx={38} cy={50} r={3} fill="#f97316" opacity={0.5}/><circle cx={62} cy={50} r={3} fill="#f97316" opacity={0.5}/></>}
      <circle cx={35} cy={47} r={2.5} fill="white"/>
      <circle cx={59} cy={47} r={2.5} fill="white"/>
      {/* nose + mouth */}
      <path d="M47,59 L50,62 L53,59 Z" fill="#ec4899"/>
      {happy
        ? <path d="M42,65 Q50,72 58,65" stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
        : sad ? <path d="M43,67 Q50,63 57,67" stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
        : <path d="M44,65 L56,65" stroke="#1e293b" strokeWidth={1.5} strokeLinecap="round"/>}
      {/* blush */}
      <ellipse cx={26} cy={62} rx={8} ry={5} fill="#fda4af" opacity={0.5}/>
      <ellipse cx={74} cy={62} rx={8} ry={5} fill="#fda4af" opacity={0.5}/>
      {/* tiny paws */}
      <ellipse cx={26} cy={84} rx={10} ry={8} fill="#f97316"/>
      <ellipse cx={74} cy={84} rx={10} ry={8} fill="#f97316"/>
    </svg>
  );
};

const BabyDOG = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  const sad = mood.key==='hungry'||mood.key==='starving';
  return (
    <svg viewBox="0 0 100 100" width={160} height={160}>
      <Glow id="bdglow" color="#d97706" stdDeviation={5}/>
      <ellipse cx={50} cy={97} rx={20} ry={4} fill="rgba(0,0,0,0.2)"/>
      {/* floppy ears */}
      <ellipse cx={24} cy={48} rx={12} ry={18} fill="#b45309" transform="rotate(10,24,48)"/>
      <ellipse cx={76} cy={48} rx={12} ry={18} fill="#b45309" transform="rotate(-10,76,48)"/>
      <circle cx={50} cy={56} r={34} fill="#d97706" filter="url(#bdglow)"/>
      <ellipse cx={50} cy={64} rx={22} ry={18} fill="#fde68a"/>
      <circle cx={38} cy={50} r={10} fill="white"/>
      <circle cx={62} cy={50} r={10} fill="white"/>
      <circle cx={38} cy={50} r={6} fill="#1e293b"/>
      <circle cx={62} cy={50} r={6} fill="#1e293b"/>
      <circle cx={35} cy={47} r={2.5} fill="white"/>
      <circle cx={59} cy={47} r={2.5} fill="white"/>
      <ellipse cx={50} cy={62} rx={7} ry={5.5} fill="#1e293b"/>
      <ellipse cx={50} cy={61} rx={4} ry={3} fill="#374151"/>
      {happy
        ? <><path d="M42,68 Q50,76 58,68" stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/><ellipse cx={50} cy={74} rx={6} ry={4} fill="#fda4af"/></>
        : sad ? <path d="M43,69 Q50,65 57,69" stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
        : <path d="M44,68 L56,68" stroke="#1e293b" strokeWidth={1.5} strokeLinecap="round"/>}
      <ellipse cx={26} cy={64} rx={8} ry={5} fill="#fda4af" opacity={0.4}/>
      <ellipse cx={74} cy={64} rx={8} ry={5} fill="#fda4af" opacity={0.4}/>
      <ellipse cx={26} cy={84} rx={10} ry={8} fill="#d97706"/>
      <ellipse cx={74} cy={84} rx={10} ry={8} fill="#d97706"/>
    </svg>
  );
};

const BabyRABBIT = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  const sad = mood.key==='hungry'||mood.key==='starving';
  return (
    <svg viewBox="0 0 100 110" width={160} height={176}>
      <Glow id="brglow" color="#818cf8" stdDeviation={5}/>
      <ellipse cx={50} cy={107} rx={20} ry={4} fill="rgba(0,0,0,0.2)"/>
      {/* long ears */}
      <ellipse cx={35} cy={22} rx={10} ry={26} fill="#c7d2fe" transform="rotate(-6,35,22)"/>
      <ellipse cx={35} cy={22} rx={6}  ry={20} fill="#fda4af" opacity={0.5} transform="rotate(-6,35,22)"/>
      <ellipse cx={65} cy={22} rx={10} ry={26} fill="#c7d2fe" transform="rotate(6,65,22)"/>
      <ellipse cx={65} cy={22} rx={6}  ry={20} fill="#fda4af" opacity={0.5} transform="rotate(6,65,22)"/>
      <circle cx={50} cy={65} r={34} fill="#818cf8" filter="url(#brglow)"/>
      <ellipse cx={50} cy={73} rx={22} ry={18} fill="#e0e7ff"/>
      <circle cx={38} cy={58} r={10} fill="white"/>
      <circle cx={62} cy={58} r={10} fill="white"/>
      <circle cx={38} cy={58} r={happy?4:6} fill={happy?'#7c3aed':'#1e293b'}/>
      <circle cx={62} cy={58} r={happy?4:6} fill={happy?'#7c3aed':'#1e293b'}/>
      <circle cx={35} cy={55} r={2.5} fill="white"/>
      <circle cx={59} cy={55} r={2.5} fill="white"/>
      <ellipse cx={50} cy={72} rx={4} ry={3} fill="#fda4af"/>
      <path d="M50,75 L46,79 M50,75 L54,79" stroke="#1e293b" strokeWidth={1} strokeLinecap="round"/>
      {happy
        ? <path d="M43,80 Q50,86 57,80" stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
        : sad ? <path d="M43,82 Q50,78 57,82" stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
        : <path d="M44,80 L56,80" stroke="#1e293b" strokeWidth={1.5} strokeLinecap="round"/>}
      <ellipse cx={28} cy={70} rx={8} ry={5} fill="#fda4af" opacity={0.4}/>
      <ellipse cx={72} cy={70} rx={8} ry={5} fill="#fda4af" opacity={0.4}/>
      {/* fluffy tail */}
      <circle cx={76} cy={78} r={8} fill="white" opacity={0.8}/>
      <ellipse cx={26} cy={92} rx={10} ry={8} fill="#818cf8"/>
      <ellipse cx={74} cy={92} rx={10} ry={8} fill="#818cf8"/>
    </svg>
  );
};

const BabyDRAGON = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  const sad = mood.key==='hungry'||mood.key==='starving';
  return (
    <svg viewBox="0 0 100 100" width={160} height={160}>
      <Glow id="bdragon" color="#059669" stdDeviation={5}/>
      <ellipse cx={50} cy={97} rx={20} ry={4} fill="rgba(0,0,0,0.2)"/>
      {/* tiny wings */}
      <path d="M18,52 L4,38 L22,48 Z" fill="#6ee7b7" opacity={0.8}/>
      <path d="M82,52 L96,38 L78,48 Z" fill="#6ee7b7" opacity={0.8}/>
      {/* tiny horns */}
      <path d="M36,22 L32,8 L40,20 Z" fill="#047857"/>
      <path d="M64,22 L68,8 L60,20 Z" fill="#047857"/>
      <circle cx={50} cy={56} r={34} fill="#059669" filter="url(#bdragon)"/>
      <ellipse cx={50} cy={64} rx={22} ry={18} fill="#6ee7b7"/>
      <circle cx={38} cy={50} r={10} fill="#fbbf24"/>
      <circle cx={62} cy={50} r={10} fill="#fbbf24"/>
      <ellipse cx={38} cy={50} rx={4} ry={happy?7:5} fill="#1e293b"/>
      <ellipse cx={62} cy={50} rx={4} ry={happy?7:5} fill="#1e293b"/>
      <circle cx={35} cy={47} r={2} fill="white"/>
      <circle cx={59} cy={47} r={2} fill="white"/>
      <circle cx={47} cy={62} r={2.5} fill="#047857"/>
      <circle cx={53} cy={62} r={2.5} fill="#047857"/>
      {happy
        ? <path d="M41,68 Q50,76 59,68" stroke="#047857" strokeWidth={2} fill="none" strokeLinecap="round"/>
        : sad ? <path d="M41,70 Q50,65 59,70" stroke="#047857" strokeWidth={2} fill="none" strokeLinecap="round"/>
        : <path d="M44,69 L56,69" stroke="#047857" strokeWidth={2} strokeLinecap="round"/>}
      {/* spines */}
      <path d="M34,26 L36,16 L38,26 M44,20 L46,10 L48,20 M52,20 L54,10 L56,20 M62,26 L64,16 L66,26" stroke="#047857" strokeWidth={1.8} fill="none"/>
      <ellipse cx={26} cy={84} rx={10} ry={8} fill="#059669"/>
      <ellipse cx={74} cy={84} rx={10} ry={8} fill="#059669"/>
    </svg>
  );
};

const BabySPIRIT = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  const sad = mood.key==='hungry'||mood.key==='starving';
  return (
    <svg viewBox="0 0 100 110" width={160} height={176}>
      <Glow id="bspglow" color="#a855f7" stdDeviation={8}/>
      <defs>
        <radialGradient id="spiritGrad" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#f3e8ff"/>
          <stop offset="100%" stopColor="#a855f7"/>
        </radialGradient>
      </defs>
      {/* ghost body */}
      <path d="M20,50 Q20,10 50,10 Q80,10 80,50 L80,90 Q70,80 60,90 Q50,80 40,90 Q30,80 20,90 Z"
        fill="url(#spiritGrad)" filter="url(#bspglow)" opacity={0.9}/>
      <circle cx={38} cy={52} r={10} fill="white"/>
      <circle cx={62} cy={52} r={10} fill="white"/>
      <circle cx={38} cy={52} r={happy?4:6} fill="#5b21b6"/>
      <circle cx={62} cy={52} r={happy?4:6} fill="#5b21b6"/>
      <circle cx={35} cy={49} r={2} fill="white"/>
      <circle cx={59} cy={49} r={2} fill="white"/>
      {happy
        ? <path d="M43,66 Q50,72 57,66" stroke="#5b21b6" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
        : sad ? <path d="M43,68 Q50,64 57,68" stroke="#5b21b6" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
        : <path d="M44,66 L56,66" stroke="#5b21b6" strokeWidth={1.5} strokeLinecap="round"/>}
      <ellipse cx={28} cy={62} rx={7} ry={5} fill="#c4b5fd" opacity={0.5}/>
      <ellipse cx={72} cy={62} rx={7} ry={5} fill="#c4b5fd" opacity={0.5}/>
      {/* sparkles */}
      {[20,50,80].map((x,i) => <text key={i} x={x} y={20+i*5} fontSize={8} opacity={0.6}>✦</text>)}
    </svg>
  );
};

/* ════════════════════════
   ADULT SPRITES (with accessories)
════════════════════════ */
const AdultCAT = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  const sad = mood.key==='hungry'||mood.key==='starving';
  return (
    <svg viewBox="0 0 110 120" width={176} height={192}>
      <Glow id="acglow" color="#f97316" stdDeviation={5}/>
      <ellipse cx={55} cy={118} rx={24} ry={5} fill="rgba(0,0,0,0.2)"/>
      {/* wings! */}
      <path d="M14,62 Q4,44 16,36 Q24,50 26,60 Z" fill="#fde68a" opacity={0.8}/>
      <path d="M8,64 Q-2,50 10,44 Q16,56 18,64 Z" fill="#fbbf24" opacity={0.6}/>
      <path d="M96,62 Q106,44 94,36 Q86,50 84,60 Z" fill="#fde68a" opacity={0.8}/>
      <path d="M102,64 Q112,50 100,44 Q94,56 92,64 Z" fill="#fbbf24" opacity={0.6}/>
      {/* tail */}
      <path d="M78,100 Q100,84 90,62" stroke="#f97316" strokeWidth={9} fill="none" strokeLinecap="round"/>
      {/* body */}
      <ellipse cx={55} cy={90} rx={30} ry={28} fill="#f97316" filter="url(#acglow)"/>
      <ellipse cx={55} cy={96} rx={20} ry={18} fill="#fed7aa"/>
      {/* armor plate */}
      <path d="M38,76 L72,76 L72,88 L55,94 L38,88 Z" fill="#fbbf24" opacity={0.7}/>
      <path d="M46,76 L64,76 L64,86 L55,90 L46,86 Z" fill="#f59e0b"/>
      <circle cx={55} cy={82} r={4} fill="#f97316"/>
      {/* ears */}
      <path d="M30,42 L22,20 L42,34 Z" fill="#f97316"/>
      <path d="M30,41 L26,23 L38,33 Z" fill="#fda4af"/>
      <path d="M80,42 L88,20 L68,34 Z" fill="#f97316"/>
      <path d="M80,41 L84,23 L72,33 Z" fill="#fda4af"/>
      {/* head */}
      <circle cx={55} cy={48} r={30} fill="#f97316" filter="url(#acglow)"/>
      <ellipse cx={55} cy={54} rx={20} ry={16} fill="#fed7aa"/>
      {/* eyes */}
      <circle cx={42} cy={44} r={9} fill="white"/>
      <circle cx={68} cy={44} r={9} fill="white"/>
      <ellipse cx={42} cy={44} rx={happy?3:5} ry={happy?7:5} fill="#1e293b"/>
      <ellipse cx={68} cy={44} rx={happy?3:5} ry={happy?7:5} fill="#1e293b"/>
      <circle cx={39} cy={41} r={2} fill="white"/>
      <circle cx={65} cy={41} r={2} fill="white"/>
      {happy && <><path d="M38,54 Q55,62 72,54" stroke="#f97316" strokeWidth={1} fill="none" opacity={0.4}/></>}
      <path d="M52,57 L55,60 L58,57 Z" fill="#ec4899"/>
      {happy
        ? <path d="M46,64 Q55,70 64,64" stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
        : sad ? <path d="M46,66 Q55,62 64,66" stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
        : <path d="M48,65 L62,65" stroke="#1e293b" strokeWidth={1.5} strokeLinecap="round"/>}
      <line x1={22} y1={57} x2={44} y2={59} stroke="#1e293b" strokeWidth={0.8} opacity={0.4}/>
      <line x1={22} y1={61} x2={44} y2={61} stroke="#1e293b" strokeWidth={0.8} opacity={0.4}/>
      <line x1={66} y1={59} x2={88} y2={57} stroke="#1e293b" strokeWidth={0.8} opacity={0.4}/>
      <line x1={66} y1={61} x2={88} y2={61} stroke="#1e293b" strokeWidth={0.8} opacity={0.4}/>
      <ellipse cx={30} cy={62} rx={9} ry={6} fill="#fda4af" opacity={0.4}/>
      <ellipse cx={80} cy={62} rx={9} ry={6} fill="#fda4af" opacity={0.4}/>
      <ellipse cx={38} cy={112} rx={12} ry={9} fill="#f97316"/>
      <ellipse cx={72} cy={112} rx={12} ry={9} fill="#f97316"/>
    </svg>
  );
};

const AdultDOG = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  return (
    <svg viewBox="0 0 110 125" width={176} height={200}>
      <Glow id="adglow" color="#d97706" stdDeviation={5}/>
      <ellipse cx={55} cy={123} rx={24} ry={5} fill="rgba(0,0,0,0.2)"/>
      {/* ninja band */}
      <rect x={30} y={58} width={50} height={10} rx={5} fill="#1e293b"/>
      {/* body with ninja outfit */}
      <ellipse cx={55} cy={95} rx={30} ry={28} fill="#1e293b" filter="url(#adglow)"/>
      <ellipse cx={55} cy={100} rx={20} ry={18} fill="#374151"/>
      {/* belt */}
      <rect x={35} y={102} width={40} height={7} rx={3} fill="#d97706"/>
      <circle cx={55} cy={106} r={4} fill="#fbbf24"/>
      {/* floppy ears */}
      <ellipse cx={26} cy={56} rx={13} ry={20} fill="#92400e" transform="rotate(12,26,56)"/>
      <ellipse cx={84} cy={56} rx={13} ry={20} fill="#92400e" transform="rotate(-12,84,56)"/>
      {/* head */}
      <circle cx={55} cy={52} r={30} fill="#d97706" filter="url(#adglow)"/>
      <ellipse cx={55} cy={60} rx={20} ry={16} fill="#fde68a"/>
      {/* mask covering lower face */}
      <path d="M32,62 Q55,74 78,62 L78,70 Q55,80 32,70 Z" fill="#1e293b" opacity={0.7}/>
      <circle cx={42} cy={46} r={9} fill="white"/>
      <circle cx={68} cy={46} r={9} fill="white"/>
      <circle cx={42} cy={46} r={happy?5:6} fill="#1e293b"/>
      <circle cx={68} cy={46} r={happy?5:6} fill="#1e293b"/>
      <circle cx={39} cy={43} r={2} fill="white"/>
      <circle cx={65} cy={43} r={2} fill="white"/>
      {happy && <path d="M36,54 Q55,60 74,54" stroke="#d97706" strokeWidth={1} fill="none" opacity={0.5}/>}
      <ellipse cx={55} cy={117} rx={22} ry={6} fill="#1e293b"/>
    </svg>
  );
};

const AdultRABBIT = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  return (
    <svg viewBox="0 0 110 130" width={176} height={208}>
      <Glow id="arglow" color="#818cf8" stdDeviation={5}/>
      <ellipse cx={55} cy={128} rx={24} ry={5} fill="rgba(0,0,0,0.2)"/>
      {/* fairy wings */}
      <path d="M18,70 Q6,50 14,36 Q28,52 30,68 Z" fill="#c7d2fe" opacity={0.7}/>
      <path d="M10,72 Q2,56 8,46 Q20,60 22,70 Z" fill="#a5b4fc" opacity={0.5}/>
      <path d="M92,70 Q104,50 96,36 Q82,52 80,68 Z" fill="#c7d2fe" opacity={0.7}/>
      <path d="M100,72 Q108,56 102,46 Q90,60 88,70 Z" fill="#a5b4fc" opacity={0.5}/>
      {/* long ears with ribbon */}
      <ellipse cx={36} cy={22} rx={11} ry={28} fill="#818cf8" transform="rotate(-6,36,22)" filter="url(#arglow)"/>
      <ellipse cx={36} cy={22} rx={7}  ry={22} fill="#fda4af" opacity={0.5} transform="rotate(-6,36,22)"/>
      <ellipse cx={74} cy={22} rx={11} ry={28} fill="#818cf8" transform="rotate(6,74,22)" filter="url(#arglow)"/>
      <ellipse cx={74} cy={22} rx={7}  ry={22} fill="#fda4af" opacity={0.5} transform="rotate(6,74,22)"/>
      {/* ribbon on ears */}
      <ellipse cx={36} cy={36} rx={8} ry={5} fill="#ec4899" transform="rotate(-6,36,36)"/>
      <ellipse cx={74} cy={36} rx={8} ry={5} fill="#ec4899" transform="rotate(6,74,36)"/>
      {/* body with dress */}
      <ellipse cx={55} cy={100} rx={30} ry={28} fill="#818cf8" filter="url(#arglow)"/>
      <path d="M28,88 Q55,114 82,88 L82,108 Q55,118 28,108 Z" fill="#6366f1"/>
      <ellipse cx={55} cy={75} rx={24} ry={26} fill="#818cf8" filter="url(#arglow)"/>
      <ellipse cx={55} cy={81} rx={18} ry={18} fill="#e0e7ff"/>
      <circle cx={40} cy={62} r={10} fill="white"/>
      <circle cx={70} cy={62} r={10} fill="white"/>
      <circle cx={40} cy={62} r={happy?4:6} fill={happy?'#7c3aed':'#1e293b'}/>
      <circle cx={70} cy={62} r={happy?4:6} fill={happy?'#7c3aed':'#1e293b'}/>
      <circle cx={37} cy={59} r={2} fill="white"/>
      <circle cx={67} cy={59} r={2} fill="white"/>
      <ellipse cx={55} cy={78} rx={4} ry={3} fill="#fda4af"/>
      <path d="M55,81 L51,85 M55,81 L59,85" stroke="#1e293b" strokeWidth={1} strokeLinecap="round"/>
      {happy
        ? <path d="M46,88 Q55,94 64,88" stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
        : <path d="M48,89 L62,89" stroke="#1e293b" strokeWidth={1.5} strokeLinecap="round"/>}
      <ellipse cx={32} cy={76} rx={9} ry={6} fill="#fda4af" opacity={0.4}/>
      <ellipse cx={78} cy={76} rx={9} ry={6} fill="#fda4af" opacity={0.4}/>
      <circle cx={78} cy={94} r={9} fill="white" opacity={0.7}/>
      <ellipse cx={36} cy={120} rx={12} ry={9} fill="#818cf8"/>
      <ellipse cx={74} cy={120} rx={12} ry={9} fill="#818cf8"/>
    </svg>
  );
};

const AdultDRAGON = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  return (
    <svg viewBox="0 0 120 130" width={192} height={208}>
      <Glow id="adragon" color="#059669" stdDeviation={6}/>
      <ellipse cx={60} cy={128} rx={26} ry={5} fill="rgba(0,0,0,0.2)"/>
      {/* large wings */}
      <path d="M16,72 Q2,50 12,34 Q28,52 32,70 Z" fill="#6ee7b7" opacity={0.8}/>
      <path d="M6,76 Q-6,58 4,44 Q18,62 22,74 Z" fill="#34d399" opacity={0.5}/>
      <path d="M104,72 Q118,50 108,34 Q92,52 88,70 Z" fill="#6ee7b7" opacity={0.8}/>
      <path d="M114,76 Q126,58 116,44 Q102,62 98,74 Z" fill="#34d399" opacity={0.5}/>
      {/* tail */}
      <path d="M86,108 Q110,94 106,70 L100,78 L106,70 L98,72" stroke="#059669" strokeWidth={8} fill="none" strokeLinecap="round"/>
      {/* body armor */}
      <ellipse cx={60} cy={96} rx={32} ry={30} fill="#059669" filter="url(#adragon)"/>
      <ellipse cx={60} cy={102} rx={22} ry={22} fill="#6ee7b7"/>
      {/* armor scales */}
      {[[48,88],[60,82],[72,88],[48,96],[60,92],[72,96]].map(([x,y],i) => (
        <ellipse key={i} cx={x} cy={y} rx={8} ry={5} fill="#047857" opacity={0.6}/>
      ))}
      {/* horns */}
      <path d="M38,24 L32,8 L44,22 Z" fill="#047857"/>
      <path d="M82,24 L88,8 L76,22 Z" fill="#047857"/>
      {/* head */}
      <ellipse cx={60} cy={52} rx={32} ry={30} fill="#059669" filter="url(#adragon)"/>
      <ellipse cx={60} cy={60} rx={22} ry={18} fill="#6ee7b7"/>
      {/* scales on head */}
      <path d="M36,24 L38,12 L40,24 M48,18 L50,6 L52,18 M60,16 L62,4 L64,16 M70,18 L72,6 L74,18 M80,24 L82,12 L84,24" stroke="#047857" strokeWidth={2} fill="none"/>
      <ellipse cx={46} cy={46} rx={10} ry={10} fill="#fbbf24"/>
      <ellipse cx={74} cy={46} rx={10} ry={10} fill="#fbbf24"/>
      <ellipse cx={46} cy={46} rx={4} ry={happy?8:5} fill="#1e293b"/>
      <ellipse cx={74} cy={46} rx={4} ry={happy?8:5} fill="#1e293b"/>
      <circle cx={43} cy={43} r={2} fill="white"/>
      <circle cx={71} cy={43} r={2} fill="white"/>
      <circle cx={56} cy={62} r={3} fill="#047857"/>
      <circle cx={64} cy={62} r={3} fill="#047857"/>
      {happy
        ? <path d="M46,70 Q60,80 74,70" stroke="#047857" strokeWidth={2} fill="none" strokeLinecap="round"/>
        : <path d="M50,70 L70,70" stroke="#047857" strokeWidth={2} strokeLinecap="round"/>}
      <ellipse cx={36} cy={120} rx={13} ry={10} fill="#059669"/>
      <ellipse cx={84} cy={120} rx={13} ry={10} fill="#059669"/>
    </svg>
  );
};

const AdultSPIRIT = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  return (
    <svg viewBox="0 0 110 130" width={176} height={208}>
      <Glow id="aspglow" color="#a855f7" stdDeviation={10}/>
      <defs>
        <radialGradient id="spiritAdult" cx="50%" cy="35%">
          <stop offset="0%" stopColor="#f3e8ff"/>
          <stop offset="50%" stopColor="#a855f7"/>
          <stop offset="100%" stopColor="#6d28d9" stopOpacity="0.6"/>
        </radialGradient>
      </defs>
      {/* flame aura */}
      {[20,35,50,65,80].map((x,i) => (
        <path key={i} d={`M${x},${110-i*3} Q${x+5},${90-i*4} ${x},${75-i*2} Q${x-5},${90-i*4} ${x},${110-i*3}`}
          fill="#fbbf24" opacity={0.3+i*0.05}/>
      ))}
      {/* ghost body larger */}
      <path d="M18,52 Q18,8 55,8 Q92,8 92,52 L92,100 Q80,88 68,100 Q55,88 42,100 Q30,88 18,100 Z"
        fill="url(#spiritAdult)" filter="url(#aspglow)"/>
      {/* glow orbs */}
      <circle cx={30} cy={80} r={6} fill="#fbbf24" opacity={0.6}/>
      <circle cx={80} cy={80} r={6} fill="#fbbf24" opacity={0.6}/>
      <circle cx={55} cy={100} r={5} fill="#fbbf24" opacity={0.5}/>
      <circle cx={42} cy={46} r={11} fill="white"/>
      <circle cx={68} cy={46} r={11} fill="white"/>
      <circle cx={42} cy={46} r={happy?5:7} fill="#5b21b6"/>
      <circle cx={68} cy={46} r={happy?5:7} fill="#5b21b6"/>
      <circle cx={39} cy={43} r={2.5} fill="white"/>
      <circle cx={65} cy={43} r={2.5} fill="white"/>
      {happy
        ? <path d="M44,62 Q55,70 66,62" stroke="#5b21b6" strokeWidth={2} fill="none" strokeLinecap="round"/>
        : <path d="M46,62 L64,62" stroke="#5b21b6" strokeWidth={2} strokeLinecap="round"/>}
      <ellipse cx={30} cy={58} rx={9} ry={6} fill="#c4b5fd" opacity={0.5}/>
      <ellipse cx={80} cy={58} rx={9} ry={6} fill="#c4b5fd" opacity={0.5}/>
      {/* sparkles around */}
      {[[15,25],[90,30],[10,65],[95,70],[50,15]].map(([x,y],i) => (
        <text key={i} x={x} y={y} fontSize={i<2?12:8} textAnchor="middle" opacity={0.7}>✦</text>
      ))}
    </svg>
  );
};

/* ════════════════════════
   ELDER SPRITES (legendary)
════════════════════════ */
const ElderCAT = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  return (
    <svg viewBox="0 0 120 140" width={192} height={224}>
      <Glow id="ecglow" color="#f59e0b" stdDeviation={8}/>
      <ellipse cx={60} cy={138} rx={28} ry={6} fill="rgba(0,0,0,0.2)"/>
      {/* wizard staff */}
      <line x1={92} y1={30} x2={92} y2={120} stroke="#92400e" strokeWidth={4} strokeLinecap="round"/>
      <circle cx={92} cy={28} r={8} fill="#fbbf24" filter="url(#ecglow)"/>
      <path d="M88,28 L92,18 L96,28" fill="#fbbf24" opacity={0.8}/>
      {/* wizard robe */}
      <path d="M28,76 L28,128 Q60,136 92,128 L92,76 Z" fill="#7c3aed"/>
      <path d="M38,76 L38,128 Q60,132 82,128 L82,76 Z" fill="#6d28d9"/>
      {/* rune marks on robe */}
      {['⚡','✦','◈'].map((r,i) => <text key={i} x={44+i*12} y={110} fontSize={10} textAnchor="middle" fill="#fbbf24" opacity={0.7}>{r}</text>)}
      {/* body */}
      <ellipse cx={60} cy={72} rx={30} ry={26} fill="#f97316" filter="url(#ecglow)"/>
      {/* wizard hat */}
      <path d="M30,36 L60,2 L90,36 Z" fill="#7c3aed"/>
      <rect x={24} y={34} width={72} height={10} rx={5} fill="#6d28d9"/>
      <circle cx={60} cy={10} r={5} fill="#fbbf24" opacity={0.8}/>
      {/* head */}
      <circle cx={60} cy={52} r={28} fill="#f97316" filter="url(#ecglow)"/>
      <ellipse cx={60} cy={58} rx={18} ry={14} fill="#fed7aa"/>
      {/* elder ears */}
      <path d="M34,40 L28,22 L42,34 Z" fill="#f97316"/>
      <path d="M86,40 L92,22 L78,34 Z" fill="#f97316"/>
      {/* wise eyes with glasses */}
      <circle cx={46} cy={48} r={8} fill="white"/>
      <circle cx={74} cy={48} r={8} fill="white"/>
      <circle cx={46} cy={48} r={happy?4:5} fill="#1e293b"/>
      <circle cx={74} cy={48} r={happy?4:5} fill="#1e293b"/>
      <circle cx={43} cy={45} r={2} fill="white"/>
      <circle cx={71} cy={45} r={2} fill="white"/>
      {/* glasses */}
      <circle cx={46} cy={48} r={9} fill="none" stroke="#92400e" strokeWidth={1.5}/>
      <circle cx={74} cy={48} r={9} fill="none" stroke="#92400e" strokeWidth={1.5}/>
      <line x1={55} y1={48} x2={65} y2={48} stroke="#92400e" strokeWidth={1.5}/>
      <line x1={28} y1={47} x2={37} y2={48} stroke="#92400e" strokeWidth={1.5}/>
      <line x1={83} y1={48} x2={92} y2={47} stroke="#92400e" strokeWidth={1.5}/>
      {/* wise beard */}
      <path d="M44,64 Q60,78 76,64 Q70,80 60,84 Q50,80 44,64 Z" fill="white" opacity={0.9}/>
      {/* whiskers longer */}
      <line x1={18} y1={58} x2={42} y2={60} stroke="#1e293b" strokeWidth={0.8} opacity={0.4}/>
      <line x1={18} y1={62} x2={42} y2={62} stroke="#1e293b" strokeWidth={0.8} opacity={0.4}/>
      <line x1={78} y1={60} x2={102} y2={58} stroke="#1e293b" strokeWidth={0.8} opacity={0.4}/>
      <line x1={78} y1={62} x2={102} y2={62} stroke="#1e293b" strokeWidth={0.8} opacity={0.4}/>
      <ellipse cx={40} cy={128} rx={12} ry={10} fill="#7c3aed"/>
      <ellipse cx={80} cy={128} rx={12} ry={10} fill="#7c3aed"/>
    </svg>
  );
};

const ElderDOG = ({ mood }) => (
  <svg viewBox="0 0 120 140" width={192} height={224}>
    <Glow id="edglow" color="#9ca3af" stdDeviation={7}/>
    <ellipse cx={60} cy={138} rx={28} ry={6} fill="rgba(0,0,0,0.2)"/>
    {/* stone golem body */}
    <ellipse cx={60} cy={102} rx={34} ry={32} fill="#6b7280" filter="url(#edglow)"/>
    {/* stone texture */}
    {[[44,95],[60,88],[76,95],[44,108],[60,102],[76,108],[52,118],[68,118]].map(([x,y],i) => (
      <ellipse key={i} cx={x} cy={y} rx={9} ry={6} fill="#4b5563" opacity={0.6}/>
    ))}
    {/* rune marks */}
    {['⚡','⚔','🛡'].map((r,i) => <text key={i} x={40+i*18} y={104} fontSize={10} textAnchor="middle" fill="#fbbf24" opacity={0.8}>{r}</text>)}
    {/* golem head */}
    <ellipse cx={60} cy={60} rx={30} ry={28} fill="#6b7280" filter="url(#edglow)"/>
    {/* stone ear plates */}
    <ellipse cx={28} cy={60} rx={14} ry={20} fill="#4b5563"/>
    <ellipse cx={92} cy={60} rx={14} ry={20} fill="#4b5563"/>
    {/* glowing eyes */}
    <circle cx={46} cy={56} r={10} fill="#fbbf24" opacity={0.9}/>
    <circle cx={74} cy={56} r={10} fill="#fbbf24" opacity={0.9}/>
    <circle cx={46} cy={56} r={6} fill="#f59e0b"/>
    <circle cx={74} cy={56} r={6} fill="#f59e0b"/>
    <circle cx={43} cy={53} r={2} fill="white" opacity={0.8}/>
    <circle cx={71} cy={53} r={2} fill="white" opacity={0.8}/>
    {/* stone nose */}
    <ellipse cx={60} cy={68} rx={8} ry={6} fill="#4b5563"/>
    <path d="M46,76 L74,76" stroke="#374151" strokeWidth={2} strokeLinecap="round"/>
    {/* crown of runes */}
    {[34,46,60,74,86].map((x,i) => <rect key={i} x={x-3} y={30+i%2*6} width={6} height={12+i%2*4} rx={2} fill="#4b5563"/>)}
    <ellipse cx={40} cy={128} rx={14} ry={10} fill="#4b5563"/>
    <ellipse cx={80} cy={128} rx={14} ry={10} fill="#4b5563"/>
  </svg>
);

const ElderRABBIT = ({ mood }) => (
  <svg viewBox="0 0 120 140" width={192} height={224}>
    <Glow id="erglow" color="#818cf8" stdDeviation={7}/>
    <ellipse cx={60} cy={138} rx={28} ry={6} fill="rgba(0,0,0,0.2)"/>
    {/* magic book */}
    <rect x={72} y={78} width={24} height={30} rx={3} fill="#dc2626"/>
    <rect x={74} y={80} width={20} height={26} rx={2} fill="#fef2f2"/>
    <text x={84} y={98} fontSize={14} textAnchor="middle">📖</text>
    {/* scholar robe */}
    <path d="M24,82 L24,132 Q60,142 96,132 L96,82 Z" fill="#1e3a5f"/>
    <path d="M34,82 L34,130 Q60,138 86,130 L86,82 Z" fill="#1e40af"/>
    {/* graduation symbols */}
    {['A','B','C'].map((l,i) => <text key={i} x={42+i*14} y={114} fontSize={9} textAnchor="middle" fill="#fbbf24" opacity={0.8}>{l}</text>)}
    {/* long wise ears */}
    <ellipse cx={38} cy={26} rx={12} ry={32} fill="#818cf8" transform="rotate(-6,38,26)" filter="url(#erglow)"/>
    <ellipse cx={38} cy={26} rx={7}  ry={26} fill="#fda4af" opacity={0.4} transform="rotate(-6,38,26)"/>
    <ellipse cx={82} cy={26} rx={12} ry={32} fill="#818cf8" transform="rotate(6,82,26)" filter="url(#erglow)"/>
    <ellipse cx={82} cy={26} rx={7}  ry={26} fill="#fda4af" opacity={0.4} transform="rotate(6,82,26)"/>
    {/* graduation cap */}
    <rect x={36} y={44} width={48} height={8} rx={2} fill="#1e293b"/>
    <path d="M42,44 L60,32 L78,44 Z" fill="#1e293b"/>
    <circle cx={60} cy={36} r={4} fill="#fbbf24"/>
    <line x1={78} y1={44} x2={84} y2={56} stroke="#fbbf24" strokeWidth={2}/>
    <circle cx={84} cy={58} r={4} fill="#fbbf24"/>
    {/* head */}
    <ellipse cx={60} cy={68} rx={28} ry={26} fill="#818cf8" filter="url(#erglow)"/>
    <ellipse cx={60} cy={74} rx={20} ry={18} fill="#e0e7ff"/>
    <circle cx={46} cy={62} r={9} fill="white"/>
    <circle cx={74} cy={62} r={9} fill="white"/>
    <circle cx={46} cy={62} r={5} fill="#5b21b6"/>
    <circle cx={74} cy={62} r={5} fill="#5b21b6"/>
    {/* round glasses */}
    <circle cx={46} cy={62} r={10} fill="none" stroke="#92400e" strokeWidth={1.5}/>
    <circle cx={74} cy={62} r={10} fill="none" stroke="#92400e" strokeWidth={1.5}/>
    <line x1={56} y1={62} x2={64} y2={62} stroke="#92400e" strokeWidth={1.5}/>
    <ellipse cx={60} cy={78} rx={4} ry={3} fill="#fda4af"/>
    <path d="M50,84 Q60,90 70,84" stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
    <ellipse cx={40} cy={128} rx={13} ry={10} fill="#1e40af"/>
    <ellipse cx={80} cy={128} rx={13} ry={10} fill="#1e40af"/>
  </svg>
);

const ElderDRAGON = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  return (
    <svg viewBox="0 0 130 145" width={208} height={232}>
      <Glow id="edragon" color="#059669" stdDeviation={10}/>
      <defs>
        <radialGradient id="elderDragGrad" cx="50%" cy="30%">
          <stop offset="0%" stopColor="#6ee7b7"/>
          <stop offset="100%" stopColor="#064e3b"/>
        </radialGradient>
      </defs>
      <ellipse cx={65} cy={143} rx={30} ry={6} fill="rgba(0,0,0,0.2)"/>
      {/* ancient star cloak */}
      <path d="M20,82 L20,140 Q65,150 110,140 L110,82 Z" fill="#1e1b4b"/>
      <path d="M28,82 L28,138 Q65,146 102,138 L102,82 Z" fill="#312e81"/>
      {/* stars on cloak */}
      {[[40,96],[65,90],[90,96],[36,114],[65,108],[94,114],[50,128],[80,128]].map(([x,y],i) => (
        <text key={i} x={x} y={y} fontSize={i<3?10:8} textAnchor="middle" fill="#fbbf24" opacity={0.7}>✦</text>
      ))}
      {/* large wings */}
      <path d="M14,82 Q0,58 10,40 Q26,62 30,80 Z" fill="#6ee7b7" opacity={0.7}/>
      <path d="M116,82 Q130,58 120,40 Q104,62 100,80 Z" fill="#6ee7b7" opacity={0.7}/>
      {/* long tail */}
      <path d="M98,118 Q122,102 118,74 L110,84 L118,74 L108,78" stroke="#059669" strokeWidth={9} fill="none" strokeLinecap="round"/>
      {/* horns with gold tips */}
      <path d="M40,24 L32,4 L48,22 Z" fill="#047857"/>
      <circle cx={34} cy={6} r={4} fill="#fbbf24"/>
      <path d="M90,24 L98,4 L82,22 Z" fill="#047857"/>
      <circle cx={96} cy={6} r={4} fill="#fbbf24"/>
      {/* head */}
      <ellipse cx={65} cy={54} rx={34} ry={32} fill="url(#elderDragGrad)" filter="url(#edragon)"/>
      <ellipse cx={65} cy={62} rx={24} ry={20} fill="#6ee7b7"/>
      {/* crown */}
      {[40,50,65,80,90].map((x,i) => (
        <path key={i} d={`M${x-4},30 L${x},18 L${x+4},30`} fill="#fbbf24" opacity={0.9}/>
      ))}
      <ellipse cx={65} cy={30} rx={26} ry={6} fill="#fbbf24" opacity={0.7}/>
      {/* eyes glowing */}
      <ellipse cx={50} cy={50} rx={11} ry={11} fill="#fbbf24" opacity={0.9}/>
      <ellipse cx={80} cy={50} rx={11} ry={11} fill="#fbbf24" opacity={0.9}/>
      <ellipse cx={50} cy={50} rx={5} ry={happy?9:6} fill="#1e293b"/>
      <ellipse cx={80} cy={50} rx={5} ry={happy?9:6} fill="#1e293b"/>
      <circle cx={47} cy={47} r={2.5} fill="white"/>
      <circle cx={77} cy={47} r={2.5} fill="white"/>
      <circle cx={61} cy={66} r={3} fill="#047857"/>
      <circle cx={69} cy={66} r={3} fill="#047857"/>
      {happy
        ? <path d="M48,74 Q65,84 82,74" stroke="#047857" strokeWidth={2} fill="none" strokeLinecap="round"/>
        : <path d="M52,74 L78,74" stroke="#047857" strokeWidth={2} strokeLinecap="round"/>}
      <ellipse cx={40} cy={136} rx={14} ry={10} fill="#312e81"/>
      <ellipse cx={90} cy={136} rx={14} ry={10} fill="#312e81"/>
    </svg>
  );
};

const ElderSPIRIT = ({ mood }) => {
  const happy = mood.key==='ecstatic'||mood.key==='happy';
  return (
    <svg viewBox="0 0 120 145" width={192} height={232}>
      <Glow id="espglow" color="#f59e0b" stdDeviation={12}/>
      <defs>
        <radialGradient id="elderSpirit" cx="50%" cy="30%">
          <stop offset="0%" stopColor="#fef3c7"/>
          <stop offset="40%" stopColor="#fbbf24"/>
          <stop offset="100%" stopColor="#d97706" stopOpacity="0.8"/>
        </radialGradient>
      </defs>
      {/* large flame corona */}
      {[15,28,42,60,78,92,105].map((x,i) => (
        <path key={i} d={`M${x},${132-i%3*6} Q${x+6},${110-i*4} ${x},${90-i*3} Q${x-6},${110-i*4} ${x},${132-i%3*6}`}
          fill={i%2===0?'#fbbf24':'#f97316'} opacity={0.4+i%3*0.1}/>
      ))}
      {/* spirit body — big and glowing */}
      <path d="M16,52 Q16,6 60,6 Q104,6 104,52 L104,106 Q92,92 78,106 Q60,92 42,106 Q28,92 16,106 Z"
        fill="url(#elderSpirit)" filter="url(#espglow)" opacity={0.95}/>
      {/* inner glow rings */}
      <ellipse cx={60} cy={60} rx={30} ry={28} fill="white" opacity={0.15}/>
      <ellipse cx={60} cy={60} rx={18} ry={16} fill="white" opacity={0.2}/>
      {/* big eyes */}
      <circle cx={44} cy={48} r={13} fill="white"/>
      <circle cx={76} cy={48} r={13} fill="white"/>
      <circle cx={44} cy={48} r={happy?7:9} fill="#1e3a5f"/>
      <circle cx={76} cy={48} r={happy?7:9} fill="#1e3a5f"/>
      {/* star pupils */}
      <text x={44} y={52} textAnchor="middle" fontSize={8} fill="#fbbf24">✦</text>
      <text x={76} y={52} textAnchor="middle" fontSize={8} fill="#fbbf24">✦</text>
      <circle cx={40} cy={44} r={3} fill="white" opacity={0.8}/>
      <circle cx={72} cy={44} r={3} fill="white" opacity={0.8}/>
      {happy
        ? <path d="M46,68 Q60,78 74,68" stroke="#1e3a5f" strokeWidth={2} fill="none" strokeLinecap="round"/>
        : <path d="M48,68 L72,68" stroke="#1e3a5f" strokeWidth={2} strokeLinecap="round"/>}
      <ellipse cx={30} cy={60} rx={10} ry={7} fill="#fde68a" opacity={0.5}/>
      <ellipse cx={90} cy={60} rx={10} ry={7} fill="#fde68a" opacity={0.5}/>
      {/* floating sparkles */}
      {[[10,22],[110,18],[8,80],[112,75],[60,10]].map(([x,y],i) => (
        <text key={i} x={x} y={y} fontSize={i<2?16:12} textAnchor="middle" fill="#fbbf24" opacity={0.8}>✦</text>
      ))}
      {/* halo */}
      <ellipse cx={60} cy={16} rx={24} ry={6} fill="none" stroke="#fbbf24" strokeWidth={3} opacity={0.7}/>
    </svg>
  );
};

/* ════════════════════════
   SPRITE PICKER
════════════════════════ */
const PetSprite = ({ petType, stage, mood, animState, xp }) => {
  const isAdult = stage.key==='ADULT';
  const isElder = stage.key==='ELDER';
  const m = mood;

  const animStyle = {
    idle:   { animation:'petIdle 2.4s ease-in-out infinite' },
    happy:  { animation:'petHappy 0.3s ease-in-out infinite alternate' },
    eat:    { animation:'petEat 0.1s ease-in-out infinite alternate' },
    sleep:  { animation:'petSleep 3s ease-in-out infinite' },
    sad:    { animation:'petSad 2s ease-in-out infinite' },
    evolve: { animation:'petEvolve 0.5s ease-in-out 4' },
  }[animState] || { animation:'petIdle 2.4s ease-in-out infinite' };

  let sprite;
  if (stage.key==='EGG') {
    sprite = petType==='DOG' ? <EggDOG xp={xp}/> : petType==='RABBIT' ? <EggRABBIT xp={xp}/> : petType==='DRAGON' ? <EggDRAGON xp={xp}/> : petType==='SPIRIT' ? <EggSPIRIT xp={xp}/> : <EggCAT xp={xp}/>;
  } else if (isElder) {
    sprite = petType==='DOG' ? <ElderDOG mood={m}/> : petType==='RABBIT' ? <ElderRABBIT mood={m}/> : petType==='DRAGON' ? <ElderDRAGON mood={m}/> : petType==='SPIRIT' ? <ElderSPIRIT mood={m}/> : <ElderCAT mood={m}/>;
  } else if (isAdult) {
    sprite = petType==='DOG' ? <AdultDOG mood={m}/> : petType==='RABBIT' ? <AdultRABBIT mood={m}/> : petType==='DRAGON' ? <AdultDRAGON mood={m}/> : petType==='SPIRIT' ? <AdultSPIRIT mood={m}/> : <AdultCAT mood={m}/>;
  } else {
    sprite = petType==='DOG' ? <BabyDOG mood={m}/> : petType==='RABBIT' ? <BabyRABBIT mood={m}/> : petType==='DRAGON' ? <BabyDRAGON mood={m}/> : petType==='SPIRIT' ? <BabySPIRIT mood={m}/> : <BabyCAT mood={m}/>;
  }

  return <div style={{ ...animStyle, display:'inline-block', transformOrigin:'bottom center' }}>{sprite}</div>;
};

/* ══════════════════════════════════════════════════════════
   UI COMPONENTS
══════════════════════════════════════════════════════════ */
const PetSelector = ({ onSelect }) => (
  <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
    <div style={{ fontFamily:'"Press Start 2P",monospace', fontSize:14, color:'#a78bfa', marginBottom:6, textAlign:'center' }}>🥚 เลือกสัตว์เลี้ยง</div>
    <p style={{ color:'rgba(255,255,255,0.4)', fontSize:12, marginBottom:20, textAlign:'center' }}>เริ่มจากไข่ → เด็ก → โต → ผู้เฒ่า ยิ่งป้อนคำศัพท์มาก ยิ่งโตเร็ว</p>
    <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', maxWidth:460 }}>
      {Object.entries(PET_TYPES).map(([key,pt]) => (
        <button key={key} onClick={() => onSelect(key)}
          style={{ background:'rgba(255,255,255,0.04)', border:`1.5px solid ${pt.color}44`, borderRadius:16, padding:'14px 18px',
            cursor:'pointer', display:'flex', alignItems:'center', gap:16, transition:'all 0.18s', width:'100%' }}
          onMouseEnter={e => { e.currentTarget.style.background=`${pt.color}18`; e.currentTarget.style.borderColor=pt.color; }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor=`${pt.color}44`; }}>
          <span style={{ fontSize:32 }}>{pt.emoji}</span>
          <div style={{ textAlign:'left', flex:1 }}>
            <div style={{ fontFamily:'"Press Start 2P",monospace', fontSize:10, color:'#e2e8f0', marginBottom:4 }}>{pt.name}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{pt.desc}</div>
            <div style={{ fontSize:10, color:pt.color, marginTop:4 }}>🥚 {pt.eggLabel}</div>
          </div>
          <span style={{ color:pt.color, fontSize:18 }}>›</span>
        </button>
      ))}
    </div>
  </div>
);

const ChatBubble = ({ from, text }) => (
  <div style={{ display:'flex', justifyFrom:from==='pet'?'flex-start':'flex-end', flexDirection:'row', alignItems:'flex-end', gap:6, marginBottom:8,
    ...(from==='user' ? { flexDirection:'row-reverse' } : {}) }}>
    {from==='pet' && <span style={{ fontSize:18, flexShrink:0 }}>🐾</span>}
    <div style={{ maxWidth:'72%', padding:'8px 14px',
      borderRadius: from==='pet' ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
      background: from==='pet' ? 'rgba(167,139,250,0.15)' : 'rgba(99,102,241,0.3)',
      border: from==='pet' ? '1px solid rgba(167,139,250,0.25)' : '1px solid rgba(99,102,241,0.4)',
      color:'#e2e8f0', fontSize:14, lineHeight:1.55 }}>
      {text}
    </div>
  </div>
);

const TypingDots = () => (
  <div style={{ display:'flex', alignItems:'flex-end', gap:6, marginBottom:8 }}>
    <span style={{ fontSize:18 }}>🐾</span>
    <div style={{ padding:'8px 16px', borderRadius:'18px 18px 18px 4px', background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.2)', display:'inline-flex', gap:4 }}>
      {[0,1,2].map(i => <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#a78bfa', animation:`dotB 1s ${i*0.2}s ease-in-out infinite`, display:'block' }}/>)}
    </div>
  </div>
);

const FloatText = ({ items }) => (
  <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
    {items.map(ft => (
      <div key={ft.id} style={{ position:'absolute', left:`${ft.x}%`, top:`${ft.y}%`, fontFamily:'"Press Start 2P",monospace', fontSize:11, color:ft.color||'#fbbf24', textShadow:`0 0 12px ${ft.color||'#fbbf24'}`, animation:'floatUp 1.4s ease-out forwards', whiteSpace:'nowrap', transform:'translateX(-50%)' }}>{ft.text}</div>
    ))}
  </div>
);

/* ══════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════ */
const DRAIN=0.5, SYNC_EVERY=30;

export default function Pet() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [hunger,      setHunger]      = useState(60);
  const [xp,          setXp]          = useState(0);
  const [petName,     setPetName]     = useState('น้องฟัฟฟี่');
  const [petType,     setPetType]     = useState(null);
  const [totalWords,  setTotalWords]  = useState(0);
  const [wordHistory, setWordHistory] = useState([]);
  const [loading,     setLoading]     = useState(true);

  const [feedInput,   setFeedInput]   = useState('');
  const [chatInput,   setChatInput]   = useState('');
  const [chatMsgs,    setChatMsgs]    = useState([{ from:'pet', text:'สวัสดี! พิมพ์คุยกับฉันได้เลยนะ~ หรือจะให้อาหารก็ได้ 🐾' }]);
  const [isTyping,    setIsTyping]    = useState(false);
  const [activeTab,   setActiveTab]   = useState('chat');

  const [animState,   setAnimState]   = useState('idle');
  const [floats,      setFloats]      = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedStatus,  setFeedStatus]  = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [tempName,    setTempName]    = useState('');
  const [prevStageKey,setPrevStageKey]= useState('EGG');

  const chatEndRef = useRef(null);
  const feedRef    = useRef(null);
  const floatId    = useRef(0);
  const syncTimer  = useRef(0);
  const hungerRef  = useRef(hunger);
  hungerRef.current = hunger;

  const mood  = getMood(hunger);
  const stage = getStage(xp);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [chatMsgs, isTyping]);

  // stage evolution
  useEffect(() => {
    if (prevStageKey !== stage.key && prevStageKey !== 'EGG') {
      setPrevStageKey(stage.key);
      setAnimState('evolve');
      const msgs = { BABY:'🥚✨ ฉันฟักออกมาแล้ว! สวัสดีนะ~', ADULT:'⚔️ ฉันโตแล้ว! ขอบคุณที่เลี้ยงดูนะ 🎉', ELDER:'👑 ฉันกลายเป็นผู้เฒ่าแล้ว! ปัญญาเกิดจากการฝึกฝน ✨' };
      setChatMsgs(m => [...m, { from:'pet', text: msgs[stage.key]||'...' }]);
      setTimeout(() => setAnimState('idle'), 2200);
    } else if (prevStageKey !== stage.key) {
      setPrevStageKey(stage.key);
    }
  }, [stage.key, prevStageKey]);

  // load
  useEffect(() => {
    api.get('/pet/state').then(res => {
      const { state, words } = res.data;
      if (state) {
        const elapsed = (Date.now() - new Date(state.updated_at).getTime()) / 1000;
        setHunger(Math.max(0, state.hunger - elapsed*DRAIN));
        setPetName(state.pet_name);
        setPetType(state.pet_type||null);
        setXp(state.xp||0);
        setTotalWords(state.total_words||0);
        const s = getStage(state.xp||0);
        setPrevStageKey(s.key);
      }
      if (words) setWordHistory(words);
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  // drain
  useEffect(() => {
    const iv = setInterval(() => {
      setHunger(h => Math.max(0, h-DRAIN));
      syncTimer.current++;
      if (syncTimer.current >= SYNC_EVERY) { syncTimer.current=0; api.put('/pet/state',{hunger:hungerRef.current}).catch(()=>{}); }
    }, 1000);
    return ()=>clearInterval(iv);
  }, []);

  const addFloat = (text,color,x,y) => {
    const id=++floatId.current;
    setFloats(f=>[...f,{id,text,color,x:x??30+Math.random()*40,y:y??15+Math.random()*20}]);
    setTimeout(()=>setFloats(f=>f.filter(ft=>ft.id!==id)),1500);
  };
  const triggerAnim=(a,ms=900)=>{ setAnimState(a); setTimeout(()=>setAnimState('idle'),ms); };

  const handleSelectPet = (type) => {
    setPetType(type);
    api.put('/pet/state',{pet_type:type}).catch(()=>{});
  };

  const sendChat = useCallback(() => {
    const msg=chatInput.trim(); if(!msg) return;
    setChatInput('');
    setChatMsgs(m=>[...m,{from:'user',text:msg}]);
    setIsTyping(true); triggerAnim('happy',700);
    setTimeout(() => {
      setIsTyping(false);
      setChatMsgs(m=>[...m,{from:'pet',text:getPetResponse(msg,mood,stage,petType)}]);
    }, 700+Math.random()*600);
  }, [chatInput, mood, stage, petType]);

  const feedPet = useCallback(async () => {
    const word=feedInput.trim(); if(!word||feedLoading) return;
    if(!isValidWord(word)) { setFeedStatus({ok:false,msg:'กรุณาพิมพ์ตัวอักษรเท่านั้น'}); return; }
    setFeedStatus(null); setFeedLoading(true);
    try {
      const res = await api.post('/pet/feed',{word});
      const { ok,status,pts,usedBy,xpGain,newXp } = res.data;
      if(!ok) {
        const msg = status==='duplicate'
          ? (usedBy==='คุณเอง' ? 'คุณเคยใช้คำนี้ไปแล้ว!' : `คำ "${word}" มีคนอื่นใช้แล้ว (${usedBy})`)
          : 'คำไม่ถูกต้อง';
        setFeedStatus({ok:false,msg}); addFloat('ซ้ำ! 🚫','#ef4444');
        setFeedInput(''); return;
      }
      setHunger(h=>Math.min(100,h+pts));
      setXp(newXp??xp+(xpGain||word.length));
      setTotalWords(t=>t+1);
      setWordHistory(wh=>[{word:word.toLowerCase()},...wh.slice(0,49)]);
      setFeedInput(''); triggerAnim('eat',900);
      addFloat(`+${pts} 🍖`, pts>=24?'#10b981':pts>=15?'#fbbf24':'#a78bfa');
      if(word.length>=8) addFloat('คำยาวมาก! 🔥','#f97316',62,10);
      setTimeout(()=>{ setChatMsgs(m=>[...m,{from:'pet',text:rnd(pts>=24?['อร่อยมากๆ! ขอบคุณ~','อิ่มขึ้นเลย! 😋']:['กินแล้ว~','ขอบคุณ 😊'])}]); },1000);
    } catch { setFeedStatus({ok:false,msg:'เกิดข้อผิดพลาด กรุณาลองใหม่'}); }
    finally { setFeedLoading(false); feedRef.current?.focus(); }
  }, [feedInput, feedLoading, xp]);

  const saveName=(name)=>{ setPetName(name); api.put('/pet/state',{pet_name:name}).catch(()=>{}); };

  if(loading) return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'#a78bfa',fontFamily:'"Press Start 2P",monospace',fontSize:12}}>กำลังโหลด...</div>
    </div>
  );
  if(!petType) return <PetSelector onSelect={handleSelectPet}/>;

  const pt = PET_TYPES[petType]||PET_TYPES.CAT;
  const hpPct = (hunger/100)*100;
  const nextStage = STAGES[STAGES.indexOf(stage)+1];
  const xpInStage = xp - stage.minXp;
  const xpNeeded  = nextStage ? nextStage.minXp - stage.minXp : null;
  const stagePct  = xpNeeded ? Math.min(100,(xpInStage/xpNeeded)*100) : 100;

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)',display:'flex',flexDirection:'column',maxHeight:'100vh',overflow:'hidden'}}>

      {/* Nav */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',background:'rgba(0,0,0,0.2)',flexShrink:0}}>
        <button onClick={()=>navigate('/dashboard')} style={{background:'rgba(255,255,255,0.08)',border:'none',borderRadius:8,padding:'6px 12px',color:'#fff',cursor:'pointer',fontSize:13}}>← กลับ</button>
        <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:10,color:'#a78bfa'}}>🐾 สัตว์เลี้ยง</span>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>📊 {totalWords} คำ</span>
          <button onClick={()=>{setPetType(null);api.put('/pet/state',{pet_type:''}).catch(()=>{});}}
            style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:7,padding:'4px 9px',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:11}}>
            เปลี่ยน
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{flex:1,overflowY:'auto',padding:'10px 14px 0',display:'flex',flexDirection:'column',gap:10,maxWidth:500,margin:'0 auto',width:'100%'}}>

          {/* Pet card */}
          <div style={{background:'rgba(255,255,255,0.04)',border:`1.5px solid ${pt.color}44`,borderRadius:20,padding:'14px 16px',position:'relative',boxShadow:`0 0 40px ${pt.color}18`}}>
            <FloatText items={floats}/>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              {/* Sprite */}
              <div style={{flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',width:180}}>
                <PetSprite petType={petType} stage={stage} mood={mood} animState={animState} xp={xp}/>
              </div>
              {/* Info */}
              <div style={{flex:1,minWidth:0}}>
                {editingName ? (
                  <input autoFocus value={tempName} onChange={e=>setTempName(e.target.value)}
                    onBlur={()=>{saveName(tempName||petName);setEditingName(false);}}
                    onKeyDown={e=>{if(e.key==='Enter'){saveName(tempName||petName);setEditingName(false);}}}
                    style={{fontFamily:'"Press Start 2P",monospace',fontSize:10,background:'rgba(167,139,250,0.15)',border:'1px solid #a78bfa',borderRadius:8,padding:'4px 8px',color:'#fff',outline:'none',width:'100%',marginBottom:6}}/>
                ) : (
                  <button onClick={()=>{setTempName(petName);setEditingName(true);}} style={{background:'none',border:'none',cursor:'pointer',padding:0,display:'block',marginBottom:6}}>
                    <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:10,color:'#e2e8f0'}}>{petName} ✏️</span>
                  </button>
                )}

                <div style={{display:'inline-flex',alignItems:'center',gap:4,background:`${mood.color}22`,border:`1px solid ${mood.color}44`,borderRadius:12,padding:'2px 10px',marginBottom:7}}>
                  <span style={{fontSize:11}}>{mood.emoji}</span>
                  <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:mood.color}}>{mood.label}</span>
                </div>

                {/* Stage */}
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                  <span style={{fontSize:10,color:'rgba(255,255,255,0.5)'}}>{stage.label}</span>
                  {nextStage && <span style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>→ {nextStage.label}</span>}
                </div>

                {/* Hunger */}
                <div style={{marginBottom:6}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>🍖 ความอิ่ม</span>
                    <span style={{fontSize:9,color:mood.color}}>{Math.round(hunger)}/100</span>
                  </div>
                  <div style={{height:8,background:'rgba(0,0,0,0.4)',borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${hpPct}%`,borderRadius:4,background:`linear-gradient(90deg,${mood.color}88,${mood.color})`,transition:'width 0.4s ease',boxShadow:`0 0 8px ${mood.color}66`}}/>
                  </div>
                </div>

                {/* XP */}
                {xpNeeded && (
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                      <span style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>⭐ EXP</span>
                      <span style={{fontSize:9,color:'#a78bfa'}}>{xpInStage}/{xpNeeded}</span>
                    </div>
                    <div style={{height:6,background:'rgba(0,0,0,0.4)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${stagePct}%`,borderRadius:3,background:'linear-gradient(90deg,#7c3aed88,#a78bfa)',transition:'width 0.6s ease'}}/>
                    </div>
                  </div>
                )}
                {!xpNeeded && <div style={{fontSize:10,color:'#fbbf24',marginTop:4}}>👑 ขั้นสูงสุดแล้ว!</div>}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:'flex',gap:8}}>
            {[['chat','💬 พูดคุย'],['feed','🍖 ให้อาหาร']].map(([key,label])=>(
              <button key={key} onClick={()=>setActiveTab(key)}
                style={{flex:1,padding:'8px 0',borderRadius:11,border:`1.5px solid ${activeTab===key?'#a78bfa':'rgba(255,255,255,0.1)'}`,background:activeTab===key?'rgba(167,139,250,0.18)':'rgba(255,255,255,0.04)',color:activeTab===key?'#a78bfa':'rgba(255,255,255,0.5)',cursor:'pointer',fontFamily:'"Press Start 2P",monospace',fontSize:8}}>
                {label}
              </button>
            ))}
          </div>

          {/* Chat */}
          {activeTab==='chat' && (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:12,height:190,overflowY:'auto'}}>
                {chatMsgs.map((m,i)=><ChatBubble key={i} from={m.from} text={m.text}/>)}
                {isTyping && <TypingDots/>}
                <div ref={chatEndRef}/>
              </div>
              <div style={{display:'flex',gap:8}}>
                <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendChat();}}
                  placeholder="พิมพ์คุยกับน้องได้เลย..."
                  style={{flex:1,padding:'10px 14px',background:'rgba(255,255,255,0.07)',border:'1.5px solid rgba(255,255,255,0.12)',borderRadius:11,color:'#fff',fontSize:14,outline:'none',fontFamily:'inherit'}}
                  autoFocus={activeTab==='chat'}/>
                <button onClick={sendChat} style={{padding:'10px 16px',background:'linear-gradient(135deg,#7c3aed,#a78bfa)',border:'none',borderRadius:11,color:'#fff',fontFamily:'"Press Start 2P",monospace',fontSize:8,cursor:'pointer'}}>ส่ง</button>
              </div>
            </div>
          )}

          {/* Feed */}
          {activeTab==='feed' && (
            <div style={{display:'flex',flexDirection:'column',gap:9}}>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',textAlign:'center'}}>💡 1 ตัวอักษร = +3 ความอิ่ม +1 EXP • คำยาว = อิ่มนานและโตเร็ว</div>
              <div style={{display:'flex',gap:8}}>
                <input ref={feedRef} value={feedInput} onChange={e=>{setFeedInput(e.target.value);setFeedStatus(null);}}
                  onKeyDown={e=>{if(e.key==='Enter')feedPet();}}
                  placeholder="พิมพ์คำศัพท์..."
                  disabled={feedLoading}
                  style={{flex:1,padding:'10px 14px',background:'rgba(255,255,255,0.07)',border:'1.5px solid rgba(255,255,255,0.12)',borderRadius:11,color:'#fff',fontSize:14,outline:'none',fontFamily:'inherit',opacity:feedLoading?0.6:1}}
                  autoFocus={activeTab==='feed'}/>
                <button onClick={feedPet} disabled={feedLoading||!feedInput.trim()}
                  style={{padding:'10px 14px',background:feedLoading?'rgba(124,58,237,0.3)':'linear-gradient(135deg,#7c3aed,#a78bfa)',border:'none',borderRadius:11,color:'#fff',fontFamily:'"Press Start 2P",monospace',fontSize:8,cursor:feedLoading?'not-allowed':'pointer',minWidth:56}}>
                  {feedLoading?'...':'ให้\nอาหาร'}
                </button>
              </div>
              {feedInput.trim().length>=2&&!feedLoading&&(
                <div style={{fontSize:11,color:'#a78bfa'}}>ยาว {feedInput.trim().length} ตัว → +{feedInput.trim().length*3} ความอิ่ม +{feedInput.trim().length} EXP</div>
              )}
              {feedStatus&&(
                <div style={{background:feedStatus.ok?'#10b98122':'#ef444422',border:`1px solid ${feedStatus.ok?'#10b981':'#ef4444'}`,borderRadius:9,padding:'9px 14px',color:feedStatus.ok?'#6ee7b7':'#fca5a5',fontSize:13}}>
                  {feedStatus.ok?'✅':'❌'} {feedStatus.msg}
                </div>
              )}
              {wordHistory.length>0&&(
                <div style={{background:'rgba(255,255,255,0.04)',borderRadius:11,padding:'9px 13px'}}>
                  <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#a78bfa',marginBottom:7}}>📖 คำที่ป้อนแล้ว</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,maxHeight:80,overflowY:'auto'}}>
                    {wordHistory.map((w,i)=>(
                      <span key={i} style={{background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.25)',borderRadius:7,padding:'2px 8px',fontSize:11,color:'#c4b5fd'}}>{w.word}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{height:14}}/>
        </div>
      </div>

      <style>{`
        @keyframes petIdle  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes petHappy { 0%{transform:translateY(0) scale(1)} 100%{transform:translateY(-12px) scale(1.1)} }
        @keyframes petEat   { 0%{transform:rotate(-7deg)} 100%{transform:rotate(7deg)} }
        @keyframes petSleep { 0%,100%{transform:scale(1) translateY(0)} 50%{transform:scale(1.04) translateY(-3px)} }
        @keyframes petSad   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
        @keyframes petEvolve{ 0%,100%{transform:scale(1)} 25%{transform:scale(0.9)} 75%{transform:scale(1.2)} }
        @keyframes floatUp  { 0%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-60px)} }
        @keyframes dotB     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
    </div>
  );
}
