import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

/* ══════════════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════════════ */
const PET_TYPES = {
  CAT:    { name:'แมว',           emoji:'🐱', color:'#f97316', pale:'#fed7aa', desc:'ขี้เล่น ฉลาด เป็นอิสระ' },
  DOG:    { name:'หมา',           emoji:'🐶', color:'#b45309', pale:'#fde68a', desc:'ซื่อสัตย์ ร่าเริง เป็นเพื่อน' },
  RABBIT: { name:'กระต่าย',       emoji:'🐰', color:'#94a3b8', pale:'#e2e8f0', desc:'น่ารัก อ่อนโยน ขี้อาย' },
  DRAGON: { name:'มังกรน้อย',     emoji:'🐲', color:'#059669', pale:'#6ee7b7', desc:'แข็งแกร่ง ลึกลับ หายาก' },
  FOX:    { name:'สุนัขจิ้งจอก',  emoji:'🦊', color:'#dc2626', pale:'#fca5a5', desc:'ฉลาด มีเสน่ห์ เป็นเอกลักษณ์' },
};

const STAGES = [
  { key:'EGG',   minXp:0,   label:'🥚 ไข่',  nextXp:30  },
  { key:'BABY',  minXp:30,  label:'🐣 เด็ก', nextXp:150 },
  { key:'ADULT', minXp:150, label:'✨ โต',   nextXp:null },
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
  for (let i = STAGES.length-1; i >= 0; i--) if (xp >= STAGES[i].minXp) return STAGES[i];
  return STAGES[0];
}
function isValidWord(w) { return /^[a-zA-Zก-๙฀-๿\s-]+$/.test(w); }
function rnd(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

/* ── Chat responses ──────────────────────────────────────────── */
function getPetResponse(msg, mood, stage, petType) {
  if (stage.key === 'EGG') return rnd(['...','*โยกตัว*','*ไม่มีเสียง*','*เปลือกไข่สั่น*']);
  const lower = msg.toLowerCase();
  const pName = PET_TYPES[petType]?.name || 'สัตว์เลี้ยง';
  const stageLabel = stage.key === 'BABY' ? 'ยังเล็กอยู่' : 'โตแล้ว';

  if (/สวัสดี|หวัดดี|hello|hi\b|hey/.test(lower))
    return rnd([`สวัสดีครับ! ${mood.emoji}`, 'หวัดดี~ มีอะไรให้ช่วยไหม?', 'ยินดีที่ได้คุยด้วยนะ!']);
  if (/ชื่อ|name/.test(lower))
    return rnd([`ฉันเป็น${pName}นะ~`, `เรียกฉันว่าน้องก็ได้ครับ 😊`]);
  if (/หิว|อาหาร|กิน|ข้าว|hungry|food|eat/.test(lower)) {
    if (mood.key === 'starving'||mood.key === 'hungry')
      return rnd(['หิวมากเลย... พิมพ์คำศัพท์ให้กินด้วยนะ 😢','ท้องร้องแล้ว ช่วยด้วย!']);
    return rnd(['ตอนนี้อิ่มอยู่นะ~','ไม่หิวแล้ว ขอบคุณที่ถามนะ 😊']);
  }
  if (/รัก|love|หล่อ|สวย|cute|น่ารัก|เก่ง/.test(lower))
    return rnd(['หัวใจจะแตกแล้ว! 💕','รักเจ้าของมากมายเหมือนกัน~','อบอุ่นใจจัง 🥰','ขอบคุณนะ ดีใจมาก!']);
  if (/เล่น|play|game/.test(lower))
    return rnd(['เล่นด้วยกันได้เลย! 🎮','อยากเล่นด้วย~ ลองพิมพ์คำใหม่ๆ มาสิ']);
  if (/เป็นยังไง|เป็นไง|how are|สบาย/.test(lower)) {
    if (mood.key === 'ecstatic'||mood.key === 'happy') return rnd(['สบายมาก! อิ่มและมีความสุข 🤩','วันนี้ดีมากๆ เลย~']);
    if (mood.key === 'starving') return 'หิวมากเลย ไม่ค่อยสบายใจ... 😭';
    return rnd(['ก็โอเคนะ~','พอไหวครับ 😐']);
  }
  if (/นอน|sleep|ง่วง/.test(lower))
    return rnd(['ง่วงนิดหน่อย แต่ยังไม่อยากนอน~','ถ้าอิ่มแล้วค่อยนอนนะ 😴']);
  if (/ขอบคุณ|thank/.test(lower))
    return rnd(['ยินดีเสมอ! 😊','ไม่เป็นไรเลยนะ~']);
  if (mood.key === 'starving') return rnd(['หิวมากเลย... 😭','พิมพ์คำศัพท์ให้กินหน่อยได้ไหม?']);
  if (mood.key === 'ecstatic') return rnd(['มีความสุขมากเลยวันนี้! 🤩','อิ่มและสบายใจ~']);
  if (stage.key === 'BABY') return rnd(['หนูยัง'+stageLabel+'นะ~','กำลังโตอยู่ 🌱']);
  return rnd(['โอ้ เหรอ? 🤔','น่าสนใจมาก!','จริงด้อ~','อืม... คิดว่างั้น','ฟังดูดีนะ!','เข้าใจแล้ว~','หืม!']);
}

/* ══════════════════════════════════════════════════════════
   PET SVG SPRITES
══════════════════════════════════════════════════════════ */

/* ── Egg ── */
const EggSprite = ({ petType, xp }) => {
  const { color, pale } = PET_TYPES[petType] || PET_TYPES.CAT;
  const pct = Math.min(1, xp / 30);
  const cracks = pct > 0.6;
  const bigCrack = pct > 0.85;
  return (
    <svg width={160} height={190} viewBox="0 0 100 120" style={{ filter:`drop-shadow(0 8px 20px ${color}55)` }}>
      <ellipse cx={50} cy={118} rx={22} ry={5} fill="rgba(0,0,0,0.2)"/>
      <ellipse cx={50} cy={65} rx={33} ry={43} fill="#fef9c3" stroke={pale} strokeWidth={2}/>
      <ellipse cx={37} cy={52} rx={9} ry={7}   fill={color} opacity={0.35}/>
      <ellipse cx={62} cy={72} rx={7} ry={6}   fill={pale}  opacity={0.5}/>
      <ellipse cx={44} cy={82} rx={6} ry={5}   fill={color} opacity={0.25}/>
      {cracks && <path d="M50,38 L46,50 L52,56 L48,68" stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.7}/>}
      {bigCrack && <path d="M58,44 L54,52 L60,58" stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.7}/>}
      {bigCrack && <text x={50} y={28} textAnchor="middle" fontSize={14}>✨</text>}
      <text x={50} y={110} textAnchor="middle" fontSize={10} fill={color} opacity={0.8}>{Math.round(pct*100)}%</text>
    </svg>
  );
};

/* ── CAT ── */
const CatSprite = ({ mood, isAdult, anim }) => {
  const isHappy = mood.key==='ecstatic'||mood.key==='happy';
  const isSad   = mood.key==='hungry'||mood.key==='starving';
  const eyeH = isSad ? 3 : 5;
  const mouth = isHappy ? 'M43,66 Q50,72 57,66' : isSad ? 'M43,68 Q50,64 57,68' : 'M44,67 L56,67';
  return (
    <svg width={170} height={200} viewBox="0 0 100 120" style={{ filter:'drop-shadow(0 8px 20px #f9731655)', overflow:'visible' }}>
      <ellipse cx={50} cy={118} rx={22} ry={5} fill="rgba(0,0,0,0.2)"/>
      {/* tail */}
      <path d="M72,95 Q95,75 82,54" stroke="#f97316" strokeWidth={8} fill="none" strokeLinecap="round"/>
      {/* body */}
      <ellipse cx={50} cy={88} rx={28} ry={26} fill="#f97316"/>
      <ellipse cx={50} cy={92} rx={18} ry={17} fill="#fed7aa"/>
      {/* ears */}
      <path d="M24,42 L17,20 L37,34 Z" fill="#f97316"/>
      <path d="M24,40 L20,23 L34,34 Z" fill="#fda4af"/>
      <path d="M76,42 L83,20 L63,34 Z" fill="#f97316"/>
      <path d="M76,40 L80,23 L66,34 Z" fill="#fda4af"/>
      {/* head */}
      <circle cx={50} cy={48} r={30} fill="#f97316"/>
      <ellipse cx={50} cy={54} rx={19} ry={15} fill="#fed7aa"/>
      {/* eyes */}
      <ellipse cx={38} cy={45} rx={7} ry={8} fill="white"/>
      <ellipse cx={62} cy={45} rx={7} ry={8} fill="white"/>
      <ellipse cx={38} cy={45} rx={isHappy ? 2.5 : 4} ry={isHappy ? 6 : eyeH} fill="#1e293b"/>
      <ellipse cx={62} cy={45} rx={isHappy ? 2.5 : 4} ry={isHappy ? 6 : eyeH} fill="#1e293b"/>
      <circle cx={36} cy={43} r={1.5} fill="white"/>
      <circle cx={60} cy={43} r={1.5} fill="white"/>
      {/* nose */}
      <path d="M47,57 L50,60 L53,57 Z" fill="#ec4899"/>
      {/* mouth */}
      <path d={mouth} stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
      {/* whiskers */}
      <line x1={18} y1={57} x2={41} y2={59} stroke="#1e293b" strokeWidth={0.8} opacity={0.4}/>
      <line x1={18} y1={61} x2={41} y2={61} stroke="#1e293b" strokeWidth={0.8} opacity={0.4}/>
      <line x1={59} y1={59} x2={82} y2={57} stroke="#1e293b" strokeWidth={0.8} opacity={0.4}/>
      <line x1={59} y1={61} x2={82} y2={61} stroke="#1e293b" strokeWidth={0.8} opacity={0.4}/>
      {/* cheeks */}
      <ellipse cx={27} cy={62} rx={9} ry={6} fill="#fda4af" opacity={0.5}/>
      <ellipse cx={73} cy={62} rx={9} ry={6} fill="#fda4af" opacity={0.5}/>
      {/* adult collar */}
      {isAdult && <><rect x={33} y={72} width={34} height={6} rx={3} fill="#7c3aed"/><circle cx={50} cy={78} r={3} fill="#fbbf24"/></>}
      {/* legs */}
      <ellipse cx={36} cy={110} rx={11} ry={9} fill="#f97316"/>
      <ellipse cx={64} cy={110} rx={11} ry={9} fill="#f97316"/>
    </svg>
  );
};

/* ── DOG ── */
const DogSprite = ({ mood, isAdult }) => {
  const isHappy = mood.key==='ecstatic'||mood.key==='happy';
  const isSad   = mood.key==='hungry'||mood.key==='starving';
  const mouth = isHappy ? 'M43,67 Q50,74 57,67' : isSad ? 'M44,69 Q50,65 56,69' : 'M44,68 L56,68';
  return (
    <svg width={170} height={200} viewBox="0 0 100 120" style={{ filter:'drop-shadow(0 8px 20px #b4530955)', overflow:'visible' }}>
      <ellipse cx={50} cy={118} rx={22} ry={5} fill="rgba(0,0,0,0.2)"/>
      {/* body */}
      <ellipse cx={50} cy={88} rx={28} ry={26} fill="#b45309"/>
      <ellipse cx={50} cy={92} rx={18} ry={17} fill="#fde68a"/>
      {/* tail stub */}
      <ellipse cx={78} cy={82} rx={9} ry={6} fill="#b45309" transform="rotate(-30,78,82)"/>
      {/* head */}
      <circle cx={50} cy={48} r={30} fill="#b45309"/>
      <ellipse cx={50} cy={57} rx={20} ry={16} fill="#fde68a"/>
      {/* floppy ears */}
      <ellipse cx={22} cy={52} rx={11} ry={20} fill="#92400e" transform="rotate(15,22,52)"/>
      <ellipse cx={78} cy={52} rx={11} ry={20} fill="#92400e" transform="rotate(-15,78,52)"/>
      {/* eyes */}
      <circle cx={38} cy={44} r={7} fill="white"/>
      <circle cx={62} cy={44} r={7} fill="white"/>
      <circle cx={38} cy={44} r={isSad?3:4} fill="#1e293b"/>
      <circle cx={62} cy={44} r={isSad?3:4} fill="#1e293b"/>
      <circle cx={36} cy={42} r={1.5} fill="white"/>
      <circle cx={60} cy={42} r={1.5} fill="white"/>
      {/* nose */}
      <ellipse cx={50} cy={58} rx={6} ry={5} fill="#1e293b"/>
      <ellipse cx={50} cy={57} rx={3} ry={2} fill="#374151"/>
      {/* mouth */}
      <path d={mouth} stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
      {isHappy && <ellipse cx={50} cy={72} rx={6} ry={4} fill="#fda4af"/>}
      {/* cheeks */}
      <ellipse cx={27} cy={58} rx={9} ry={6} fill="#fda4af" opacity={0.4}/>
      <ellipse cx={73} cy={58} rx={9} ry={6} fill="#fda4af" opacity={0.4}/>
      {isAdult && <><rect x={33} y={72} width={34} height={6} rx={3} fill="#dc2626"/><circle cx={50} cy={78} r={3} fill="#fbbf24"/></>}
      <ellipse cx={36} cy={110} rx={11} ry={9} fill="#b45309"/>
      <ellipse cx={64} cy={110} rx={11} ry={9} fill="#b45309"/>
    </svg>
  );
};

/* ── RABBIT ── */
const RabbitSprite = ({ mood, isAdult }) => {
  const isHappy = mood.key==='ecstatic'||mood.key==='happy';
  const isSad   = mood.key==='hungry'||mood.key==='starving';
  const mouth = isHappy ? 'M44,67 Q50,72 56,67' : isSad ? 'M44,69 Q50,65 56,69' : 'M44,68 L56,68';
  return (
    <svg width={170} height={210} viewBox="0 0 100 128" style={{ filter:'drop-shadow(0 8px 20px #94a3b855)', overflow:'visible' }}>
      <ellipse cx={50} cy={126} rx={22} ry={5} fill="rgba(0,0,0,0.2)"/>
      {/* body */}
      <ellipse cx={50} cy={92} rx={28} ry={27} fill="#e2e8f0"/>
      <ellipse cx={50} cy={97} rx={17} ry={16} fill="white"/>
      {/* long ears */}
      <ellipse cx={34} cy={20} rx={9}  ry={28} fill="#e2e8f0" transform="rotate(-8,34,20)"/>
      <ellipse cx={34} cy={20} rx={5}  ry={22} fill="#fda4af" opacity={0.6} transform="rotate(-8,34,20)"/>
      <ellipse cx={66} cy={20} rx={9}  ry={28} fill="#e2e8f0" transform="rotate(8,66,20)"/>
      <ellipse cx={66} cy={20} rx={5}  ry={22} fill="#fda4af" opacity={0.6} transform="rotate(8,66,20)"/>
      {/* head */}
      <circle cx={50} cy={52} r={28} fill="#e2e8f0"/>
      {/* eyes */}
      <circle cx={39} cy={48} r={7} fill="white"/>
      <circle cx={61} cy={48} r={7} fill="white"/>
      <circle cx={39} cy={48} r={isSad?3:4} fill={isHappy?'#ec4899':'#1e293b'}/>
      <circle cx={61} cy={48} r={isSad?3:4} fill={isHappy?'#ec4899':'#1e293b'}/>
      <circle cx={37} cy={46} r={1.5} fill="white"/>
      <circle cx={59} cy={46} r={1.5} fill="white"/>
      {/* nose */}
      <ellipse cx={50} cy={59} rx={4} ry={3} fill="#fda4af"/>
      <path d="M50,62 L46,66 M50,62 L54,66" stroke="#1e293b" strokeWidth={1} strokeLinecap="round"/>
      {/* mouth */}
      <path d={mouth} stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
      {/* cheeks */}
      <ellipse cx={28} cy={60} rx={9} ry={6} fill="#fda4af" opacity={0.4}/>
      <ellipse cx={72} cy={60} rx={9} ry={6} fill="#fda4af" opacity={0.4}/>
      {/* fluffy tail */}
      <circle cx={76} cy={95} r={8} fill="white"/>
      {isAdult && <><rect x={33} y={74} width={34} height={6} rx={3} fill="#7c3aed"/><circle cx={50} cy={80} r={3} fill="#fbbf24"/></>}
      <ellipse cx={36} cy={116} rx={11} ry={9} fill="#e2e8f0"/>
      <ellipse cx={64} cy={116} rx={11} ry={9} fill="#e2e8f0"/>
    </svg>
  );
};

/* ── DRAGON ── */
const DragonSprite = ({ mood, isAdult }) => {
  const isHappy = mood.key==='ecstatic'||mood.key==='happy';
  const isSad   = mood.key==='hungry'||mood.key==='starving';
  const mouth = isHappy ? 'M42,67 Q50,76 58,67' : isSad ? 'M43,70 Q50,65 57,70' : 'M44,68 L56,68';
  return (
    <svg width={170} height={200} viewBox="0 0 100 120" style={{ filter:'drop-shadow(0 8px 20px #05966955)', overflow:'visible' }}>
      <ellipse cx={50} cy={118} rx={22} ry={5} fill="rgba(0,0,0,0.2)"/>
      {/* wings small */}
      <path d="M20,72 L4,52 L22,68 Z" fill="#6ee7b7" opacity={0.7}/>
      <path d="M80,72 L96,52 L78,68 Z" fill="#6ee7b7" opacity={0.7}/>
      {/* body */}
      <ellipse cx={50} cy={88} rx={28} ry={26} fill="#059669"/>
      {/* belly scales */}
      <ellipse cx={50} cy={93} rx={17} ry={16} fill="#6ee7b7"/>
      <ellipse cx={43} cy={86} rx={5} ry={3} fill="#047857" opacity={0.4}/>
      <ellipse cx={57} cy={86} rx={5} ry={3} fill="#047857" opacity={0.4}/>
      <ellipse cx={50} cy={95} rx={5} ry={3} fill="#047857" opacity={0.4}/>
      {/* head */}
      <ellipse cx={50} cy={47} rx={29} ry={27} fill="#059669"/>
      {/* horns */}
      <path d="M33,24 L28,8 L37,22 Z" fill="#047857"/>
      <path d="M67,24 L72,8 L63,22 Z" fill="#047857"/>
      {/* face */}
      <ellipse cx={50} cy={54} rx={19} ry={14} fill="#6ee7b7"/>
      {/* eyes */}
      <ellipse cx={38} cy={44} rx={7} ry={7} fill="#fbbf24"/>
      <ellipse cx={62} cy={44} rx={7} ry={7} fill="#fbbf24"/>
      <ellipse cx={38} cy={44} rx={3} ry={isSad?3:5} fill="#1e293b"/>
      <ellipse cx={62} cy={44} rx={3} ry={isSad?3:5} fill="#1e293b"/>
      <circle cx={36} cy={42} r={1.5} fill="white"/>
      <circle cx={60} cy={42} r={1.5} fill="white"/>
      {/* nostrils */}
      <circle cx={47} cy={58} r={2} fill="#047857"/>
      <circle cx={53} cy={58} r={2} fill="#047857"/>
      {/* mouth */}
      <path d={mouth} stroke="#047857" strokeWidth={2} fill="none" strokeLinecap="round"/>
      {isHappy && <path d="M44,70 L48,74 M52,74 L56,70" stroke="#ef4444" strokeWidth={1.5} strokeLinecap="round"/>}
      {/* spines */}
      <path d="M35,26 L38,14 L41,26 M44,22 L47,10 L50,22 M53,22 L56,10 L59,22 M62,26 L65,14 L68,26" stroke="#047857" strokeWidth={2} fill="none"/>
      {/* tail */}
      <path d="M72,98 Q90,88 88,72 L84,78 L88,72 L82,74" stroke="#059669" strokeWidth={6} fill="none" strokeLinecap="round"/>
      {isAdult && <><ellipse cx={50} cy={73} rx={17} ry={4} fill="#047857" opacity={0.6}/><circle cx={50} cy={73} r={3} fill="#fbbf24"/></>}
      <ellipse cx={36} cy={110} rx={11} ry={9} fill="#059669"/>
      <ellipse cx={64} cy={110} rx={11} ry={9} fill="#059669"/>
    </svg>
  );
};

/* ── FOX ── */
const FoxSprite = ({ mood, isAdult }) => {
  const isHappy = mood.key==='ecstatic'||mood.key==='happy';
  const isSad   = mood.key==='hungry'||mood.key==='starving';
  const mouth = isHappy ? 'M43,67 Q50,73 57,67' : isSad ? 'M43,69 Q50,65 57,69' : 'M44,68 L56,68';
  return (
    <svg width={170} height={200} viewBox="0 0 100 120" style={{ filter:'drop-shadow(0 8px 20px #dc262655)', overflow:'visible' }}>
      <ellipse cx={50} cy={118} rx={22} ry={5} fill="rgba(0,0,0,0.2)"/>
      {/* big fluffy tail */}
      <path d="M74,95 Q100,80 95,55 Q90,40 78,52" stroke="#dc2626" strokeWidth={14} fill="none" strokeLinecap="round"/>
      <path d="M74,95 Q100,80 95,55 Q90,40 78,52" stroke="white" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.6}/>
      {/* body */}
      <ellipse cx={50} cy={88} rx={28} ry={26} fill="#dc2626"/>
      <ellipse cx={50} cy={93} rx={17} ry={16} fill="white"/>
      {/* ears */}
      <path d="M22,40 L14,16 L36,32 Z" fill="#dc2626"/>
      <path d="M22,39 L17,19 L33,32 Z" fill="#fca5a5"/>
      <path d="M78,40 L86,16 L64,32 Z" fill="#dc2626"/>
      <path d="M78,39 L83,19 L67,32 Z" fill="#fca5a5"/>
      {/* head — slightly pointed */}
      <ellipse cx={50} cy={48} rx={29} ry={28} fill="#dc2626"/>
      <ellipse cx={50} cy={57} rx={20} ry={16} fill="white"/>
      {/* eyes */}
      <ellipse cx={38} cy={44} rx={7} ry={7} fill="white"/>
      <ellipse cx={62} cy={44} rx={7} ry={7} fill="white"/>
      <ellipse cx={38} cy={44} rx={3.5} ry={isSad?3:5.5} fill="#1e293b"/>
      <ellipse cx={62} cy={44} rx={3.5} ry={isSad?3:5.5} fill="#1e293b"/>
      <circle cx={36} cy={42} r={1.5} fill="white"/>
      <circle cx={60} cy={42} r={1.5} fill="white"/>
      {/* nose */}
      <ellipse cx={50} cy={60} rx={4} ry={3} fill="#1e293b"/>
      {/* mouth */}
      <path d={mouth} stroke="#1e293b" strokeWidth={1.5} fill="none" strokeLinecap="round"/>
      {/* cheeks */}
      <ellipse cx={27} cy={60} rx={9} ry={6} fill="#fca5a5" opacity={0.5}/>
      <ellipse cx={73} cy={60} rx={9} ry={6} fill="#fca5a5" opacity={0.5}/>
      {isAdult && <><rect x={33} y={72} width={34} height={6} rx={3} fill="#7c3aed"/><circle cx={50} cy={78} r={3} fill="#fbbf24"/></>}
      <ellipse cx={36} cy={110} rx={11} ry={9} fill="#dc2626"/>
      <ellipse cx={64} cy={110} rx={11} ry={9} fill="#dc2626"/>
    </svg>
  );
};

/* ── Animated Pet wrapper ── */
const AnimatedPet = ({ petType, stage, mood, animState, xp }) => {
  const isAdult = stage.key === 'ADULT';
  const props = { mood, isAdult };

  const animStyle = {
    idle:    { animation: 'petIdle 2.2s ease-in-out infinite' },
    happy:   { animation: 'petHappy 0.35s ease-in-out infinite alternate' },
    eat:     { animation: 'petEat 0.12s ease-in-out infinite alternate' },
    sleep:   { animation: 'petSleep 3s ease-in-out infinite' },
    sad:     { animation: 'petSad 2s ease-in-out infinite' },
    evolve:  { animation: 'petEvolve 0.6s ease-in-out 3' },
  }[animState] || { animation: 'petIdle 2.2s ease-in-out infinite' };

  const sprite = stage.key === 'EGG' ? <EggSprite petType={petType} xp={xp}/> :
    petType === 'DOG'    ? <DogSprite    {...props}/> :
    petType === 'RABBIT' ? <RabbitSprite {...props}/> :
    petType === 'DRAGON' ? <DragonSprite {...props}/> :
    petType === 'FOX'    ? <FoxSprite    {...props}/> :
                           <CatSprite    {...props}/>;

  return (
    <div style={{ ...animStyle, display:'inline-block', transformOrigin:'bottom center' }}>
      {sprite}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   UI COMPONENTS
══════════════════════════════════════════════════════════ */

/* ── Pet Selector ── */
const PetSelector = ({ onSelect }) => (
  <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
    <div style={{ fontFamily:'"Press Start 2P",monospace', fontSize:14, color:'#a78bfa', marginBottom:8 }}>🥚 เลือกสัตว์เลี้ยง</div>
    <p style={{ color:'rgba(255,255,255,0.4)', fontSize:13, marginBottom:24 }}>เริ่มจากไข่ → โตขึ้นเมื่อคุณป้อนคำศัพท์</p>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:14, width:'100%', maxWidth:520 }}>
      {Object.entries(PET_TYPES).map(([key,pt]) => (
        <button key={key} onClick={() => onSelect(key)}
          style={{ background:'rgba(255,255,255,0.05)', border:`1.5px solid ${pt.color}44`, borderRadius:16, padding:'18px 12px',
            cursor:'pointer', transition:'all 0.2s', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}
          onMouseEnter={e => { e.currentTarget.style.background=`${pt.color}22`; e.currentTarget.style.borderColor=pt.color; }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor=`${pt.color}44`; }}>
          <span style={{ fontSize:36 }}>{pt.emoji}</span>
          <span style={{ fontFamily:'"Press Start 2P",monospace', fontSize:9, color:'#e2e8f0' }}>{pt.name}</span>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)', textAlign:'center' }}>{pt.desc}</span>
          <div style={{ background:pt.color, color:'#fff', borderRadius:8, padding:'3px 10px', fontSize:11, marginTop:4 }}>เลือก</div>
        </button>
      ))}
    </div>
  </div>
);

/* ── Chat Bubble ── */
const ChatBubble = ({ from, text }) => (
  <div style={{ display:'flex', justifyContent: from==='pet' ? 'flex-start' : 'flex-end', marginBottom:8 }}>
    {from==='pet' && <span style={{ fontSize:20, marginRight:8, alignSelf:'flex-end' }}>🐾</span>}
    <div style={{
      maxWidth:'72%', padding:'8px 14px', borderRadius: from==='pet' ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
      background: from==='pet' ? 'rgba(167,139,250,0.15)' : 'rgba(99,102,241,0.3)',
      border: from==='pet' ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(99,102,241,0.4)',
      color:'#e2e8f0', fontSize:14, lineHeight:1.5,
    }}>{text}</div>
  </div>
);

/* ── Typing indicator ── */
const TypingDots = () => (
  <div style={{ display:'flex', justifyContent:'flex-start', marginBottom:8 }}>
    <span style={{ fontSize:20, marginRight:8, alignSelf:'flex-end' }}>🐾</span>
    <div style={{ padding:'8px 16px', borderRadius:'18px 18px 18px 4px', background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.2)' }}>
      <span style={{ display:'inline-flex', gap:4 }}>
        {[0,1,2].map(i => (
          <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#a78bfa', animation:`dotBounce 1s ${i*0.2}s ease-in-out infinite` }}/>
        ))}
      </span>
    </div>
  </div>
);

/* ── Float text ── */
const FloatText = ({ items }) => (
  <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
    {items.map(ft => (
      <div key={ft.id} style={{ position:'absolute', left:`${ft.x}%`, top:`${ft.y}%`, fontFamily:'"Press Start 2P",monospace', fontSize:11, color:ft.color||'#fbbf24', textShadow:`0 0 10px ${ft.color||'#fbbf24'}`, animation:'floatUp 1.4s ease-out forwards', whiteSpace:'nowrap', transform:'translateX(-50%)' }}>{ft.text}</div>
    ))}
  </div>
);

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
const DRAIN = 0.5;
const SYNC_EVERY = 30;

export default function Pet() {
  const navigate  = useNavigate();
  const { user }  = useContext(AuthContext);

  // ── state ──
  const [hunger,      setHunger]      = useState(60);
  const [xp,          setXp]          = useState(0);
  const [petName,     setPetName]      = useState('น้องฟัฟฟี่');
  const [petType,     setPetType]      = useState(null); // null = not chosen
  const [totalWords,  setTotalWords]   = useState(0);
  const [wordHistory, setWordHistory]  = useState([]);
  const [loadingState,setLoadingState] = useState(true);

  const [feedInput,   setFeedInput]    = useState('');
  const [chatInput,   setChatInput]    = useState('');
  const [chatMsgs,    setChatMsgs]     = useState([{ from:'pet', text:'สวัสดี! พิมพ์คุยกับฉันได้เลยนะ~ หรือจะให้อาหารก็ได้ 🐾' }]);
  const [isTyping,    setIsTyping]     = useState(false);
  const [activeTab,   setActiveTab]    = useState('chat'); // 'chat' | 'feed'

  const [animState,   setAnimState]    = useState('idle');
  const [floats,      setFloats]       = useState([]);
  const [feedLoading, setFeedLoading]  = useState(false);
  const [feedStatus,  setFeedStatus]   = useState(null);
  const [editingName, setEditingName]  = useState(false);
  const [tempName,    setTempName]     = useState('');
  const [prevStageKey,setPrevStageKey] = useState('EGG');

  const chatEndRef = useRef(null);
  const feedRef    = useRef(null);
  const floatId    = useRef(0);
  const syncTimer  = useRef(0);
  const hungerRef  = useRef(hunger);
  hungerRef.current = hunger;

  const mood  = getMood(hunger);
  const stage = getStage(xp);

  // ── scroll chat ──
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [chatMsgs, isTyping]);

  // ── stage evolution effect ──
  useEffect(() => {
    if (prevStageKey !== stage.key) {
      setPrevStageKey(stage.key);
      setAnimState('evolve');
      setChatMsgs(m => [...m, { from:'pet', text: stage.key==='BABY' ? '🥚✨ ฉันฟักออกมาแล้ว! สวัสดีนะ~' : '✨ ฉันโตแล้ว! ขอบคุณที่เลี้ยงดูนะ 🎉' }]);
      setTimeout(() => setAnimState('idle'), 2000);
    }
  }, [stage.key, prevStageKey]);

  // ── load from server ──
  useEffect(() => {
    api.get('/pet/state').then(res => {
      const { state, words } = res.data;
      if (state) {
        const elapsed = (Date.now() - new Date(state.updated_at).getTime()) / 1000;
        setHunger(Math.max(0, state.hunger - elapsed * DRAIN));
        setPetName(state.pet_name);
        setPetType(state.pet_type || null);
        setXp(state.xp || 0);
        setTotalWords(state.total_words || 0);
        setPrevStageKey(getStage(state.xp||0).key);
      }
      if (words) setWordHistory(words);
    }).catch(()=>{}).finally(()=>setLoadingState(false));
  }, []);

  // ── hunger drain ──
  useEffect(() => {
    const iv = setInterval(() => {
      setHunger(h => Math.max(0, h - DRAIN));
      syncTimer.current++;
      if (syncTimer.current >= SYNC_EVERY) {
        syncTimer.current = 0;
        api.put('/pet/state', { hunger: hungerRef.current }).catch(()=>{});
      }
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── helpers ──
  const addFloat = (text, color, x, y) => {
    const id = ++floatId.current;
    setFloats(f => [...f, { id, text, color, x: x??30+Math.random()*40, y: y??15+Math.random()*20 }]);
    setTimeout(() => setFloats(f => f.filter(ft => ft.id!==id)), 1500);
  };

  const triggerAnim = (a, ms=900) => {
    setAnimState(a);
    setTimeout(() => setAnimState('idle'), ms);
  };

  // ── select pet ──
  const handleSelectPet = (type) => {
    setPetType(type);
    api.put('/pet/state', { pet_type: type }).catch(()=>{});
  };

  // ── chat ──
  const sendChat = useCallback(() => {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatInput('');
    setChatMsgs(m => [...m, { from:'user', text: msg }]);
    setIsTyping(true);
    triggerAnim('happy', 600);
    setTimeout(() => {
      setIsTyping(false);
      const reply = getPetResponse(msg, mood, stage, petType);
      setChatMsgs(m => [...m, { from:'pet', text: reply }]);
    }, 700 + Math.random()*600);
  }, [chatInput, mood, stage, petType]);

  // ── feed ──
  const feedPet = useCallback(async () => {
    const word = feedInput.trim();
    if (!word || feedLoading) return;
    if (!isValidWord(word)) {
      setFeedStatus({ ok:false, msg:'กรุณาพิมพ์ตัวอักษรเท่านั้น' });
      return;
    }
    setFeedStatus(null);
    setFeedLoading(true);
    try {
      const res = await api.post('/pet/feed', { word });
      const { ok, status, pts, usedBy, xpGain, newXp } = res.data;
      if (!ok) {
        const msg = status==='duplicate'
          ? (usedBy==='คุณเอง' ? 'คุณเคยใช้คำนี้ไปแล้ว!' : `คำ "${word}" มีคนอื่นใช้แล้ว (${usedBy})`)
          : 'คำไม่ถูกต้อง';
        setFeedStatus({ ok:false, msg });
        addFloat('ซ้ำ! 🚫', '#ef4444');
        setFeedInput('');
        return;
      }
      setHunger(h => Math.min(100, h + pts));
      setXp(newXp ?? xp + (xpGain||word.length));
      setTotalWords(t => t+1);
      setWordHistory(wh => [{ word: word.toLowerCase() }, ...wh.slice(0,49)]);
      setFeedInput('');
      triggerAnim('eat', 900);
      const color = pts>=24?'#10b981':pts>=15?'#fbbf24':'#a78bfa';
      addFloat(`+${pts} 🍖`, color);
      if (word.length>=8) addFloat('คำยาวมาก! 🔥', '#f97316', 60, 10);
      // pet reacts
      setTimeout(() => {
        const reacts = pts>=24 ? ['อร่อยมากๆ! ขอบคุณนะ~','อิ่มขึ้นเลย! 😋'] : ['กินแล้ว~','ขอบคุณ 😊'];
        setChatMsgs(m => [...m, { from:'pet', text: rnd(reacts) }]);
      }, 1000);
    } catch {
      setFeedStatus({ ok:false, msg:'เกิดข้อผิดพลาด กรุณาลองใหม่' });
    } finally {
      setFeedLoading(false);
      feedRef.current?.focus();
    }
  }, [feedInput, feedLoading, xp]);

  const saveName = (name) => { setPetName(name); api.put('/pet/state',{pet_name:name}).catch(()=>{}); };

  // ── render ──
  if (loadingState) return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#a78bfa', fontFamily:'"Press Start 2P",monospace', fontSize:12 }}>กำลังโหลด...</div>
    </div>
  );

  if (!petType) return <PetSelector onSelect={handleSelectPet}/>;

  const { color: pColor } = PET_TYPES[petType] || PET_TYPES.CAT;
  const hpPct = (hunger/100)*100;
  const currentStage = stage;
  const nextStage    = STAGES[STAGES.indexOf(currentStage)+1];
  const xpInStage    = xp - currentStage.minXp;
  const xpNeeded     = nextStage ? nextStage.minXp - currentStage.minXp : null;
  const stagePct     = xpNeeded ? Math.min(100,(xpInStage/xpNeeded)*100) : 100;

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', display:'flex', flexDirection:'column', maxHeight:'100vh', overflow:'hidden' }}>

      {/* Nav */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'rgba(0,0,0,0.2)', flexShrink:0 }}>
        <button onClick={() => navigate('/dashboard')} style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:10, padding:'7px 14px', color:'#fff', cursor:'pointer', fontSize:13 }}>← กลับ</button>
        <span style={{ fontFamily:'"Press Start 2P",monospace', fontSize:11, color:'#a78bfa' }}>🐾 สัตว์เลี้ยง</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>📊 {totalWords} คำ</span>
          <button onClick={() => { setPetType(null); api.put('/pet/state',{pet_type:''}).catch(()=>{}); }}
            style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'4px 10px', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:11 }}>
            เปลี่ยนสัตว์เลี้ยง
          </button>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ flex:1, overflowY:'auto', padding:'12px 16px 0', display:'flex', flexDirection:'column', gap:12, maxWidth:500, margin:'0 auto', width:'100%' }}>

          {/* Pet card */}
          <div style={{ background:'rgba(255,255,255,0.05)', border:`1.5px solid ${pColor}44`, borderRadius:20, padding:'16px 20px', position:'relative', boxShadow:`0 0 30px ${pColor}15` }}>
            <FloatText items={floats}/>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>

              {/* Sprite */}
              <div style={{ flexShrink:0 }}>
                <AnimatedPet petType={petType} stage={stage} mood={mood} animState={animState} xp={xp}/>
              </div>

              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                {/* name */}
                {editingName ? (
                  <input autoFocus value={tempName} onChange={e=>setTempName(e.target.value)}
                    onBlur={()=>{ saveName(tempName||petName); setEditingName(false); }}
                    onKeyDown={e=>{ if(e.key==='Enter'){ saveName(tempName||petName); setEditingName(false); } }}
                    style={{ fontFamily:'"Press Start 2P",monospace', fontSize:11, background:'rgba(167,139,250,0.15)', border:'1px solid #a78bfa', borderRadius:8, padding:'4px 8px', color:'#fff', outline:'none', width:'100%', marginBottom:6 }}/>
                ) : (
                  <button onClick={()=>{ setTempName(petName); setEditingName(true); }} style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'block', marginBottom:6 }}>
                    <span style={{ fontFamily:'"Press Start 2P",monospace', fontSize:11, color:'#e2e8f0' }}>{petName} ✏️</span>
                  </button>
                )}

                {/* mood */}
                <div style={{ display:'inline-flex', alignItems:'center', gap:4, background:`${mood.color}22`, border:`1px solid ${mood.color}44`, borderRadius:12, padding:'2px 10px', marginBottom:8 }}>
                  <span style={{ fontSize:12 }}>{mood.emoji}</span>
                  <span style={{ fontFamily:'"Press Start 2P",monospace', fontSize:7, color:mood.color }}>{mood.label}</span>
                </div>

                {/* stage */}
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:4 }}>{currentStage.label} {nextStage && `→ ${nextStage.label}`}</div>

                {/* hunger bar */}
                <div style={{ marginBottom:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>🍖 ความอิ่ม</span>
                    <span style={{ fontSize:10, color:mood.color }}>{Math.round(hunger)}/100</span>
                  </div>
                  <div style={{ height:10, background:'rgba(0,0,0,0.4)', borderRadius:5, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ height:'100%', width:`${hpPct}%`, borderRadius:5, background:`linear-gradient(90deg,${mood.color}88,${mood.color})`, transition:'width 0.4s ease', boxShadow:`0 0 8px ${mood.color}66` }}/>
                  </div>
                </div>

                {/* XP bar */}
                {xpNeeded && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>⭐ XP</span>
                      <span style={{ fontSize:10, color:'#a78bfa' }}>{xpInStage}/{xpNeeded}</span>
                    </div>
                    <div style={{ height:8, background:'rgba(0,0,0,0.4)', borderRadius:4, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ height:'100%', width:`${stagePct}%`, borderRadius:4, background:'linear-gradient(90deg,#7c3aed88,#a78bfa)', transition:'width 0.6s ease' }}/>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tab */}
          <div style={{ display:'flex', gap:8 }}>
            {[['chat','💬 พูดคุย'],['feed','🍖 ให้อาหาร']].map(([key,label]) => (
              <button key={key} onClick={()=>setActiveTab(key)}
                style={{ flex:1, padding:'9px 0', borderRadius:12, border:`1.5px solid ${activeTab===key?'#a78bfa':'rgba(255,255,255,0.1)'}`, background: activeTab===key?'rgba(167,139,250,0.2)':'rgba(255,255,255,0.04)', color: activeTab===key?'#a78bfa':'rgba(255,255,255,0.5)', cursor:'pointer', fontFamily:'"Press Start 2P",monospace', fontSize:9 }}>
                {label}
              </button>
            ))}
          </div>

          {/* Chat tab */}
          {activeTab==='chat' && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, padding:14, height:200, overflowY:'auto' }}>
                {chatMsgs.map((m,i) => <ChatBubble key={i} from={m.from} text={m.text}/>)}
                {isTyping && <TypingDots/>}
                <div ref={chatEndRef}/>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter') sendChat(); }}
                  placeholder="พิมพ์คุยกับน้องได้เลย..."
                  style={{ flex:1, padding:'11px 14px', background:'rgba(255,255,255,0.07)', border:'1.5px solid rgba(255,255,255,0.12)', borderRadius:12, color:'#fff', fontSize:14, outline:'none', fontFamily:'inherit' }}
                  autoFocus={activeTab==='chat'}/>
                <button onClick={sendChat} style={{ padding:'11px 18px', background:'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:12, color:'#fff', fontFamily:'"Press Start 2P",monospace', fontSize:9, cursor:'pointer' }}>ส่ง</button>
              </div>
            </div>
          )}

          {/* Feed tab */}
          {activeTab==='feed' && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)', textAlign:'center' }}>💡 ยิ่งคำยาว น้องยิ่งอิ่มนาน • 1 ตัวอักษร = +3 ความอิ่ม +1 XP</div>
              <div style={{ display:'flex', gap:8 }}>
                <input ref={feedRef} value={feedInput}
                  onChange={e=>{ setFeedInput(e.target.value); setFeedStatus(null); }}
                  onKeyDown={e=>{ if(e.key==='Enter') feedPet(); }}
                  placeholder="พิมพ์คำศัพท์..."
                  disabled={feedLoading}
                  style={{ flex:1, padding:'11px 14px', background:'rgba(255,255,255,0.07)', border:'1.5px solid rgba(255,255,255,0.12)', borderRadius:12, color:'#fff', fontSize:14, outline:'none', fontFamily:'inherit', opacity: feedLoading?0.6:1 }}
                  autoFocus={activeTab==='feed'}/>
                <button onClick={feedPet} disabled={feedLoading||!feedInput.trim()}
                  style={{ padding:'11px 16px', background: feedLoading?'rgba(124,58,237,0.3)':'linear-gradient(135deg,#7c3aed,#a78bfa)', border:'none', borderRadius:12, color:'#fff', fontFamily:'"Press Start 2P",monospace', fontSize:9, cursor: feedLoading?'not-allowed':'pointer', minWidth:60 }}>
                  {feedLoading?'...':'ให้\nอาหาร'}
                </button>
              </div>
              {feedInput.trim().length>=2 && !feedLoading && (
                <div style={{ fontSize:12, color:'#a78bfa' }}>คำนี้ยาว {feedInput.trim().length} ตัว → +{feedInput.trim().length*3} ความอิ่ม +{feedInput.trim().length} XP</div>
              )}
              {feedStatus && (
                <div style={{ background: feedStatus.ok?'#10b98122':'#ef444422', border:`1px solid ${feedStatus.ok?'#10b981':'#ef4444'}`, borderRadius:10, padding:'10px 14px', color: feedStatus.ok?'#6ee7b7':'#fca5a5', fontSize:13 }}>
                  {feedStatus.ok?'✅':'❌'} {feedStatus.msg}
                </div>
              )}
              {/* Word history */}
              {wordHistory.length>0 && (
                <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:12, padding:'10px 14px' }}>
                  <div style={{ fontFamily:'"Press Start 2P",monospace', fontSize:7, color:'#a78bfa', marginBottom:8 }}>📖 คำที่ป้อนแล้ว</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, maxHeight:90, overflowY:'auto' }}>
                    {wordHistory.map((w,i) => (
                      <span key={i} style={{ background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.25)', borderRadius:8, padding:'2px 8px', fontSize:12, color:'#c4b5fd' }}>{w.word}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ height:16 }}/>
        </div>
      </div>

      <style>{`
        @keyframes petIdle  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes petHappy { 0%{transform:translateY(0) scale(1)} 100%{transform:translateY(-10px) scale(1.08)} }
        @keyframes petEat   { 0%{transform:rotate(-6deg)} 100%{transform:rotate(6deg)} }
        @keyframes petSleep { 0%,100%{transform:scale(1) translateY(0)} 50%{transform:scale(1.03) translateY(-2px)} }
        @keyframes petSad   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(5px)} }
        @keyframes petEvolve{ 0%{transform:scale(1)} 50%{transform:scale(1.2)} 100%{transform:scale(1)} }
        @keyframes floatUp  { 0%{opacity:1;transform:translateX(-50%) translateY(0)} 100%{opacity:0;transform:translateX(-50%) translateY(-55px)} }
        @keyframes dotBounce{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
    </div>
  );
}
