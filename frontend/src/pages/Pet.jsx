import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { COSTUMES, RARITY, COSTUME_LIST } from '../constants/petLoot';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

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

/* ── ระบบเจริญเติบโต 10 ขั้น ──
   tier  = ชุดสไปรท์พื้นฐานที่ใช้วาด (EGG / BABY / ADULT / ELDER)
   scale = ขนาดตัวเทียบกับสไปรท์พื้นฐาน
   power = พลังพื้นฐานของขั้นนั้น
   fx    = เอฟเฟกต์พิเศษที่ปลดล็อกในขั้นนั้น                        */
const STAGES = [
  { key:'EGG',      minXp:0,    label:'🥚 ไข่เวทมนตร์',  short:'ไข่',        tier:'EGG',   scale:1.00, power:0,   fx:{},
    desc:'เปลือกเรืองแสงตามธาตุ ยังไม่ฟัก' },
  { key:'NEWBORN',  minXp:40,   label:'🐣 ลูกอ่อนแรกเกิด', short:'แรกเกิด',  tier:'BABY',  scale:0.72, power:5,   fx:{},
    desc:'ตัวจิ๋ว ตาโต น่ารักสุด ๆ พลังต่ำมาก' },
  { key:'TODDLER',  minXp:110,   label:'🍼 วัยเตาะแตะ',   short:'เตาะแตะ',   tier:'BABY',  scale:0.84, power:12,  fx:{},
    desc:'เริ่มเดินเตาะแตะ หาง/ปีกสั้น ๆ ชอบเล่น' },
  { key:'CHILD',    minXp:230,  label:'🧒 วัยเด็ก',      short:'วัยเด็ก',   tier:'BABY',  scale:0.96, power:24,  fx:{ trinket:true },
    desc:'ตัวใหญ่ขึ้นเล็กน้อย เริ่มมีสีสันและเครื่องประดับเล็ก ๆ' },
  { key:'PRETEEN',  minXp:430,  label:'✨ วัยรุ่นต้น',   short:'รุ่นต้น',   tier:'ADULT', scale:0.86, power:40,  fx:{ runes:0.35 },
    desc:'รูปร่างเริ่มเท่ มีลวดลายเรืองแสงอ่อน ๆ' },
  { key:'TEEN',     minXp:760,  label:'⚡ วัยรุ่น',      short:'วัยรุ่น',   tier:'ADULT', scale:0.96, power:65,  fx:{ runes:0.7 },
    desc:'พลังพุ่ง พัฒนารูปทรงชัดเจน (ปีก เขา หางยาว)' },
  { key:'YOUNG',    minXp:1300,  label:'🌟 วัยหนุ่มสาว',  short:'หนุ่มสาว',  tier:'ADULT', scale:1.04, power:95,  fx:{ runes:1, aura:true },
    desc:'สง่างาม เริ่มมีออร่าธาตุ' },
  { key:'ADULT',    minXp:2150, label:'⚔️ โตเต็มวัย',    short:'โตเต็มวัย', tier:'ADULT', scale:1.12, power:140, fx:{ runes:1, aura:true, skill:true },
    desc:'รูปลักษณ์สมบูรณ์ พลังสูง ใช้ทักษะพิเศษได้เต็มที่' },
  { key:'EXPERT',   minXp:3500, label:'💎 ผู้เชี่ยวชาญ', short:'เชี่ยวชาญ', tier:'ELDER', scale:1.02, power:210, fx:{ runes:1, aura:true, skill:true, crystal:true, twinWings:true },
    desc:'เกราะคริสตัล ปีกคู่ เครื่องประดับเวท พลังพิเศษปลดล็อก' },
  { key:'LEGEND',   minXp:5600, label:'👑 ตำนาน',        short:'ตำนาน',     tier:'ELDER', scale:1.16, power:320, fx:{ runes:1, aura:true, skill:true, crystal:true, twinWings:true, particles:true, ultimate:true },
    desc:'รูปลักษณ์สุดอลังการ มีเอฟเฟกต์อนุภาค พลังสูงสุด + สกิลอัลติเมท' },
];

/* ── ธาตุของสัตว์เลี้ยง (เลือกครั้งเดียว ถาวร) ── */
const ELEMENTS = {
  FIRE:  { key:'FIRE',  name:'อัคคี',   emoji:'🔥', color:'#f97316', aura:'#fdba74', strong:'GRASS', weak:'WATER',
           desc:'ดาเมจแรง เผาผลาญทุกสิ่ง', trait:'แข็งแกร่งต่อ พฤกษา · อ่อนแอต่อ วารี' },
  WATER: { key:'WATER', name:'วารี',    emoji:'💧', color:'#38bdf8', aura:'#7dd3fc', strong:'FIRE',  weak:'GRASS',
           desc:'ลื่นไหล ปรับตัวเก่ง',    trait:'แข็งแกร่งต่อ อัคคี · อ่อนแอต่อ พฤกษา' },
  GRASS: { key:'GRASS', name:'พฤกษา',   emoji:'🍃', color:'#22c55e', aura:'#86efac', strong:'WATER', weak:'FIRE',
           desc:'ฟื้นตัวไว ทนทาน',        trait:'แข็งแกร่งต่อ วารี · อ่อนแอต่อ อัคคี' },
  LIGHT: { key:'LIGHT', name:'แสงสว่าง', emoji:'✨', color:'#fbbf24', aura:'#fde68a', strong:'DARK',  weak:'LIGHT',
           desc:'บริสุทธิ์ ศักดิ์สิทธิ์',  trait:'แข็งแกร่งต่อ ความมืด' },
  DARK:  { key:'DARK',  name:'ความมืด',  emoji:'🌑', color:'#a855f7', aura:'#d8b4fe', strong:'LIGHT', weak:'DARK',
           desc:'ลึกลับ ดาเมจเฉียบคม',    trait:'แข็งแกร่งต่อ แสงสว่าง' },
};
const getElem = (k) => ELEMENTS[k] || null;
/* ตัวคูณดาเมจตามธาตุ — ต้องตรงกับ ELEM_CHART ใน backend/server.js */
const ELEM_CHART = {
  FIRE:  { GRASS:1.5, WATER:0.7 },
  WATER: { FIRE:1.5,  GRASS:0.7 },
  GRASS: { WATER:1.5, FIRE:0.7 },
  LIGHT: { DARK:1.5,  LIGHT:0.8 },
  DARK:  { LIGHT:1.5, DARK:0.8 },
};
const elemMul = (a,d) => (a && d ? (ELEM_CHART[a]?.[d] ?? 1) : 1);

/* ── ทักษะการโจมตี ── */
const ATK_LV_MAX  = 20;
const STAMINA_MAX = 5;
const atkXpNeeded = (lv) => 40 + (lv-1)*28;   // ต้องตรงกับ backend/routes/petRoutes.js

/* ── ท่าประลอง PvP (ต้องตรงกับ ARENA_MOVES ใน backend) ── */
const MOVES = [
  { key:'strike', label:'โจมตีปกติ', emoji:'⚔️', color:'#fbbf24', desc:'แม่นยำ 95% · ดาเมจมาตรฐาน' },
  { key:'heavy',  label:'ทุ่มพลัง',  emoji:'💥', color:'#ef4444', desc:'แม่นยำ 62% · ดาเมจ ×1.85' },
  { key:'guard',  label:'ตั้งการ์ด', emoji:'🛡️', color:'#38bdf8', desc:'ลดดาเมจครั้งถัดไป 60% + ฟื้น HP 9%' },
];

/* ── สถานะสุขภาพ ── */
const HEALTH = {
  healthy: { key:'healthy', label:'แข็งแรง',  emoji:'💚', color:'#10b981', powerMul:1,    cure:null },
  sick:    { key:'sick',    label:'ป่วย',     emoji:'🤒', color:'#84cc16', powerMul:0.7,  cure:'herb',
             hint:'ต้องให้ยาสมุนไพรเวท + พักผ่อน' },
  injured: { key:'injured', label:'บาดเจ็บ',  emoji:'🩹', color:'#f87171', powerMul:0.65, cure:'kit',
             hint:'ต้องใช้ไอเทมรักษา + เวลาพัก' },
};
const ITEMS = {
  herb: { key:'herb', name:'ยาสมุนไพรเวท',  emoji:'🌿', cures:'sick',    desc:'รักษาอาการป่วย' },
  kit:  { key:'kit',  name:'ชุดรักษาเวท',   emoji:'🧪', cures:'injured', desc:'รักษาบาดแผล' },
};
const REST_MS = 60 * 1000;   // เวลาพักหลังใช้ไอเทม
const SELF_REST_MS = 10 * 60 * 1000;  // พักเองโดยไม่ใช้ไอเทม — ช้ากว่ามาก แต่ไม่ทำให้ผู้เล่นติดตาย
const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
};

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
/* ป้อนได้ครั้งละ 1 คำเท่านั้น — ห้ามเว้นวรรคทุกชนิด */
function isValidWord(w) { return /^[a-zA-Zก-๙฀-๿-]+$/.test(w); }
function hasSpace(w) { return /\s/.test(w); }
/* รางวัลจากการป้อนคำ — ต้องตรงกับ feedRewards() ใน backend/routes/petRoutes.js */
function feedRewards(len) {
  let xp = len * 4;
  if (len >= 5)  xp += 6;
  if (len >= 8)  xp += 14;
  if (len >= 12) xp += 25;
  return { xp, pts: len * 4 };
}
function rnd(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

function getHealth(k) { return HEALTH[k] || HEALTH.healthy; }
function getPower(stage, healthKey) { return Math.round(stage.power * getHealth(healthKey).powerMul); }

/* ── Chat response ── */
function getPetResponse(msg, mood, stage, petType, healthKey='healthy') {
  if (stage.key==='EGG') return rnd(['...','*โยกตัว*','*ไม่มีเสียง*','*เปลือกไข่สั่น นิดหน่อย*']);
  const lower = msg.toLowerCase();
  if (healthKey==='sick' && Math.random()<0.6)
    return rnd(['ตัวร้อน... ไม่ค่อยมีแรงเลย 🤒','ขอยาสมุนไพรเวทหน่อยได้ไหม... 😷','*ไอ* ...ขอพักก่อนนะ']);
  if (healthKey==='injured' && Math.random()<0.6)
    return rnd(['เจ็บตรงนี้... เดินไม่ค่อยไหว 🩹','ขอไอเทมรักษาหน่อยนะ... 😖','แผลยังไม่หาย เคลื่อนไหวช้าหน่อยนะ']);
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
  if (stage.tier==='ELDER') return rnd(['ผู้เฒ่ารู้แล้ว... ความรู้คือพลัง 📖','ใช้เวลานานมากกว่าจะถึงจุดนี้~','ปัญญาเกิดจากการฝึกฝน ✨']);
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

/* ── เอฟเฟกต์ตามขั้นการเจริญเติบโต (ซ้อนทับสไปรท์) ── */
const StageFX = ({ stage, color }) => {
  const fx = stage.fx || {};
  if (!fx.trinket && !fx.runes && !fx.aura && !fx.crystal && !fx.particles) return null;
  return (
    <svg viewBox="0 0 100 100" style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'visible' }}>
      {/* ออร่าธาตุ */}
      {fx.aura && (
        <>
          <circle cx={50} cy={52} r={44} fill="none" stroke={color} strokeWidth={0.8} opacity={0.35}
            style={{ animation:'auraPulse 2.8s ease-in-out infinite' }}/>
          <circle cx={50} cy={52} r={38} fill={color} opacity={0.07}
            style={{ animation:'auraPulse 2.8s 0.6s ease-in-out infinite' }}/>
        </>
      )}
      {/* ลวดลายเรืองแสง — เข้มขึ้นตามขั้น */}
      {fx.runes > 0 && ['◈','✧','⌁','✦'].slice(0, Math.ceil(fx.runes*4)).map((r,i) => (
        <text key={r} x={[14,86,20,80][i]} y={[36,40,74,70][i]} fontSize={7} textAnchor="middle"
          fill={color} opacity={0.4 + fx.runes*0.4}
          style={{ animation:`runeFloat ${2.6+i*0.4}s ${i*0.3}s ease-in-out infinite` }}>{r}</text>
      ))}
      {/* เครื่องประดับเล็ก ๆ (วัยเด็ก) */}
      {fx.trinket && (
        <>
          <circle cx={50} cy={86} r={3} fill="#fbbf24" opacity={0.9}/>
          <path d="M40,84 Q50,90 60,84" stroke="#fbbf24" strokeWidth={1.2} fill="none" opacity={0.8}/>
        </>
      )}
      {/* เกราะคริสตัล + ปีกคู่ (ผู้เชี่ยวชาญ+) */}
      {fx.crystal && (
        <>
          <path d="M50,64 L58,72 L50,84 L42,72 Z" fill="#a5f3fc" opacity={0.55} stroke="#67e8f9" strokeWidth={0.8}/>
          <path d="M50,66 L55,72 L50,80 L45,72 Z" fill="#e0f2fe" opacity={0.7}/>
          {fx.twinWings && [-1,1].map(s => (
            <g key={s} opacity={0.5}>
              <path d={`M${50+s*26},44 Q${50+s*46},24 ${50+s*40},52 Z`} fill="#a5f3fc"/>
              <path d={`M${50+s*24},56 Q${50+s*44},44 ${50+s*36},66 Z`} fill="#67e8f9" opacity={0.7}/>
            </g>
          ))}
        </>
      )}
      {/* เอฟเฟกต์อนุภาค (ตำนาน) */}
      {fx.particles && [...Array(10)].map((_,i) => (
        <circle key={i} cx={16+i*7.6} cy={92} r={1.6+(i%3)*0.7} fill={i%2?'#fbbf24':color} opacity={0.85}
          style={{ animation:`particleRise ${2.2+(i%4)*0.5}s ${i*0.25}s linear infinite` }}/>
      ))}
    </svg>
  );
};

/* ── เครื่องแต่งกายเฉพาะ "วัย" — ทำให้ทั้ง 10 ขั้นหน้าตาไม่ซ้ำกัน ──
   วาดทับสไปรท์พื้นฐานในระบบพิกัด 100×100 เดียวกับ StageFX          */
const AgeDecor = ({ stageKey, color, elemColor }) => {
  const c = elemColor || color;
  const wrap = (children) => (
    <svg viewBox="0 0 100 100" style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'visible' }}>
      {children}
    </svg>
  );

  switch (stageKey) {
    case 'NEWBORN':   // 🐣 จุกนม + เปลือกไข่ค้างบนหัว
      return wrap(<>
        <path d="M30,16 L38,8 L44,17 L52,7 L60,17 L68,9 L70,20 Q50,26 30,20 Z" fill="#fef3c7" opacity={0.95} stroke="#fbbf24" strokeWidth={0.7}/>
        <circle cx={62} cy={72} r={5} fill="#fda4af" opacity={0.9}/>
        <circle cx={62} cy={72} r={2.4} fill="#fff" opacity={0.9}/>
        <text x={20} y={30} fontSize={9} opacity={0.85}>💤</text>
      </>);
    case 'TODDLER':   // 🍼 ผ้ากันเปื้อน + ผมจุกเดียว
      return wrap(<>
        <path d="M36,66 Q50,62 64,66 L62,82 Q50,88 38,82 Z" fill="#fef9c3" opacity={0.92} stroke="#facc15" strokeWidth={0.8}/>
        <circle cx={50} cy={74} r={3} fill={c} opacity={0.6}/>
        <path d="M50,18 Q52,8 56,12 Q54,16 52,20 Z" fill={c} opacity={0.85}/>
        <circle cx={50} cy={19} r={2.4} fill="#fbbf24"/>
      </>);
    case 'CHILD':     // 🧒 หมวกแก๊ป + กระเป๋าสะพาย
      return wrap(<>
        <path d="M28,26 Q50,10 72,26 L72,30 L28,30 Z" fill={c} opacity={0.9}/>
        <path d="M28,29 L18,33 Q30,36 42,32 Z" fill={c} opacity={0.75}/>
        <circle cx={50} cy={17} r={2.6} fill="#fbbf24"/>
        <path d="M32,58 L68,72" stroke="#92400e" strokeWidth={2.4} opacity={0.8}/>
        <rect x={62} y={68} width={13} height={11} rx={2.5} fill="#b45309" opacity={0.9}/>
      </>);
    case 'PRETEEN':   // ✨ ผ้าคาดหัว + ผ้าพันคอ
      return wrap(<>
        <rect x={24} y={30} width={52} height={6} rx={3} fill={c} opacity={0.9}/>
        <path d="M76,33 L88,28 L86,38 Z" fill={c} opacity={0.75} style={{ animation:'runeFloat 2.4s ease-in-out infinite' }}/>
        <path d="M34,62 Q50,70 66,62 L64,70 Q50,77 36,70 Z" fill={c} opacity={0.7}/>
        <path d="M64,68 L74,84 L68,86 L60,72 Z" fill={c} opacity={0.55}/>
      </>);
    case 'TEEN':      // ⚡ สนับไหล่ + เข็มขัดพลัง
      return wrap(<>
        {[-1,1].map(s => (
          <path key={s} d={`M${50+s*26},56 Q${50+s*36},50 ${50+s*34},64 Q${50+s*26},66 ${50+s*26},56 Z`}
            fill={c} opacity={0.85} stroke="#fff" strokeOpacity={0.3} strokeWidth={0.6}/>
        ))}
        <rect x={32} y={76} width={36} height={6} rx={3} fill="#334155" opacity={0.9}/>
        <circle cx={50} cy={79} r={3.4} fill={c}/>
        <text x={50} y={81.5} fontSize={4} textAnchor="middle" fill="#fff" opacity={0.9}>⚡</text>
      </>);
    case 'YOUNG':     // 🌟 ผ้าคลุมไหล่ + เข็มกลัดธาตุ
      return wrap(<>
        <path d="M28,54 Q50,48 72,54 L80,92 Q50,100 20,92 Z" fill={c} opacity={0.28}/>
        <path d="M28,54 Q50,48 72,54 L74,62 Q50,57 26,62 Z" fill={c} opacity={0.6}/>
        <circle cx={50} cy={57} r={4} fill="#fbbf24" opacity={0.95}/>
        <circle cx={50} cy={57} r={1.8} fill="#fff"/>
      </>);
    case 'ADULT':     // ⚔️ เกราะเต็มยศ + อาวุธประจำตัว
      return wrap(<>
        {[-1,1].map(s => (
          <g key={s}>
            <path d={`M${50+s*28},54 Q${50+s*40},48 ${50+s*38},66 Q${50+s*28},68 ${50+s*28},54 Z`} fill="#94a3b8" opacity={0.9}/>
            <path d={`M${50+s*30},57 L${50+s*36},60`} stroke="#e2e8f0" strokeWidth={1} opacity={0.8}/>
          </g>
        ))}
        <path d="M38,64 L62,64 L60,80 L50,86 L40,80 Z" fill="#cbd5e1" opacity={0.85}/>
        <path d="M44,66 L56,66 L55,78 L50,82 L45,78 Z" fill={c} opacity={0.8}/>
        <line x1={84} y1={26} x2={84} y2={82} stroke="#78716c" strokeWidth={2.6} strokeLinecap="round"/>
        <path d="M78,30 L84,14 L90,30 L84,34 Z" fill="#e2e8f0" stroke={c} strokeWidth={0.9}/>
      </>);
    case 'EXPERT':    // 💎 มงกุฎคริสตัล + วงแหวนเวท
      return wrap(<>
        <path d="M30,26 L36,12 L43,22 L50,6 L57,22 L64,12 L70,26 Z" fill="#a5f3fc" opacity={0.92} stroke="#67e8f9" strokeWidth={0.8}/>
        {[[36,20],[50,14],[64,20]].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r={2.4} fill={c} opacity={0.95}/>
        ))}
        <ellipse cx={50} cy={52} rx={48} ry={13} fill="none" stroke={c} strokeWidth={1} opacity={0.5}
          style={{ animation:'auraPulse 3s ease-in-out infinite' }}/>
        <ellipse cx={50} cy={64} rx={42} ry={11} fill="none" stroke="#67e8f9" strokeWidth={0.8} opacity={0.4}
          style={{ animation:'auraPulse 3s 1s ease-in-out infinite' }}/>
      </>);
    case 'LEGEND':    // 👑 มงกุฎทองคำ + เสื้อคลุมตำนาน + ลูกแก้วลอย
      return wrap(<>
        <path d="M22,52 Q50,44 78,52 L88,96 Q50,106 12,96 Z" fill={c} opacity={0.3}/>
        <path d="M22,52 Q50,44 78,52 L80,62 Q50,54 20,62 Z" fill="#fbbf24" opacity={0.55}/>
        <path d="M26,26 L32,8 L41,20 L50,2 L59,20 L68,8 L74,26 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth={1}/>
        <rect x={24} y={25} width={52} height={7} rx={3.5} fill="#f59e0b"/>
        {[[32,14],[50,9],[68,14]].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r={3} fill={i===1?'#ef4444':'#a5f3fc'} opacity={0.95}/>
        ))}
        {[0,1,2,3].map(i=>(
          <circle key={i} cx={[10,90,16,84][i]} cy={[46,50,74,70][i]} r={3.2} fill="#fbbf24" opacity={0.85}
            style={{ animation:`runeFloat ${2.4+i*0.45}s ${i*0.35}s ease-in-out infinite` }}/>
        ))}
      </>);
    default:
      return null;
  }
};

/* ── ออร่าธาตุ ── */
const ElementAura = ({ element }) => {
  const el = getElem(element);
  if (!el) return null;
  return (
    <svg viewBox="0 0 100 100" style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'visible', zIndex:-1 }}>
      <circle cx={50} cy={54} r={46} fill={el.color} opacity={0.1}
        style={{ animation:'auraPulse 3.2s ease-in-out infinite' }}/>
      <circle cx={50} cy={54} r={50} fill="none" stroke={el.color} strokeWidth={0.9} opacity={0.35}
        style={{ animation:'auraPulse 3.2s 0.8s ease-in-out infinite' }}/>
      {[0,1,2,3,4,5].map(i => {
        const a = (i/6)*Math.PI*2;
        return (
          <text key={i} x={50+Math.cos(a)*44} y={54+Math.sin(a)*44} fontSize={8} textAnchor="middle"
            opacity={0.75} style={{ animation:`runeFloat ${2.6+i*0.3}s ${i*0.28}s ease-in-out infinite` }}>
            {el.emoji}
          </text>
        );
      })}
    </svg>
  );
};

/* ── ซ้อนอาการป่วย / บาดเจ็บ ── */
const HealthFX = ({ healthKey }) => {
  if (healthKey === 'sick') return (
    <svg viewBox="0 0 100 100" style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'visible' }}>
      {/* เมฆฝนเล็ก ๆ เหนือหัว */}
      <g style={{ animation:'cloudDrift 3.4s ease-in-out infinite' }}>
        <ellipse cx={64} cy={10} rx={11} ry={6} fill="#94a3b8" opacity={0.85}/>
        <ellipse cx={56} cy={12} rx={7}  ry={5} fill="#cbd5e1" opacity={0.85}/>
        <ellipse cx={72} cy={12} rx={7}  ry={5} fill="#cbd5e1" opacity={0.85}/>
        {[58,64,70].map((x,i) => (
          <line key={x} x1={x} y1={17} x2={x-1.5} y2={23} stroke="#60a5fa" strokeWidth={1.4} strokeLinecap="round"
            opacity={0.8} style={{ animation:`rainDrop 0.9s ${i*0.3}s linear infinite` }}/>
        ))}
      </g>
      {/* สัญลักษณ์ไข้ */}
      <text x={26} y={16} fontSize={13} textAnchor="middle">🤒</text>
    </svg>
  );
  if (healthKey === 'injured') return (
    <svg viewBox="0 0 100 100" style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'visible' }}>
      {/* ผ้าพันแผลเรืองแสง */}
      <g style={{ filter:'drop-shadow(0 0 4px #fca5a5)' }}>
        <rect x={22} y={44} width={26} height={7} rx={3.5} fill="#fef2f2" opacity={0.95} transform="rotate(-14,35,47)"/>
        <line x1={26} y1={46} x2={44} y2={42} stroke="#fecaca" strokeWidth={1} transform="rotate(-14,35,47)"/>
        <rect x={54} y={72} width={30} height={8} rx={4} fill="#fef2f2" opacity={0.95} transform="rotate(10,69,76)"/>
      </g>
      {/* รอยขีดข่วน */}
      <path d="M60,34 L68,42 M64,32 L72,40" stroke="#ef4444" strokeWidth={1.6} strokeLinecap="round" opacity={0.75}/>
      <text x={26} y={16} fontSize={13} textAnchor="middle">🩹</text>
    </svg>
  );
  return null;
};

/* ── ชุดแต่งสัตว์เลี้ยง (ได้จากแบบฝึกหัด) ── */
const CostumeLayer = ({ costume }) => {
  if (!costume || !COSTUMES[costume]) return null;
  const wrap = (children, z = 3) => (
    <svg viewBox="0 0 100 100" style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'visible', zIndex:z }}>
      {children}
    </svg>
  );

  switch (costume) {
    case 'ribbon':    // 🎀 ริบบิ้นข้างหัว
      return wrap(<>
        <path d="M64,18 Q56,10 50,18 Q56,24 64,18" fill="#fb7185"/>
        <path d="M64,18 Q72,10 78,18 Q72,24 64,18" fill="#f43f5e"/>
        <circle cx={64} cy={18} r={3} fill="#fda4af"/>
        <path d="M62,21 L58,29 M67,21 L71,29" stroke="#f43f5e" strokeWidth={1.8} strokeLinecap="round"/>
      </>);
    case 'scarf':     // 🧣 ผ้าพันคอ
      return wrap(<>
        <path d="M28,60 Q50,70 72,60 L72,68 Q50,78 28,68 Z" fill="#dc2626"/>
        <path d="M28,60 Q50,70 72,60 L72,63 Q50,73 28,63 Z" fill="#f87171" opacity={0.7}/>
        <path d="M66,66 L74,86 L64,84 Z" fill="#dc2626"/>
        <path d="M66,66 L70,76 L65,75 Z" fill="#fca5a5" opacity={0.6}/>
      </>);
    case 'glasses':   // 🕶️ แว่นกันแดด
      return wrap(<>
        <rect x={26} y={38} width={20} height={13} rx={4} fill="#111827" opacity={0.9}/>
        <rect x={54} y={38} width={20} height={13} rx={4} fill="#111827" opacity={0.9}/>
        <path d="M46,43 L54,43" stroke="#374151" strokeWidth={2.4}/>
        <path d="M29,41 L42,48" stroke="#6b7280" strokeWidth={1.4} opacity={0.55}/>
        <path d="M57,41 L70,48" stroke="#6b7280" strokeWidth={1.4} opacity={0.55}/>
      </>);
    case 'bandana':   // 🥷 ผ้าโพกหัว
      return wrap(<>
        <path d="M22,30 Q50,20 78,30 L78,38 Q50,29 22,38 Z" fill="#1f2937"/>
        <path d="M22,32 Q50,23 78,32" stroke="#ef4444" strokeWidth={2.6} fill="none"/>
        <path d="M76,34 L92,42 L88,48 L74,40 Z" fill="#1f2937"/>
        <circle cx={38} cy={34} r={2.6} fill="#ef4444" opacity={0.85}/>
      </>);
    case 'wizard':    // 🧙 หมวกพ่อมด
      return wrap(<>
        <path d="M50,-14 L70,26 L30,26 Z" fill="#4c1d95"/>
        <path d="M50,-14 L60,6 L44,10 Z" fill="#6d28d9" opacity={0.75}/>
        <ellipse cx={50} cy={26} rx={26} ry={5.5} fill="#5b21b6"/>
        <path d="M28,22 Q50,29 72,22 L72,26 Q50,33 28,26 Z" fill="#fbbf24"/>
        <text x={44} y={12} fontSize={8} fill="#fde68a">✦</text>
        <circle cx={50} cy={-13} r={3} fill="#fbbf24">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite"/>
        </circle>
      </>);
    case 'cape':      // 🦸 ผ้าคลุมวีรบุรุษ
      return wrap(<>
        <path d="M30,52 Q50,60 70,52 L84,96 Q50,86 16,96 Z" fill="#1d4ed8" opacity={0.92}/>
        <path d="M30,52 Q50,60 70,52 L76,80 Q50,72 24,80 Z" fill="#3b82f6" opacity={0.45}/>
        <circle cx={34} cy={55} r={3.4} fill="#fbbf24"/>
        <circle cx={66} cy={55} r={3.4} fill="#fbbf24"/>
      </>, 0);
    case 'horns':     // 😈 เขาปีศาจ
      return wrap(<>
        <path d="M30,32 Q24,16 32,10 Q34,22 40,28 Z" fill="#991b1b"/>
        <path d="M70,32 Q76,16 68,10 Q66,22 60,28 Z" fill="#991b1b"/>
        <path d="M31,28 Q28,18 32,13" stroke="#dc2626" strokeWidth={1.4} fill="none" opacity={0.7}/>
        <path d="M69,28 Q72,18 68,13" stroke="#dc2626" strokeWidth={1.4} fill="none" opacity={0.7}/>
        <path d="M78,60 Q92,66 88,80 L84,76 Q88,68 76,66 Z" fill="#991b1b"/>
      </>);
    case 'halo':      // 😇 วงแหวนศักดิ์สิทธิ์
      return wrap(<>
        <ellipse cx={50} cy={12} rx={20} ry={5.5} fill="none" stroke="#fde047" strokeWidth={3}
          style={{ filter:'drop-shadow(0 0 6px #fde047)' }}>
          <animate attributeName="ry" values="5.5;3.2;5.5" dur="3.4s" repeatCount="indefinite"/>
        </ellipse>
        <ellipse cx={50} cy={12} rx={20} ry={5.5} fill="none" stroke="#fffbeb" strokeWidth={1} opacity={0.8}/>
        <path d="M22,44 Q10,34 14,50 Q18,58 26,54" fill="#fffbeb" opacity={0.55}/>
        <path d="M78,44 Q90,34 86,50 Q82,58 74,54" fill="#fffbeb" opacity={0.55}/>
      </>);
    case 'crown':     // 👑 มงกุฎราชันย์
      return wrap(<>
        <path d="M26,28 L26,12 L36,20 L43,6 L50,20 L57,6 L64,20 L74,12 L74,28 Z" fill="#fbbf24"
          style={{ filter:'drop-shadow(0 0 7px #f59e0b)' }}/>
        <path d="M26,26 L74,26 L74,31 L26,31 Z" fill="#d97706"/>
        <circle cx={50} cy={22} r={3} fill="#ef4444"/>
        <circle cx={36} cy={24} r={2.2} fill="#3b82f6"/>
        <circle cx={64} cy={24} r={2.2} fill="#10b981"/>
        <circle cx={43} cy={7} r={2} fill="#fde68a">
          <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite"/>
        </circle>
        <circle cx={57} cy={7} r={2} fill="#fde68a">
          <animate attributeName="opacity" values="0.35;1;0.35" dur="1.6s" repeatCount="indefinite"/>
        </circle>
      </>);
    default: return null;
  }
};

const PetSprite = ({ petType, stage, mood, animState, xp, healthKey='healthy', element='', costume='' }) => {
  const tier = stage.tier;
  // ป่วย/บาดเจ็บ → หน้าตาเศร้า
  const m = healthKey === 'healthy' ? mood : { ...mood, key:'hungry' };

  const baseAnim = healthKey === 'injured'
    ? { animation:'petLimp 1.6s ease-in-out infinite' }        // เดินกะเผลก
    : healthKey === 'sick'
      ? { animation:'petIdle 4.2s ease-in-out infinite' }      // ขยับช้าลง
      : { animation:'petIdle 2.4s ease-in-out infinite' };

  const animStyle = {
    idle:   baseAnim,
    happy:  { animation:'petHappy 0.3s ease-in-out infinite alternate' },
    eat:    { animation:'petEat 0.1s ease-in-out infinite alternate' },
    sleep:  { animation:'petSleep 3s ease-in-out infinite' },
    sad:    { animation:'petSad 2s ease-in-out infinite' },
    evolve: { animation:'petEvolve 0.5s ease-in-out 4' },
  }[animState] || baseAnim;

  let sprite;
  if (tier==='EGG') {
    sprite = petType==='DOG' ? <EggDOG xp={xp}/> : petType==='RABBIT' ? <EggRABBIT xp={xp}/> : petType==='DRAGON' ? <EggDRAGON xp={xp}/> : petType==='SPIRIT' ? <EggSPIRIT xp={xp}/> : <EggCAT xp={xp}/>;
  } else if (tier==='ELDER') {
    sprite = petType==='DOG' ? <ElderDOG mood={m}/> : petType==='RABBIT' ? <ElderRABBIT mood={m}/> : petType==='DRAGON' ? <ElderDRAGON mood={m}/> : petType==='SPIRIT' ? <ElderSPIRIT mood={m}/> : <ElderCAT mood={m}/>;
  } else if (tier==='ADULT') {
    sprite = petType==='DOG' ? <AdultDOG mood={m}/> : petType==='RABBIT' ? <AdultRABBIT mood={m}/> : petType==='DRAGON' ? <AdultDRAGON mood={m}/> : petType==='SPIRIT' ? <AdultSPIRIT mood={m}/> : <AdultCAT mood={m}/>;
  } else {
    sprite = petType==='DOG' ? <BabyDOG mood={m}/> : petType==='RABBIT' ? <BabyRABBIT mood={m}/> : petType==='DRAGON' ? <BabyDRAGON mood={m}/> : petType==='SPIRIT' ? <BabySPIRIT mood={m}/> : <BabyCAT mood={m}/>;
  }

  // ป่วย = ตัวซีดลง
  const sickFilter = healthKey==='sick' ? 'saturate(0.45) brightness(0.88)'
    : healthKey==='injured' ? 'saturate(0.8) brightness(0.94)' : 'none';
  const color = (PET_TYPES[petType]||PET_TYPES.CAT).color;

  return (
    <div style={{ ...animStyle, display:'inline-block', transformOrigin:'bottom center' }}>
      <div style={{ position:'relative', display:'inline-block', transform:`scale(${stage.scale})`, transformOrigin:'bottom center' }}>
        <ElementAura element={element}/>
        <div style={{ filter:sickFilter, transition:'filter 0.4s' }}>{sprite}</div>
        {tier!=='EGG' && <StageFX stage={stage} color={color}/>}
        {tier!=='EGG' && <AgeDecor stageKey={stage.key} color={color} elemColor={getElem(element)?.color}/>}
        {tier!=='EGG' && <CostumeLayer costume={costume}/>}
        <HealthFX healthKey={healthKey}/>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   UI COMPONENTS
══════════════════════════════════════════════════════════ */
const PetSelector = ({ onSelect }) => (
  <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
    <div style={{ fontFamily:'"Press Start 2P",monospace', fontSize:14, color:'#a78bfa', marginBottom:6, textAlign:'center' }}>🥚 เลือกสัตว์เลี้ยง</div>
    <p style={{ color:'rgba(255,255,255,0.4)', fontSize:12, marginBottom:20, textAlign:'center' }}>เติบโต 10 ขั้น: ไข่ → แรกเกิด → เตาะแตะ → เด็ก → รุ่นต้น → วัยรุ่น → หนุ่มสาว → โตเต็มวัย → เชี่ยวชาญ → ตำนาน</p>
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
   ARENA — จอประลอง PvP แบบผลัดกันโจมตี
══════════════════════════════════════════════════════════ */
const ArenaHpBar = ({ hp, maxHp, color, flip }) => {
  const pct = Math.max(0, Math.min(100, (hp/maxHp)*100));
  return (
    <div style={{width:'100%'}}>
      <div style={{display:'flex',justifyContent:flip?'flex-end':'space-between',gap:6,marginBottom:3}}>
        <span style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>❤️ HP</span>
        <span style={{fontSize:9,fontFamily:'Consolas,monospace',color:pct>50?'#4ade80':pct>25?'#fbbf24':'#f87171'}}>
          {hp}/{maxHp}
        </span>
      </div>
      <div style={{height:10,background:'rgba(0,0,0,0.5)',borderRadius:5,overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{height:'100%',width:`${pct}%`,borderRadius:5,transition:'width 0.45s cubic-bezier(.4,1.3,.5,1)',
          background:`linear-gradient(90deg,${pct>50?'#16a34a':pct>25?'#d97706':'#dc2626'},${color||'#4ade80'})`,
          boxShadow:`0 0 10px ${pct>25?'#4ade8066':'#ef444488'}`}}/>
      </div>
    </div>
  );
};

const ArenaFighter = ({ f, isMe, attacking, hurt, dead }) => {
  const pt = PET_TYPES[f.petType] || PET_TYPES.CAT;
  const el = getElem(f.element);
  return (
    <div style={{flex:1,minWidth:0,textAlign:'center'}}>
      <div style={{
        fontSize:44, lineHeight:1, marginBottom:6,
        filter: dead ? 'grayscale(1)' : hurt ? 'brightness(2.4)' : 'none',
        opacity: dead ? 0.4 : 1,
        transform: `scaleX(${isMe?1:-1}) ${dead?'rotate(90deg)':''}`,
        display:'inline-block',
        animation: attacking ? `arenaLunge${isMe?'R':'L'} .5s cubic-bezier(.3,1.4,.4,1)`
                 : hurt ? 'arenaShake .35s ease-out' : 'petIdle 2.6s ease-in-out infinite',
        textShadow: el ? `0 0 18px ${el.color}` : 'none',
      }}>{pt.emoji}</div>
      <div style={{fontSize:12,fontWeight:700,color:'#e2e8f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
        {f.petName}{isMe && <span style={{fontSize:9,color:'#93c5fd',marginLeft:4}}>(คุณ)</span>}
      </div>
      <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',marginBottom:6}}>
        {f.name} · {f.stage}
        {el && <span style={{color:el.color}}> · {el.emoji}{el.name}</span>}
      </div>
      <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',marginBottom:6}}>
        ⚔️{f.atkLv} 🛡️{f.defLv||1} 💨{f.evaLv||1}
        {f.defRate>0 && <span style={{color:'#38bdf8'}}> · เกราะ -{Math.round(f.defRate*100)}%</span>}
        {f.evaRate>0 && <span style={{color:'#c084fc'}}> · หลบ {Math.round(f.evaRate*100)}%</span>}
      </div>
      <ArenaHpBar hp={f.hp} maxHp={f.maxHp} color={el?.color}/>
      {f.guard && <div style={{fontSize:10,color:'#38bdf8',marginTop:4}}>🛡️ ตั้งการ์ดอยู่</div>}
    </div>
  );
};

const ArenaView = ({ room, me, ended, fx, turnLeft, onAttack, onLeave }) => {
  const host = room.host, guest = room.guest;
  const mine = host?.id === me ? host : guest;
  const foe  = host?.id === me ? guest : host;
  const myTurn = room.turn === me && room.status === 'fighting';
  const waiting = room.status === 'waiting';

  // ตัวคูณธาตุที่เราจะได้ในตานี้
  const adv = mine && foe ? elemMul(mine.element, foe.element) : 1;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {waiting ? (
        <div style={{background:'rgba(255,255,255,0.04)',border:'1.5px solid rgba(167,139,250,0.35)',borderRadius:14,padding:'22px 14px',textAlign:'center'}}>
          <div style={{fontSize:34,marginBottom:8}}>⏳</div>
          <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:9,color:'#a78bfa',marginBottom:6}}>รอคู่ต่อสู้...</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:14}}>
            บอกเพื่อนให้เข้าเมนู 🏟️ ประลอง แล้วกดเข้าสนาม "{room.name}"
          </div>
          <button onClick={onLeave} style={{padding:'9px 20px',borderRadius:11,border:'1px solid rgba(255,255,255,0.15)',
            background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:12}}>
            ยกเลิกสนาม
          </button>
        </div>
      ) : (
        <>
          {/* เวทีต่อสู้ */}
          <div style={{background:'linear-gradient(180deg,rgba(76,29,149,0.25),rgba(15,23,42,0.5))',
            border:'1.5px solid rgba(167,139,250,0.3)',borderRadius:16,padding:'14px 12px',position:'relative',overflow:'hidden'}}>

            {/* แถบสถานะตา */}
            <div style={{textAlign:'center',marginBottom:12}}>
              {room.status==='ended' ? (
                <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:10,
                  color: ended?.winner?.id===me ? '#fbbf24':'#f87171'}}>
                  {ended?.winner?.id===me ? '🏆 คุณชนะ!' : '💀 คุณแพ้'}
                </span>
              ) : (
                <>
                  <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:9,color:myTurn?'#fbbf24':'rgba(255,255,255,0.4)'}}>
                    {myTurn ? '⚔️ ตาของคุณ!' : '⏳ รอคู่ต่อสู้เดิน...'}
                  </span>
                  <div style={{fontSize:11,color:turnLeft<=5?'#f87171':'rgba(255,255,255,0.35)',marginTop:3,
                    fontFamily:'Consolas,monospace'}}>
                    ⏱️ {turnLeft}s · รอบที่ {room.round}
                  </div>
                </>
              )}
            </div>

            {/* คู่ต่อสู้ */}
            <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
              {mine && <ArenaFighter f={mine} isMe
                attacking={fx?.actorId===mine.id} hurt={fx?.type==='hit'&&fx?.targetId===mine.id} dead={mine.hp<=0}/>}
              <div style={{alignSelf:'center',fontSize:16,color:'rgba(255,255,255,0.25)',flexShrink:0,padding:'0 2px'}}>VS</div>
              {foe && <ArenaFighter f={foe}
                attacking={fx?.actorId===foe.id} hurt={fx?.type==='hit'&&fx?.targetId===foe.id} dead={foe.hp<=0}/>}
            </div>

            {/* เอฟเฟกต์ดาเมจ */}
            {fx && (
              <div style={{position:'absolute',left:0,right:0,top:'42%',textAlign:'center',pointerEvents:'none'}}>
                {fx.type==='hit' && (
                  <div style={{fontFamily:'"Press Start 2P",monospace',
                    fontSize:fx.crit?22:17, color:fx.crit?'#fbbf24':'#f87171',
                    textShadow:`0 0 20px ${fx.crit?'#fbbf24':'#ef4444'}`,animation:'arenaFloat 1.2s ease-out forwards'}}>
                    -{fx.damage}{fx.crit?' CRIT!':''}{fx.blocked?' 🛡️':''}
                    {fx.elemMul>1 && <div style={{fontSize:9,color:'#4ade80',marginTop:4}}>ธาตุได้เปรียบ ×{fx.elemMul}</div>}
                    {fx.elemMul<1 && <div style={{fontSize:9,color:'#fca5a5',marginTop:4}}>ธาตุเสียเปรียบ ×{fx.elemMul}</div>}
                  </div>
                )}
                {fx.type==='miss' && (
                  <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:15,color:'#94a3b8',
                    textShadow:'0 0 14px #64748b',animation:'arenaFloat 1.2s ease-out forwards'}}>MISS!</div>
                )}
                {fx.type==='dodge' && (
                  <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:15,color:'#c084fc',
                    textShadow:'0 0 14px #a855f7',animation:'arenaFloat 1.2s ease-out forwards'}}>💨 DODGE!</div>
                )}
                {fx.type==='guard' && (
                  <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:14,color:'#38bdf8',
                    textShadow:'0 0 14px #0ea5e9',animation:'arenaFloat 1.2s ease-out forwards'}}>
                    🛡️ GUARD{fx.healed?` +${fx.healed}`:''}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ปุ่มท่าโจมตี */}
          {room.status==='fighting' && (
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {adv!==1 && (
                <div style={{fontSize:11,textAlign:'center',color:adv>1?'#4ade80':'#f87171'}}>
                  {adv>1 ? `🔥 ธาตุคุณได้เปรียบ — ดาเมจ ×${adv}` : `⚠️ ธาตุคุณเสียเปรียบ — ดาเมจ ×${adv}`}
                </div>
              )}
              {MOVES.map(mv=>(
                <button key={mv.key} onClick={()=>onAttack(mv.key)} disabled={!myTurn}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'11px 13px',borderRadius:12,textAlign:'left',
                    cursor:myTurn?'pointer':'not-allowed',
                    border:`1.5px solid ${myTurn?`${mv.color}66`:'rgba(255,255,255,0.08)'}`,
                    background:myTurn?`${mv.color}16`:'rgba(255,255,255,0.03)',
                    color:myTurn?'#fff':'rgba(255,255,255,0.3)',transition:'.15s'}}>
                  <span style={{fontSize:20,flexShrink:0}}>{mv.emoji}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:myTurn?mv.color:'rgba(255,255,255,0.35)'}}>{mv.label}</div>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>{mv.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* บันทึกการต่อสู้ */}
          <div style={{background:'rgba(0,0,0,0.28)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'9px 12px',
            maxHeight:130,overflowY:'auto'}}>
            <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#a78bfa',marginBottom:6}}>📜 บันทึกการต่อสู้</div>
            {(ended?.log || room.log || []).slice().reverse().map((l,i)=>(
              <div key={i} style={{fontSize:11,color:i===0?'#e2e8f0':'rgba(255,255,255,0.4)',lineHeight:1.7}}>{l}</div>
            ))}
          </div>

          {room.status==='ended' && (
            <button onClick={onLeave} style={{width:'100%',padding:'12px',borderRadius:12,border:'none',cursor:'pointer',
              background:'linear-gradient(135deg,#7c3aed,#a78bfa)',color:'#fff',
              fontFamily:'"Press Start 2P",monospace',fontSize:9}}>
              กลับสู่ล็อบบี้
            </button>
          )}
          {room.status==='fighting' && (
            <button onClick={onLeave} style={{width:'100%',padding:'9px',borderRadius:11,
              border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.1)',color:'#fca5a5',
              cursor:'pointer',fontSize:12}}>
              🏳️ ยอมแพ้และออก
            </button>
          )}
        </>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════ */
// ความอิ่มลดช้าลงมาก: 0.02/วินาที ≈ เต็ม 100 → 0 ในราว 83 นาที
const DRAIN=0.02, SYNC_EVERY=30;

/* ── มินิเกมฝึก: โจทย์สูตรคูณ 3 ตัวเลือก ──
   ตอบถูกได้ 40 คะแนนพื้นฐาน + สูงสุด 60 ตามความเร็ว (ตอบผิด/หมดเวลา = 0) */
const TRAIN_QS = 3;        // จำนวนข้อต่อรอบฝึก
const TRAIN_TIME = 8;      // วินาทีต่อข้อ

function makeMulQuestion(atkLv = 1) {
  // ยิ่งเลเวลสูง ตัวเลขยิ่งใหญ่ (Lv1 → สูงสุด 5, Lv20 → สูงสุด 12)
  const hi = Math.min(12, 5 + Math.floor((atkLv - 1) / 2));
  const a = 2 + Math.floor(Math.random() * (hi - 1));
  const b = 2 + Math.floor(Math.random() * (hi - 1));
  const ans = a * b;

  // ตัวลวง: คลาดจากคำตอบจริงแบบที่คนคิดเลขพลาดบ่อย
  return withChoices(`${a} × ${b} = ?`, ans,
    [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, ans + a, ans - b, ans + 1, ans - 1]);
}

/* ── โจทย์การหาร (ฝึกทักษะป้องกัน) — สร้างจากผลคูณเพื่อให้ลงตัวเสมอ ── */
function makeDivQuestion(lv = 1) {
  const hi = Math.min(12, 5 + Math.floor((lv - 1) / 2));
  const ans = 2 + Math.floor(Math.random() * (hi - 1));   // ตัวหารผลลัพธ์
  const b   = 2 + Math.floor(Math.random() * (hi - 1));   // ตัวหาร
  const a   = ans * b;
  return withChoices(`${a} ÷ ${b} = ?`, ans,
    [ans + 1, ans - 1, ans + 2, ans - 2, b, a - b, Math.round(a / (b + 1)), ans * 2]);
}

/* ── โจทย์สมการง่าย ๆ (ฝึกทักษะหลบหลีก) — x + a = c / x - a = c / a·x = c ── */
function makeEqQuestion(lv = 1) {
  const hi = Math.min(15, 5 + Math.floor((lv - 1) / 1.5));
  const x  = 1 + Math.floor(Math.random() * hi);
  const a  = 2 + Math.floor(Math.random() * Math.min(9, hi));
  const forms = lv >= 5 ? 3 : 2;
  const kind = Math.floor(Math.random() * forms);
  let text;
  if (kind === 0)      text = `x + ${a} = ${x + a}`;
  else if (kind === 1) text = `x − ${a} = ${x - a}`;
  else                 text = `${a}x = ${a * x}`;
  return withChoices(`${text}\nx = ?`, x, [x + 1, x - 1, x + a, x - a, a, x + 2, x - 2, x * 2]);
}

/* เลือกตัวลวง 2 ตัวจาก pool แล้วสลับลำดับ */
function withChoices(text, ans, pool) {
  const decoys = [];
  for (const v of pool.sort(() => Math.random() - 0.5)) {
    if (Number.isInteger(v) && v > 0 && v !== ans && !decoys.includes(v)) decoys.push(v);
    if (decoys.length === 2) break;
  }
  while (decoys.length < 2) {
    const v = ans + 1 + decoys.length;
    if (!decoys.includes(v)) decoys.push(v);
  }
  return { text, ans, choices: [ans, ...decoys].sort(() => Math.random() - 0.5) };
}

/* ── ทักษะที่ฝึกได้ (key ต้องตรงกับ SKILLS ใน backend/routes/petRoutes.js) ── */
const TRAIN_SKILLS = [
  { key:'atk', label:'โจมตี',   emoji:'⚔️', color:'#fb923c', topic:'สูตรคูณ',   op:'✖️',
    make: makeMulQuestion, effect:'ทุก 1 เลเวล → พลังโจมตี +6 · HP ในสนามประลอง +10' },
  { key:'def', label:'ป้องกัน', emoji:'🛡️', color:'#38bdf8', topic:'การหาร',    op:'➗',
    make: makeDivQuestion, effect:'ทุก 1 เลเวล → ลดดาเมจที่รับ 2.2% (สูงสุด 45%) · HP +14' },
  { key:'eva', label:'หลบหลีก', emoji:'💨', color:'#c084fc', topic:'สมการง่าย ๆ', op:'🟰',
    make: makeEqQuestion,  effect:'ทุก 1 เลเวล → โอกาสหลบการโจมตี +1.4% (สูงสุด 30%)' },
];

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

  // ── สุขภาพ + ไอเทม (เก็บในเครื่อง) ──
  const [healthKey,  setHealthKey]  = useState('healthy');
  const [items,      setItems]      = useState({ herb:1, kit:1 });
  const [restUntil,  setRestUntil]  = useState(0);
  const [restFrom,   setRestFrom]   = useState(0);   // เวลาที่เริ่มพัก — ใช้วาดหลอดนับถอยหลัง
  const [nowTs,      setNowTs]      = useState(Date.now());
  const [showStages, setShowStages] = useState(false);

  // ── ธาตุ / ทักษะโจมตี ──
  const [element,   setElement]   = useState('');
  const [atkLv,     setAtkLv]     = useState(1);
  const [atkXp,     setAtkXp]     = useState(0);
  const [defLv,     setDefLv]     = useState(1);
  const [defXp,     setDefXp]     = useState(0);
  const [evaLv,     setEvaLv]     = useState(1);
  const [evaXp,     setEvaXp]     = useState(0);
  const [stamina,   setStamina]   = useState(STAMINA_MAX);
  const [pvpWins,   setPvpWins]   = useState(0);
  const [pvpLosses, setPvpLosses] = useState(0);

  // ── ของรางวัลจากแบบฝึกหัด: ขนม + ตู้เสื้อผ้า ──
  const [snacks,   setSnacks]   = useState(0);
  const [wardrobe, setWardrobe] = useState([]);
  const [costume,  setCostume]  = useState('');
  const [showCloset, setShowCloset] = useState(false);
  const [snackBusy, setSnackBusy] = useState(false);

  // ── มินิเกมฝึกทักษะ (โจมตี / ป้องกัน / หลบหลีก) ──
  const [trainSkill, setTrainSkill] = useState('atk');   // ทักษะที่กำลังฝึก
  const [trainRun,   setTrainRun]   = useState(false);   // อยู่ในรอบฝึก
  const [trainQ,     setTrainQ]     = useState(null);    // โจทย์ปัจจุบัน {text,ans,choices}
  const [trainLeft,  setTrainLeft]  = useState(0);       // วินาทีที่เหลือของข้อนี้
  const [trainHits,  setTrainHits]  = useState([]);      // คะแนนแต่ละข้อ
  const [trainPick,  setTrainPick]  = useState(null);    // {choice,ok} โชว์ผลแวบเดียว
  const [trainMsg,   setTrainMsg]   = useState(null);
  const [training,   setTraining]   = useState(false);
  const trainDeadline = useRef(0);
  const trainAnswerRef = useRef(null);

  // ── แผงแอดมิน (ดู/รีเซ็ตสัตว์เลี้ยงของทุกคน) ──
  const [adminRows,    setAdminRows]    = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminErr,     setAdminErr]     = useState('');
  const [adminBusy,    setAdminBusy]    = useState(null);
  const [adminOpen,    setAdminOpen]    = useState(null);   // userId ที่กางรายละเอียดอยู่
  const [adminQ,       setAdminQ]       = useState('');

  // ── สนามประลอง PvP ──
  const [arenaRooms,  setArenaRooms]  = useState([]);
  const [arenaRoom,   setArenaRoom]   = useState(null);
  const [arenaEnded,  setArenaEnded]  = useState(null);
  const [arenaErr,    setArenaErr]    = useState('');
  const [arenaFx,     setArenaFx]     = useState(null);
  const [arenaBoard,  setArenaBoard]  = useState(null);
  const [turnLeft,    setTurnLeft]    = useState(0);
  const arenaSock = useRef(null);

  const chatEndRef = useRef(null);
  const feedRef    = useRef(null);
  const floatId    = useRef(0);
  const syncTimer  = useRef(0);
  const lastSyncHunger = useRef(null);
  const saveTimer  = useRef(null);
  const hungerRef  = useRef(hunger);
  hungerRef.current = hunger;
  const healthRef  = useRef(healthKey);
  healthRef.current = healthKey;
  const stageRef   = useRef('EGG');
  const healthLoaded = useRef(false);

  const mood   = getMood(hunger);
  const stage  = getStage(xp);
  const health = getHealth(healthKey);
  const elem   = getElem(element);
  // พลังรวม = พลังตามวัย + โบนัสทักษะโจมตี แล้วคูณผลจากสุขภาพ
  const power  = Math.round((stage.power + atkLv * 6) * health.powerMul);
  const atkNeed = atkXpNeeded(atkLv);
  const resting = restUntil > nowTs;
  // ทักษะที่กำลังฝึก + เลเวล/ความชำนาญของทักษะนั้น
  const skillDef  = TRAIN_SKILLS.find(s => s.key === trainSkill) || TRAIN_SKILLS[0];
  const skillLv   = trainSkill === 'def' ? defLv : trainSkill === 'eva' ? evaLv : atkLv;
  const skillXp   = trainSkill === 'def' ? defXp : trainSkill === 'eva' ? evaXp : atkXp;
  const skillNeed = atkXpNeeded(skillLv);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_USER';
  stageRef.current = stage.key;

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [chatMsgs, isTyping]);

  // บันทึกสถานะสุขภาพขึ้นเซิร์ฟเวอร์ (ข้ามเครื่องได้) — ข้ามรอบแรกที่เพิ่งโหลดมา
  useEffect(() => {
    if (loading || !healthLoaded.current) return;
    // debounce 900ms — รวบการเปลี่ยนหลายค่าติดกันให้ยิงครั้งเดียว
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.put('/pet/state', {
        health: healthKey,
        item_herb: items.herb,
        item_kit: items.kit,
        rest_until: restUntil ? new Date(restUntil).toISOString() : null,
      }).catch(()=>{});
    }, 900);
    return () => clearTimeout(saveTimer.current);
  }, [healthKey, items, restUntil, loading]);

  // นับเวลาพักฟื้น
  useEffect(() => {
    if (!resting) return;
    const iv = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [resting]);

  // พักครบ → หายเป็นปกติ
  useEffect(() => {
    if (restUntil && !resting && healthKey !== 'healthy') {
      setHealthKey('healthy');
      setChatMsgs(m => [...m, { from:'pet', text:'หายดีแล้ว! พลังกลับมาเต็มเปี่ยม 💚' }]);
      setRestUntil(0);
    }
  }, [resting, restUntil, healthKey]);

  // stage evolution
  useEffect(() => {
    if (prevStageKey !== stage.key && prevStageKey !== 'EGG') {
      setPrevStageKey(stage.key);
      setAnimState('evolve');
      const msgs = {
        NEWBORN:'🥚✨ ฉันฟักออกมาแล้ว! สวัสดีนะ~',
        TODDLER:'🍼 เดินได้แล้ว! เตาะแตะ ๆ ~',
        CHILD:  '🧒 โตขึ้นแล้ว มีเครื่องประดับด้วยนะ!',
        PRETEEN:'✨ เริ่มมีลวดลายเรืองแสงแล้ว เท่ไหม?',
        TEEN:   '⚡ พลังพุ่งเลย! รูปร่างชัดขึ้นมาก',
        YOUNG:  '🌟 ออร่าธาตุมาแล้ว! สง่างามใช่ไหมล่ะ',
        ADULT:  '⚔️ โตเต็มวัยแล้ว! ใช้ทักษะพิเศษได้เต็มที่ 🎉',
        EXPERT: '💎 เกราะคริสตัลกับปีกคู่ปลดล็อก! พลังพิเศษพร้อมใช้',
        LEGEND: '👑 ฉันคือตำนาน! สกิลอัลติเมทพร้อมลงสนามแข่ง ✨',
      };
      setChatMsgs(m => [...m, { from:'pet', text: msgs[stage.key]||`เติบโตเป็น ${stage.label} แล้ว!` }]);
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

        // สุขภาพ + ไอเทม (sync ข้ามเครื่อง)
        if (HEALTH[state.health]) setHealthKey(state.health);
        setItems({ herb: state.item_herb ?? 1, kit: state.item_kit ?? 1 });
        const ru = state.rest_until ? new Date(state.rest_until).getTime() : 0;
        setRestUntil(ru && !isNaN(ru) ? ru : 0);
        setNowTs(Date.now());

        // ธาตุ + ทักษะโจมตี + สถิติประลอง
        setElement(state.element || '');
        setAtkLv(state.atk_lv || 1);
        setAtkXp(state.atk_xp || 0);
        setDefLv(state.def_lv || 1);
        setDefXp(state.def_xp || 0);
        setEvaLv(state.eva_lv || 1);
        setEvaXp(state.eva_xp || 0);
        setStamina(state.stamina ?? STAMINA_MAX);
        setPvpWins(state.pvp_wins || 0);
        setPvpLosses(state.pvp_losses || 0);

        // ของรางวัลจากแบบฝึกหัด
        setSnacks(state.item_snack || 0);
        setWardrobe(Array.isArray(state.wardrobe) ? state.wardrobe : []);
        setCostume(state.costume || '');
      }
      if (words) setWordHistory(words);
    }).catch(()=>{}).finally(()=>{ setLoading(false); healthLoaded.current = true; });
  }, []);

  // drain ความอิ่ม (อาการป่วยมาจากรอบ 2 วันฝั่งเซิร์ฟเวอร์, บาดเจ็บมาจากการประลอง)
  useEffect(() => {
    const iv = setInterval(() => {
      setHunger(h => Math.max(0, h-DRAIN));
      syncTimer.current++;
      // sync ความอิ่มขึ้นเซิร์ฟเวอร์ — ข้ามถ้าค่าไม่ขยับ หรือแท็บถูกซ่อนอยู่
      if (syncTimer.current >= SYNC_EVERY) {
        syncTimer.current = 0;
        const h = Math.round(hungerRef.current);
        if (h !== lastSyncHunger.current && !document.hidden) {
          lastSyncHunger.current = h;
          api.put('/pet/state',{hunger:hungerRef.current}).catch(()=>{});
        }
      }
    }, 1000);
    return ()=>clearInterval(iv);
  }, []);

  const addFloat = (text,color,x,y) => {
    const id=++floatId.current;
    setFloats(f=>[...f,{id,text,color,x:x??30+Math.random()*40,y:y??15+Math.random()*20}]);
    setTimeout(()=>setFloats(f=>f.filter(ft=>ft.id!==id)),1500);
  };
  const triggerAnim=(a,ms=900)=>{ setAnimState(a); setTimeout(()=>setAnimState('idle'),ms); };

  // ── ใส่/ถอดชุดแต่ง ──
  const equipCostume = async (key) => {
    const prev = costume;
    setCostume(key);                                   // optimistic
    try {
      await api.put('/pet/state', { costume: key });
      if (key) { triggerAnim('happy'); addFloat(`${COSTUMES[key]?.emoji || '👕'} เท่มาก!`, '#fbbf24'); }
      else addFloat('ถอดชุดแล้ว', '#94a3b8');
    } catch (err) {
      setCostume(prev);
      addFloat(err?.response?.data?.message || 'ใส่ชุดไม่สำเร็จ', '#ef4444');
    }
  };

  // ── ให้กินขนมพิเศษ ──
  const useSnack = async () => {
    if (snacks <= 0 || snackBusy) return;
    setSnackBusy(true);
    try {
      const { data } = await api.post('/pet/snack');
      setSnacks(data.item_snack);
      setXp(data.xp);
      setHunger(data.hunger);
      triggerAnim('eat', 1100);
      addFloat(`+${data.xpGain} EXP`, '#a78bfa', 55, 18);
      setTimeout(()=>addFloat(`+${data.hungerGain} อิ่ม`, '#34d399', 30, 26), 250);
    } catch (err) {
      addFloat(err?.response?.data?.message || 'ให้ขนมไม่สำเร็จ', '#ef4444');
    } finally {
      setSnackBusy(false);
    }
  };

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
      setChatMsgs(m=>[...m,{from:'pet',text:getPetResponse(msg,mood,stage,petType,healthKey)}]);
    }, 700+Math.random()*600);
  }, [chatInput, mood, stage, petType, healthKey]);

  // ใช้ไอเทมรักษา → เข้าสู่ช่วงพักฟื้น
  const useItem = useCallback((key) => {
    const item = ITEMS[key];
    if (!item || (items[key]||0) <= 0) return;
    if (health.cure !== key) { addFloat('ใช้ไม่ได้ตอนนี้','#ef4444'); return; }
    setItems(v => ({ ...v, [key]: v[key]-1 }));
    setRestFrom(Date.now());
    setRestUntil(Date.now() + REST_MS);
    setNowTs(Date.now());
    triggerAnim('sleep', 1500);
    addFloat(`${item.emoji} ${item.name}`, '#10b981');
    setChatMsgs(m => [...m, { from:'pet', text:`ได้${item.name}แล้ว... ขอพักผ่อนสักครู่นะ 😴` }]);
  }, [items, health.cure]);

  /* ── พักเอง (ไม่มีไอเทม): ใช้เวลานานกว่า แต่ผู้เล่นไม่ติดตาย ── */
  const restSelf = useCallback(() => {
    if (restUntil > Date.now() || healthKey === 'healthy') return;
    setRestFrom(Date.now());
    setRestUntil(Date.now() + SELF_REST_MS);
    setNowTs(Date.now());
    triggerAnim('sleep', 1500);
    addFloat('😴 พักผ่อน', '#6ee7b7');
    setChatMsgs(m => [...m, { from:'pet', text:'ไม่มียาก็ไม่เป็นไร... ฉันขอนอนพักนานหน่อยนะ 😴' }]);
  }, [restUntil, healthKey]);

  /* ── เลือกธาตุ (ครั้งเดียว ถาวร) ── */
  const chooseElement = useCallback(async (key) => {
    if (element) return;
    try {
      await api.put('/pet/state', { element: key });
      setElement(key);
      addFloat(`${ELEMENTS[key].emoji} ธาตุ${ELEMENTS[key].name}!`, ELEMENTS[key].color);
      triggerAnim('evolve', 1600);
      setChatMsgs(m => [...m, { from:'pet', text:`${ELEMENTS[key].emoji} ฉันตื่นรู้พลังธาตุ${ELEMENTS[key].name}แล้ว! รู้สึกแรงขึ้นมาก` }]);
    } catch (e) {
      addFloat('เลือกธาตุไม่สำเร็จ', '#ef4444');
    }
  }, [element]);

  /* ── มินิเกมฝึกโจมตี: โจทย์สูตรคูณ 3 ตัวเลือก ตอบถูก+เร็ว = คะแนนสูง ── */

  // นับเวลาถอยหลังของแต่ละข้อ — หมดเวลาถือว่าตอบผิด
  useEffect(() => {
    if (!trainRun || !trainQ) return;
    const iv = setInterval(() => {
      const left = (trainDeadline.current - Date.now()) / 1000;
      if (left <= 0) { setTrainLeft(0); trainAnswerRef.current?.(null); }
      else setTrainLeft(left);
    }, 100);
    return () => clearInterval(iv);
  }, [trainRun, trainQ]);

  const nextQuestion = useCallback(() => {
    setTrainQ(skillDef.make(skillLv));
    setTrainPick(null);
    trainDeadline.current = Date.now() + TRAIN_TIME * 1000;
    setTrainLeft(TRAIN_TIME);
  }, [skillDef, skillLv]);

  const startTraining = useCallback(() => {
    if (stamina <= 0) { setTrainMsg({ ok:false, msg:'พลังฝึกซ้อมหมด รอฟื้นสักครู่ (ฟื้น 1 ทุก 4 นาที)' }); return; }
    if (healthKey !== 'healthy') { setTrainMsg({ ok:false, msg:'น้องยังไม่แข็งแรงพอจะฝึก รักษาให้หายก่อน' }); return; }
    setTrainMsg(null); setTrainHits([]);
    setTrainRun(true);
    nextQuestion();
  }, [stamina, healthKey, nextQuestion]);

  const submitTraining = useCallback((hits) => {
    setTrainRun(false); setTrainQ(null); setTraining(true);
    const avg = Math.round(hits.reduce((a,b)=>a+b,0) / hits.length);
    const rights = hits.filter(h=>h>0).length;
    const sk = skillDef;
    api.post('/pet/train', { score: avg, skill: sk.key })
      .then(res => {
        const d = res.data;
        setAtkLv(d.atk_lv); setAtkXp(d.atk_xp);
        if (d.def_lv != null) { setDefLv(d.def_lv); setDefXp(d.def_xp); }
        if (d.eva_lv != null) { setEvaLv(d.eva_lv); setEvaXp(d.eva_xp); }
        setStamina(d.stamina); setXp(d.xp); setHunger(d.hunger);
        setTrainMsg({ ok:true, msg:`ฝึกเสร็จ! ถูก ${rights}/${TRAIN_QS} ข้อ · คะแนนเฉลี่ย ${avg} → ทักษะ${sk.label} +${d.atkGain} · EXP +${d.xpGain}` });
        addFloat(`${sk.emoji} +${d.atkGain}`, sk.color, 66, 16);
        if (d.leveled > 0) {
          triggerAnim('evolve', 1600);
          setChatMsgs(m => [...m, { from:'pet', text:`${sk.emoji} ทักษะ${sk.label}ขึ้นเป็นเลเวล ${d.lv} แล้ว! เก่งขึ้นอีกเยอะเลย 💪` }]);
        }
      })
      .catch(err => setTrainMsg({ ok:false, msg: err?.response?.data?.message || 'ฝึกไม่สำเร็จ' }))
      .finally(() => setTraining(false));
  }, [skillDef]);

  // choice = null คือหมดเวลา
  const answerTrain = useCallback((choice) => {
    if (!trainRun || !trainQ || trainPick) return;
    const left = Math.max(0, (trainDeadline.current - Date.now()) / 1000);
    const ok = choice === trainQ.ans;
    // ถูก: 40 คะแนนพื้นฐาน + สูงสุด 60 ตามเวลาที่เหลือ
    const score = ok ? Math.round(40 + 60 * (left / TRAIN_TIME)) : 0;

    setTrainPick({ choice, ok });
    const label = !ok ? (choice === null ? 'หมดเวลา!' : 'ผิด!') : score >= 90 ? 'เร็วมาก!' : score >= 70 ? 'ถูกต้อง!' : 'ถูก แต่ช้า';
    addFloat(`${label} ${ok ? '+' + score : ''}`, ok ? (score >= 90 ? '#fbbf24' : '#34d399') : '#ef4444');
    triggerAnim(ok ? 'happy' : 'eat', 500);

    const hits = [...trainHits, score];
    setTrainHits(hits);
    // โชว์ผลข้อนี้ 700ms แล้วไปข้อถัดไป (หรือส่งคะแนนถ้าครบ)
    setTimeout(() => {
      if (hits.length >= TRAIN_QS) submitTraining(hits);
      else nextQuestion();
    }, 700);
  }, [trainRun, trainQ, trainPick, trainHits, nextQuestion, submitTraining]);

  // ให้ตัวจับเวลาเรียกฟังก์ชันล่าสุดได้เสมอ
  trainAnswerRef.current = answerTrain;

  /* ── สนามประลอง PvP ── */
  useEffect(() => {
    if (activeTab !== 'arena' || arenaSock.current) return;
    const sock = io(SOCKET_URL, { auth: { token: localStorage.getItem('token') } });
    arenaSock.current = sock;
    sock.on('connect', () => sock.emit('arena:get_rooms'));
    sock.on('arena:rooms_updated', setArenaRooms);
    sock.on('arena:error', (msg) => { setArenaErr(msg); setTimeout(()=>setArenaErr(''), 3200); });
    sock.on('arena:joined', (room) => { setArenaRoom(room); setArenaEnded(null); });
    sock.on('arena:updated', setArenaRoom);
    sock.on('arena:action', (ev) => {
      setArenaFx(ev);
      setTimeout(() => setArenaFx(null), 1100);
    });
    sock.on('arena:ended', (res) => {
      setArenaEnded(res);
      setArenaRoom(r => r ? { ...r, status:'ended', host:res.host, guest:res.guest } : r);
      if (res.winner?.id === user?.id) { setPvpWins(w=>w+1); setXp(x=>x+40); }
      else { setPvpLosses(l=>l+1); setXp(x=>x+12); }
      api.get('/pet/arena/leaderboard').then(r=>setArenaBoard(r.data)).catch(()=>{});
    });
    api.get('/pet/arena/leaderboard').then(r=>setArenaBoard(r.data)).catch(()=>{});
    return () => { sock.disconnect(); arenaSock.current = null; };
  }, [activeTab, user?.id]);

  // นับถอยหลังตาเดิน
  useEffect(() => {
    if (!arenaRoom?.turnEndsAt || arenaRoom.status !== 'fighting') { setTurnLeft(0); return; }
    const tick = () => setTurnLeft(Math.max(0, Math.ceil((arenaRoom.turnEndsAt - Date.now())/1000)));
    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [arenaRoom?.turnEndsAt, arenaRoom?.status]);

  const arenaCreate = () => arenaSock.current?.emit('arena:create', {});
  const arenaJoin   = (roomId) => arenaSock.current?.emit('arena:join', { roomId });
  const arenaAttack = (move) => arenaSock.current?.emit('arena:attack', { roomId: arenaRoom?.id, move });
  const arenaLeave  = () => {
    if (arenaRoom) arenaSock.current?.emit('arena:leave', { roomId: arenaRoom.id });
    setArenaRoom(null); setArenaEnded(null);
    arenaSock.current?.emit('arena:get_rooms');
  };

  /* ── แผงแอดมิน: ดูสัตว์เลี้ยงทุกคน + รีเซ็ตค่า ── */
  const loadAdmin = useCallback(() => {
    setAdminLoading(true); setAdminErr('');
    api.get('/pet/admin/list')
      .then(res => setAdminRows(res.data.rows || []))
      .catch(err => setAdminErr(err?.response?.data?.message || 'โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setAdminLoading(false));
  }, []);

  useEffect(() => { if (activeTab==='admin' && isAdmin && !adminRows) loadAdmin(); }, [activeTab, isAdmin, adminRows, loadAdmin]);

  const adminReset = useCallback(async (row, mode) => {
    const modeLabel = mode==='full' ? 'ล้างทั้งหมดกลับไปเป็นไข่ (EXP, คำศัพท์, ทักษะ, ชุดแต่ง หายทั้งหมด)'
      : mode==='stats' ? 'ล้างทักษะและสถิติประลอง (คง EXP และคำศัพท์)'
      : 'รักษาอาการ + เติมความอิ่มและพลังฝึก';
    if (!window.confirm(`ยืนยันรีเซ็ตสัตว์เลี้ยงของ ${row.owner}?\n\n${modeLabel}`)) return;
    setAdminBusy(row.userId);
    try {
      await api.post(`/pet/admin/reset/${row.userId}`, { mode });
      loadAdmin();
      // ถ้ารีเซ็ตตัวเอง ให้โหลดหน้าใหม่เพื่อดึงค่าที่เปลี่ยน
      if (row.userId === user?.id) window.location.reload();
    } catch (err) {
      setAdminErr(err?.response?.data?.message || 'รีเซ็ตไม่สำเร็จ');
    } finally { setAdminBusy(null); }
  }, [loadAdmin, user?.id]);

  const feedPet = useCallback(async () => {
    const word=feedInput.trim(); if(!word||feedLoading) return;
    if(hasSpace(word)) { setFeedStatus({ok:false,msg:'ป้อนได้ครั้งละ 1 คำเท่านั้น ห้ามเว้นวรรค'}); return; }
    if(!isValidWord(word)) { setFeedStatus({ok:false,msg:'กรุณาพิมพ์ตัวอักษรเท่านั้น (1 คำ ไม่เว้นวรรค)'}); return; }
    setFeedStatus(null); setFeedLoading(true);
    try {
      const res = await api.post('/pet/feed',{word});
      const { ok,status,pts,usedBy,xpGain,newXp,message } = res.data;
      if(!ok) {
        const msg = status==='duplicate'
          ? (usedBy==='คุณเอง' ? 'คุณเคยใช้คำนี้ไปแล้ว!' : `คำ "${word}" มีคนอื่นใช้แล้ว (${usedBy})`)
          : status==='not_a_word'
          ? (message || `ไม่พบ "${word}" ในพจนานุกรม — ต้องเป็นคำที่มีความหมายจริงนะ`)
          : (message || 'คำไม่ถูกต้อง');
        setFeedStatus({ok:false,msg});
        addFloat(status==='not_a_word' ? 'ไม่มีคำนี้! 📖' : 'ซ้ำ! 🚫', '#ef4444');
        // คำที่ไม่มีความหมาย: คงข้อความไว้ให้แก้ ไม่ต้องพิมพ์ใหม่ทั้งคำ
        if (status!=='not_a_word') setFeedInput('');
        return;
      }
      setHunger(h=>Math.min(100,h+pts));
      setXp(newXp??xp+(xpGain||word.length));
      setTotalWords(t=>t+1);
      setWordHistory(wh=>[{word:word.toLowerCase()},...wh.slice(0,49)]);
      setFeedInput(''); triggerAnim('eat',900);
      addFloat(`+${pts} 🍖`, pts>=24?'#10b981':pts>=15?'#fbbf24':'#a78bfa');
      if(word.length>=8) addFloat('คำยาวมาก! 🔥','#f97316',62,10);
      // โอกาสได้ไอเทมรักษาจากการป้อนคำ
      if(Math.random()<0.18){
        const drop = Math.random()<0.6 ? 'herb' : 'kit';
        setItems(v=>({...v,[drop]:(v[drop]||0)+1}));
        addFloat(`${ITEMS[drop].emoji} +1`, '#34d399', 70, 22);
      }
      setTimeout(()=>{ setChatMsgs(m=>[...m,{from:'pet',text:rnd(pts>=24?['อร่อยมากๆ! ขอบคุณ~','อิ่มขึ้นเลย! 😋']:['กินแล้ว~','ขอบคุณ 😊'])}]); },1000);
    } catch (err) { setFeedStatus({ok:false,msg: err?.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'}); }
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
  const stageIdx  = STAGES.indexOf(stage);
  const nextStage = STAGES[stageIdx+1];
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
                <PetSprite petType={petType} stage={stage} mood={mood} animState={animState} xp={xp} healthKey={healthKey} element={element} costume={costume}/>
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

                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:7}}>
                  <div style={{display:'inline-flex',alignItems:'center',gap:4,background:`${mood.color}22`,border:`1px solid ${mood.color}44`,borderRadius:12,padding:'2px 10px'}}>
                    <span style={{fontSize:11}}>{mood.emoji}</span>
                    <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:mood.color}}>{mood.label}</span>
                  </div>
                  <div style={{display:'inline-flex',alignItems:'center',gap:4,background:`${health.color}22`,border:`1px solid ${health.color}44`,borderRadius:12,padding:'2px 10px'}}>
                    <span style={{fontSize:11}}>{health.emoji}</span>
                    <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:health.color}}>{health.label}</span>
                  </div>
                  {elem && (
                    <div style={{display:'inline-flex',alignItems:'center',gap:4,background:`${elem.color}22`,border:`1px solid ${elem.color}66`,borderRadius:12,padding:'2px 10px'}}>
                      <span style={{fontSize:11}}>{elem.emoji}</span>
                      <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:elem.color}}>{elem.name}</span>
                    </div>
                  )}
                  <div style={{display:'inline-flex',alignItems:'center',gap:4,background:'rgba(249,115,22,0.14)',border:'1px solid rgba(249,115,22,0.4)',borderRadius:12,padding:'2px 10px'}}>
                    <span style={{fontSize:11}}>⚔️</span>
                    <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#fb923c'}}>Lv.{atkLv}</span>
                  </div>
                </div>

                {/* Stage */}
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,flexWrap:'wrap'}}>
                  <span style={{fontSize:10,color:'rgba(255,255,255,0.5)'}}>{stage.label}</span>
                  <span style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>ขั้น {stageIdx+1}/10</span>
                  {nextStage && <span style={{fontSize:9,color:'rgba(255,255,255,0.3)'}}>→ {nextStage.short}</span>}
                  <button onClick={()=>setShowStages(s=>!s)}
                    style={{background:'rgba(167,139,250,0.15)',border:'1px solid rgba(167,139,250,0.3)',borderRadius:7,padding:'1px 7px',color:'#c4b5fd',cursor:'pointer',fontSize:9}}>
                    {showStages?'ซ่อน':'ดูขั้น'}
                  </button>
                </div>

                {/* Power */}
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                  <span style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>💪 พลัง</span>
                  <span style={{fontSize:10,color:healthKey==='healthy'?'#fbbf24':health.color,fontWeight:700}}>{power}</span>
                  {healthKey!=='healthy' && (
                    <span style={{fontSize:9,color:health.color}}>
                      (−{Math.round((1-health.powerMul)*100)}% จาก{health.label})
                    </span>
                  )}
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

          {/* แผนผังขั้นการเจริญเติบโต */}
          {showStages && (
            <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:14,padding:'10px 12px'}}>
              <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#a78bfa',marginBottom:8}}>🌱 ขั้นการเจริญเติบโต</div>
              <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:190,overflowY:'auto'}}>
                {STAGES.map((s,i)=>{
                  const done = xp >= s.minXp;
                  const cur  = s.key === stage.key;
                  return (
                    <div key={s.key} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'5px 8px',borderRadius:9,
                      background:cur?'rgba(167,139,250,0.16)':'transparent',border:`1px solid ${cur?'rgba(167,139,250,0.4)':'transparent'}`,opacity:done?1:0.42}}>
                      <span style={{fontSize:9,color:'#a78bfa',minWidth:16}}>{i+1}.</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,color:'#e2e8f0'}}>{s.label} <span style={{fontSize:9,color:'rgba(255,255,255,0.35)'}}>({s.minXp} EXP • พลัง {s.power})</span></div>
                        <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',lineHeight:1.4}}>{s.desc}</div>
                      </div>
                      {done && <span style={{fontSize:10,color:'#10b981'}}>✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* แผงรักษาอาการ */}
          {healthKey !== 'healthy' && (
            <div style={{background:`${health.color}14`,border:`1.5px solid ${health.color}55`,borderRadius:14,padding:'10px 12px'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
                <span style={{fontSize:15}}>{health.emoji}</span>
                <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:8,color:health.color}}>น้องกำลัง{health.label}</span>
              </div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.55)',marginBottom:8}}>
                {health.hint} • พลังลดลง {Math.round((1-health.powerMul)*100)}%
                {healthKey==='injured' && ' • เคลื่อนไหวช้าลง'}
              </div>
              {resting ? (() => {
                const total = Math.max(1000, restUntil - (restFrom || (restUntil - REST_MS)));
                const pct = Math.min(100, Math.max(0, ((nowTs - (restUntil - total)) / total) * 100));
                return (
                  <div style={{background:'rgba(16,185,129,0.10)',border:'1.5px solid rgba(110,231,183,0.45)',borderRadius:12,padding:'10px 12px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:7}}>
                      <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:8,color:'#6ee7b7'}}>😴 กำลังพักฟื้น</span>
                      <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:15,color:'#fff',letterSpacing:1}}>{mmss(restUntil-nowTs)}</span>
                    </div>
                    <div style={{height:9,borderRadius:99,background:'rgba(255,255,255,0.10)',overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,borderRadius:99,transition:'width 1s linear',
                        background:'linear-gradient(90deg,#10b981,#6ee7b7)'}} />
                    </div>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.45)',marginTop:6}}>
                      ครบเวลาแล้วน้องจะกลับมาแข็งแรงเอง ({Math.round(pct)}%)
                    </div>
                  </div>
                );
              })() : (
                <>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {Object.values(ITEMS).map(it=>{
                      const right  = health.cure===it.key;
                      const have   = items[it.key]||0;
                      const usable = right && have>0;
                      const why = !right ? `ใช้กับอาการ${HEALTH[it.cures].label}เท่านั้น`
                                         : 'ยังไม่มีในกระเป๋า — ทำแบบฝึกหัดเพื่อรับของรางวัล';
                      return (
                        <button key={it.key} onClick={()=>useItem(it.key)} disabled={!usable}
                          style={{flex:'1 1 130px',padding:'8px 10px',borderRadius:11,cursor:usable?'pointer':'not-allowed',
                            border:`1.5px solid ${usable?health.color:'rgba(255,255,255,0.12)'}`,
                            background:usable?`${health.color}22`:'rgba(255,255,255,0.04)',
                            color:usable?'#fff':'rgba(255,255,255,0.35)',fontSize:12,textAlign:'left'}}>
                          <div>{it.emoji} {it.name} <span style={{fontSize:11,opacity:0.7}}>×{have}</span></div>
                          <div style={{fontSize:10,opacity:0.6}}>{it.desc}</div>
                          {!usable && <div style={{fontSize:10,color:'#fbbf24',opacity:0.9,marginTop:3}}>⚠ {why}</div>}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={restSelf}
                    style={{width:'100%',marginTop:8,padding:'9px 10px',borderRadius:11,cursor:'pointer',
                      border:'1.5px solid rgba(110,231,183,0.4)',background:'rgba(16,185,129,0.10)',color:'#6ee7b7',fontSize:12}}>
                    😴 พักผ่อนเอง (ไม่ใช้ไอเทม • {SELF_REST_MS/60000} นาที)
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── เลือกธาตุ (ครั้งเดียว) ── */}
          {!element && stage.key!=='EGG' && (
            <div style={{background:'rgba(255,255,255,0.04)',border:'1.5px solid rgba(167,139,250,0.4)',borderRadius:14,padding:'11px 12px'}}>
              <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:8,color:'#a78bfa',marginBottom:4}}>🔮 ตื่นรู้พลังธาตุ</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:9}}>
                เลือกธาตุประจำตัวได้ <b style={{color:'#fcd34d'}}>ครั้งเดียว เปลี่ยนไม่ได้</b> — มีผลต่อดาเมจในสนามประลอง
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {Object.values(ELEMENTS).map(el=>(
                  <button key={el.key} onClick={()=>chooseElement(el.key)}
                    style={{background:`${el.color}18`,border:`1.5px solid ${el.color}66`,borderRadius:11,padding:'8px 10px',
                      cursor:'pointer',textAlign:'left',color:'#fff'}}>
                    <div style={{fontSize:13,fontWeight:700,color:el.color}}>{el.emoji} {el.name}</div>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.45)',marginTop:2}}>{el.desc}</div>
                    <div style={{fontSize:9,color:el.color,opacity:0.85,marginTop:3}}>{el.trait}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── ของรางวัลจากแบบฝึกหัด: ขนม + ตู้เสื้อผ้า ── */}
          <div style={{background:'rgba(255,255,255,0.04)',border:'1.5px solid rgba(251,191,36,0.28)',borderRadius:14,padding:'11px 12px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:8,color:'#fbbf24'}}>🎁 ของจากแบบฝึกหัด</div>
              <button onClick={()=>navigate('/quiz')}
                style={{background:'none',border:'none',color:'#fcd34d',fontSize:11,cursor:'pointer'}}>
                ทำแบบฝึกหัด →
              </button>
            </div>

            {/* ขนมพิเศษ */}
            <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(0,0,0,0.22)',borderRadius:11,padding:'9px 11px',marginBottom:8}}>
              <span style={{fontSize:22}}>🍬</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:'#e2e8f0'}}>ขนมพิเศษ ×{snacks}</div>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>+35 EXP · +12 ความอิ่ม ต่อชิ้น</div>
              </div>
              <button onClick={useSnack} disabled={snacks<=0||snackBusy}
                style={{padding:'7px 13px',borderRadius:10,border:'none',cursor:snacks>0&&!snackBusy?'pointer':'not-allowed',
                  background:snacks>0&&!snackBusy?'linear-gradient(135deg,#f59e0b,#fbbf24)':'rgba(255,255,255,0.07)',
                  color:snacks>0&&!snackBusy?'#1f2937':'rgba(255,255,255,0.3)',fontSize:11,fontWeight:700}}>
                {snackBusy?'...':'ให้กิน'}
              </button>
            </div>

            {/* ตู้เสื้อผ้า */}
            <button onClick={()=>setShowCloset(v=>!v)}
              style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
                background:'rgba(0,0,0,0.22)',border:'none',borderRadius:11,padding:'9px 11px',cursor:'pointer',color:'#e2e8f0'}}>
              <span style={{fontSize:12,fontWeight:700}}>
                👕 ตู้เสื้อผ้า <span style={{color:'rgba(255,255,255,0.4)',fontWeight:400}}>({wardrobe.length}/{COSTUME_LIST.length})</span>
              </span>
              <span style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>
                {costume ? `ใส่: ${COSTUMES[costume]?.emoji} ${COSTUMES[costume]?.name}` : 'ยังไม่ใส่ชุด'} {showCloset?'▲':'▼'}
              </span>
            </button>

            {showCloset && (
              <div style={{marginTop:8}}>
                {wardrobe.length === 0 ? (
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',textAlign:'center',padding:'12px 6px'}}>
                    ยังไม่มีชุดเลย — ทำแบบฝึกหัดให้ถูกเกิน 50% แล้วลุ้นสุ่มได้เลย
                  </div>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                    {COSTUME_LIST.filter(c=>wardrobe.includes(c.key)).map(c=>{
                      const on = costume===c.key;
                      const rc = RARITY[c.rarity]?.color || '#94a3b8';
                      return (
                        <button key={c.key} onClick={()=>equipCostume(on?'':c.key)}
                          style={{background:on?`${rc}26`:'rgba(255,255,255,0.04)',
                            border:`1.5px solid ${on?rc:'rgba(255,255,255,0.1)'}`,borderRadius:11,padding:'8px 9px',
                            cursor:'pointer',textAlign:'left',color:'#fff'}}>
                          <div style={{fontSize:12,fontWeight:700}}>{c.emoji} {c.name}</div>
                          <div style={{fontSize:9,color:rc,marginTop:2}}>{RARITY[c.rarity]?.label}{on?' · ใส่อยู่':''}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* ชุดที่ยังไม่ได้ */}
                {wardrobe.length < COSTUME_LIST.length && (
                  <div style={{marginTop:9}}>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:5}}>ยังไม่ได้เก็บ</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                      {COSTUME_LIST.filter(c=>!wardrobe.includes(c.key)).map(c=>(
                        <span key={c.key} title={`${c.name} · ${RARITY[c.rarity]?.label}`}
                          style={{fontSize:16,opacity:0.28,filter:'grayscale(1)'}}>{c.emoji}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{display:'flex',gap:6}}>
            {[['chat','💬','คุย'],['feed','🍖','อาหาร'],['train','⚔️','ฝึก'],['arena','🏟️','ประลอง'],
              ...(isAdmin?[['admin','🛠️','แอดมิน']]:[])].map(([key,icon,label])=>{
              const on = activeTab===key;
              return (
                <button key={key} onClick={()=>setActiveTab(key)}
                  style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5,
                    padding:'13px 0 11px',borderRadius:14,
                    border:`1.5px solid ${on?'#a78bfa':'rgba(255,255,255,0.1)'}`,
                    background:on?'rgba(167,139,250,0.18)':'rgba(255,255,255,0.04)',
                    color:on?'#a78bfa':'rgba(255,255,255,0.5)',cursor:'pointer',
                    boxShadow:on?'0 0 14px rgba(167,139,250,0.25)':'none',
                    transform:on?'translateY(-1px)':'none',transition:'all .15s ease'}}>
                  <span style={{fontSize:isAdmin?18:21,lineHeight:1}}>{icon}</span>
                  <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:isAdmin?7:9,lineHeight:1.35}}>{label}</span>
                </button>
              );
            })}
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
              <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',textAlign:'center'}}>💡 1 ตัวอักษร = +4 ความอิ่ม +4 EXP • คำยาวได้โบนัส EXP เพิ่ม</div>
              <div style={{background:'rgba(251,191,36,0.1)',border:'1px solid rgba(251,191,36,0.28)',borderRadius:10,padding:'7px 11px',fontSize:11,color:'#fcd34d'}}>
                ⚠️ ป้อนได้ <b>ครั้งละ 1 คำ</b> เท่านั้น — เว้นวรรคไม่ได้ (ระบบจะตัดช่องว่างให้อัตโนมัติ)
              </div>
              <div style={{display:'flex',gap:8}}>
                <input ref={feedRef} value={feedInput}
                  onChange={e=>{
                    const raw = e.target.value;
                    if (/\s/.test(raw)) setFeedStatus({ok:false,msg:'ป้อนได้ครั้งละ 1 คำ ห้ามเว้นวรรค'});
                    else setFeedStatus(null);
                    setFeedInput(raw.replace(/\s+/g,''));   // ตัดช่องว่างทิ้งทันที
                  }}
                  onKeyDown={e=>{
                    if(e.key===' '||e.key==='Spacebar'){ e.preventDefault(); setFeedStatus({ok:false,msg:'ป้อนได้ครั้งละ 1 คำ ห้ามเว้นวรรค'}); return; }
                    if(e.key==='Enter')feedPet();
                  }}
                  onPaste={e=>{
                    const txt=(e.clipboardData.getData('text')||'');
                    if(/\s/.test(txt)){
                      e.preventDefault();
                      setFeedInput(txt.trim().split(/\s+/)[0]);
                      setFeedStatus({ok:false,msg:'วางได้เฉพาะคำแรก — ป้อนได้ครั้งละ 1 คำ'});
                    }
                  }}
                  placeholder="พิมพ์คำศัพท์ 1 คำ..."
                  disabled={feedLoading}
                  style={{flex:1,padding:'10px 14px',background:'rgba(255,255,255,0.07)',border:'1.5px solid rgba(255,255,255,0.12)',borderRadius:11,color:'#fff',fontSize:14,outline:'none',fontFamily:'inherit',opacity:feedLoading?0.6:1}}
                  autoFocus={activeTab==='feed'}/>
                <button onClick={feedPet} disabled={feedLoading||!feedInput.trim()}
                  style={{padding:'10px 14px',background:feedLoading?'rgba(124,58,237,0.3)':'linear-gradient(135deg,#7c3aed,#a78bfa)',border:'none',borderRadius:11,color:'#fff',fontFamily:'"Press Start 2P",monospace',fontSize:8,cursor:feedLoading?'not-allowed':'pointer',minWidth:56}}>
                  {feedLoading?'...':'ให้\nอาหาร'}
                </button>
              </div>
              {feedInput.trim().length>=2&&!feedLoading&&(
                <div style={{fontSize:11,color:'#a78bfa'}}>
                  ยาว {feedInput.trim().length} ตัว → +{feedRewards(feedInput.trim().length).pts} ความอิ่ม
                  {' '}<b style={{color:'#fbbf24'}}>+{feedRewards(feedInput.trim().length).xp} EXP</b>
                  {feedInput.trim().length>=5 && <span style={{color:'#34d399'}}> (โบนัสคำยาว!)</span>}
                </div>
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
          {/* ══ ฝึกทักษะการโจมตี ══ */}
          {activeTab==='train' && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>

              {/* เลือกทักษะที่จะฝึก */}
              <div style={{display:'flex',gap:7}}>
                {TRAIN_SKILLS.map(s=>{
                  const on = trainSkill===s.key;
                  const lv = s.key==='def'?defLv:s.key==='eva'?evaLv:atkLv;
                  return (
                    <button key={s.key} onClick={()=>{ if(!trainRun) { setTrainSkill(s.key); setTrainMsg(null); } }}
                      disabled={trainRun}
                      style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'11px 0 9px',
                        borderRadius:13,cursor:trainRun?'not-allowed':'pointer',
                        border:`1.5px solid ${on?`${s.color}88`:'rgba(255,255,255,0.1)'}`,
                        background:on?`${s.color}22`:'rgba(255,255,255,0.04)',
                        boxShadow:on?`0 0 14px ${s.color}33`:'none',opacity:trainRun&&!on?0.4:1,transition:'.15s'}}>
                      <span style={{fontSize:19,lineHeight:1}}>{s.emoji}</span>
                      <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:8,lineHeight:1.3,
                        color:on?s.color:'rgba(255,255,255,0.5)'}}>{s.label}</span>
                      <span style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>Lv.{lv}</span>
                    </button>
                  );
                })}
              </div>

              {/* สรุปทักษะที่เลือก */}
              <div style={{background:`${skillDef.color}18`,border:`1.5px solid ${skillDef.color}55`,borderRadius:14,padding:'11px 13px'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
                  <span style={{fontFamily:'"Press Start 2P",monospace',fontSize:9,color:skillDef.color}}>
                    {skillDef.emoji} ทักษะ{skillDef.label} Lv.{skillLv}
                  </span>
                  {skillLv>=ATK_LV_MAX && <span style={{fontSize:10,color:'#fbbf24'}}>สูงสุดแล้ว 👑</span>}
                  <span style={{marginLeft:'auto',fontSize:11,color:'#fcd34d'}}>
                    ⚡ พลังฝึก {'●'.repeat(stamina)}{'○'.repeat(Math.max(0,STAMINA_MAX-stamina))}
                  </span>
                </div>
                {skillLv<ATK_LV_MAX && (
                  <>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'rgba(255,255,255,0.45)',marginBottom:3}}>
                      <span>ความชำนาญ</span><span>{skillXp}/{skillNeed}</span>
                    </div>
                    <div style={{height:7,background:'rgba(0,0,0,0.4)',borderRadius:4,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${Math.min(100,(skillXp/skillNeed)*100)}%`,borderRadius:4,
                        background:`linear-gradient(90deg,${skillDef.color},#fbbf24)`,transition:'width 0.5s'}}/>
                    </div>
                  </>
                )}
                <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:7}}>{skillDef.effect}</div>
              </div>

              {/* มินิเกมโจทย์เลข */}
              <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:'12px 13px'}}>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.55)',marginBottom:10,lineHeight:1.6}}>
                  {skillDef.op} <b>ฝึก{skillDef.topic}</b> — ตอบโจทย์ให้ถูก {TRAIN_QS} ข้อต่อ 1 รอบฝึก ยิ่งตอบเร็วยิ่งได้คะแนนมาก<br/>
                  <span style={{color:'rgba(255,255,255,0.35)'}}>ข้อละ {TRAIN_TIME} วินาที · ใช้พลังฝึก 1 หน่วย · ความอิ่ม −6 · ยิ่งเลเวลสูง โจทย์ยิ่งยาก</span>
                </div>

                {/* แถบความคืบหน้าแต่ละข้อ */}
                {trainRun && (
                  <div style={{display:'flex',gap:5,marginBottom:10,justifyContent:'center'}}>
                    {Array.from({length:TRAIN_QS}).map((_,i)=>{
                      const h = trainHits[i];
                      const cur = i === trainHits.length;
                      return (
                        <span key={i} style={{fontSize:11,padding:'3px 10px',borderRadius:8,
                          border:`1px solid ${cur?'#a78bfa':'transparent'}`,
                          background: h!=null ? (h>0?'rgba(52,211,153,0.2)':'rgba(239,68,68,0.2)') : 'rgba(255,255,255,0.06)',
                          color: h!=null ? (h>0?'#6ee7b7':'#fca5a5') : 'rgba(255,255,255,0.35)'}}>
                          {h!=null ? (h>0?`+${h}`:'✗') : `ข้อ ${i+1}`}
                        </span>
                      );
                    })}
                  </div>
                )}

                {trainRun && trainQ ? (
                  <>
                    {/* นาฬิกาถอยหลัง */}
                    <div style={{height:6,background:'rgba(0,0,0,0.4)',borderRadius:4,overflow:'hidden',marginBottom:10}}>
                      <div style={{height:'100%',width:`${Math.max(0,(trainLeft/TRAIN_TIME)*100)}%`,borderRadius:4,
                        background: trainLeft/TRAIN_TIME > 0.5 ? 'linear-gradient(90deg,#10b981,#34d399)'
                          : trainLeft/TRAIN_TIME > 0.25 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                          : 'linear-gradient(90deg,#dc2626,#ef4444)',
                        transition:'width .1s linear'}}/>
                    </div>

                    {/* โจทย์ */}
                    <div style={{background:'rgba(0,0,0,0.35)',border:'1.5px solid rgba(167,139,250,0.3)',borderRadius:12,
                      padding:'16px 12px',textAlign:'center',marginBottom:10}}>
                      <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:trainQ.text.includes('\n')?17:22,
                        color:'#fff',letterSpacing:1,whiteSpace:'pre-line',lineHeight:1.55}}>
                        {trainQ.text}
                      </div>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginTop:7}}>
                        เหลือ {trainLeft.toFixed(1)} วินาที
                      </div>
                    </div>

                    {/* 3 ตัวเลือก */}
                    <div style={{display:'flex',gap:7}}>
                      {trainQ.choices.map(c=>{
                        const picked = trainPick?.choice === c;
                        const reveal = !!trainPick;
                        const isAns  = c === trainQ.ans;
                        const bg = reveal
                          ? (isAns ? 'linear-gradient(135deg,#059669,#34d399)'
                            : picked ? 'linear-gradient(135deg,#b91c1c,#ef4444)' : 'rgba(255,255,255,0.05)')
                          : 'linear-gradient(135deg,#7c3aed,#a78bfa)';
                        return (
                          <button key={c} onClick={()=>answerTrain(c)} disabled={reveal}
                            style={{flex:1,padding:'15px 0',borderRadius:12,border:'none',
                              cursor:reveal?'default':'pointer',background:bg,
                              color: reveal && !isAns && !picked ? 'rgba(255,255,255,0.3)' : '#fff',
                              fontFamily:'"Press Start 2P",monospace',fontSize:14,
                              transform:picked&&isAns?'scale(1.06)':'none',transition:'all .2s ease'}}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <button onClick={startTraining} disabled={training||stamina<=0||healthKey!=='healthy'}
                    style={{width:'100%',padding:'13px',borderRadius:12,border:'none',
                      cursor:(training||stamina<=0||healthKey!=='healthy')?'not-allowed':'pointer',
                      background:(training||stamina<=0||healthKey!=='healthy')?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#7c3aed,#a78bfa)',
                      color:(training||stamina<=0||healthKey!=='healthy')?'rgba(255,255,255,0.35)':'#fff',
                      fontFamily:'"Press Start 2P",monospace',fontSize:9}}>
                    {training?'กำลังบันทึก...':stamina<=0?'พลังฝึกหมด':healthKey!=='healthy'?'น้องยังไม่แข็งแรง':'🥊 เริ่มฝึก'}
                  </button>
                )}

                {trainMsg && (
                  <div style={{marginTop:9,background:trainMsg.ok?'#10b98122':'#ef444422',
                    border:`1px solid ${trainMsg.ok?'#10b981':'#ef4444'}`,borderRadius:9,padding:'9px 12px',
                    color:trainMsg.ok?'#6ee7b7':'#fca5a5',fontSize:12}}>
                    {trainMsg.ok?'✅':'❌'} {trainMsg.msg}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ สนามประลอง PvP ══ */}
          {activeTab==='arena' && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {arenaErr && (
                <div style={{background:'#ef444422',border:'1px solid #ef4444',borderRadius:9,padding:'9px 13px',color:'#fca5a5',fontSize:12}}>
                  ❌ {arenaErr}
                </div>
              )}

              {/* ── ยังไม่อยู่ในสนาม: ล็อบบี้ ── */}
              {!arenaRoom && (
                <>
                  <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:'12px 13px'}}>
                    <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:8,color:'#a78bfa',marginBottom:7}}>🏟️ สนามประลอง</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',lineHeight:1.7,marginBottom:10}}>
                      ประลองกับเพื่อนแบบ <b style={{color:'#fcd34d'}}>ผลัดกันโจมตี</b> ทีละตา ตาละ 20 วินาที<br/>
                      ธาตุได้เปรียบ ×1.5 · ธาตุเสียเปรียบ ×0.7 · ชนะ +40 EXP +20 แต้ม · แพ้ +12 EXP
                    </div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
                      {MOVES.map(mv=>(
                        <div key={mv.key} style={{flex:'1 1 130px',background:`${mv.color}14`,border:`1px solid ${mv.color}44`,
                          borderRadius:10,padding:'7px 9px'}}>
                          <div style={{fontSize:12,color:mv.color,fontWeight:700}}>{mv.emoji} {mv.label}</div>
                          <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:2}}>{mv.desc}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={arenaCreate} disabled={xp<30||healthKey!=='healthy'}
                      style={{width:'100%',padding:'12px',borderRadius:12,border:'none',
                        cursor:(xp<30||healthKey!=='healthy')?'not-allowed':'pointer',
                        background:(xp<30||healthKey!=='healthy')?'rgba(255,255,255,0.08)':'linear-gradient(135deg,#7c3aed,#a78bfa)',
                        color:(xp<30||healthKey!=='healthy')?'rgba(255,255,255,0.35)':'#fff',
                        fontFamily:'"Press Start 2P",monospace',fontSize:9}}>
                      {xp<30?'ต้องฟักออกจากไข่ก่อน':healthKey!=='healthy'?'น้องยังไม่แข็งแรง':'+ เปิดสนามรอคู่ต่อสู้'}
                    </button>
                  </div>

                  {/* รายการสนามที่เปิดรออยู่ */}
                  <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:'11px 12px'}}>
                    <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#a78bfa',marginBottom:8}}>⚔️ สนามที่เปิดอยู่</div>
                    {arenaRooms.length===0 ? (
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',textAlign:'center',padding:'14px 0'}}>
                        ยังไม่มีใครเปิดสนาม — เปิดสนามแรกเลย!
                      </div>
                    ) : arenaRooms.map(r=>{
                      const rEl = getElem(r.element);
                      const adv = elemMul(element, r.element);
                      return (
                        <button key={r.id} onClick={()=>arenaJoin(r.id)}
                          style={{width:'100%',display:'flex',alignItems:'center',gap:9,background:'rgba(255,255,255,0.04)',
                            border:'1px solid rgba(255,255,255,0.1)',borderRadius:11,padding:'9px 11px',marginBottom:6,
                            cursor:'pointer',color:'#fff',textAlign:'left'}}>
                          <span style={{fontSize:22}}>{(PET_TYPES[r.petType]||PET_TYPES.CAT).emoji}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:700}}>{r.petName} <span style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>· {r.host}</span></div>
                            <div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>
                              {r.stage} · ⚔️ Lv.{r.atkLv} {rEl && <span style={{color:rEl.color}}>· {rEl.emoji} {rEl.name}</span>}
                            </div>
                          </div>
                          {element && rEl && adv!==1 && (
                            <span style={{fontSize:10,fontWeight:800,color:adv>1?'#4ade80':'#f87171',flexShrink:0}}>
                              {adv>1?'ได้เปรียบ':'เสียเปรียบ'}
                            </span>
                          )}
                          <span style={{color:'#a78bfa',fontSize:16}}>›</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* อันดับนักประลอง */}
                  <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,padding:'11px 12px'}}>
                    <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#a78bfa',marginBottom:8}}>🏆 อันดับนักประลอง</div>
                    <div style={{display:'flex',gap:7,marginBottom:9}}>
                      {[['ชนะ',pvpWins,'#22c55e'],['แพ้',pvpLosses,'#ef4444'],
                        ['อัตราชนะ',(pvpWins+pvpLosses)?`${Math.round(pvpWins/(pvpWins+pvpLosses)*100)}%`:'—','#fbbf24']].map(([l,v,c])=>(
                        <div key={l} style={{flex:1,background:'rgba(0,0,0,0.25)',borderRadius:10,padding:'8px 4px',textAlign:'center'}}>
                          <div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
                          <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginTop:2}}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {!arenaBoard?.rows?.length ? (
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',textAlign:'center',padding:'8px 0'}}>ยังไม่มีสถิติการประลอง</div>
                    ) : arenaBoard.rows.slice(0,8).map(r=>{
                      const rEl = getElem(r.element);
                      return (
                        <div key={r.userId} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 7px',borderRadius:9,marginBottom:3,
                          background: r.userId===user?.id?'rgba(251,191,36,0.12)':'transparent',
                          border: r.userId===user?.id?'1px solid rgba(251,191,36,0.3)':'1px solid transparent'}}>
                          <span style={{width:24,fontSize:11,fontWeight:800,color:r.rank<=3?'#fbbf24':'rgba(255,255,255,0.3)',flexShrink:0}}>
                            {r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':`#${r.rank}`}
                          </span>
                          <span style={{fontSize:15,flexShrink:0}}>{(PET_TYPES[r.petType]||PET_TYPES.CAT).emoji}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:11,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.petName}</div>
                            <div style={{fontSize:9,color:'rgba(255,255,255,0.35)'}}>
                              {r.owner} · ⚔️Lv.{r.atkLv}{rEl && <span style={{color:rEl.color}}> · {rEl.emoji}</span>}
                            </div>
                          </div>
                          <span style={{fontSize:10,color:'rgba(255,255,255,0.4)',flexShrink:0}}>
                            <b style={{color:'#22c55e'}}>{r.wins}</b>/<b style={{color:'#ef4444'}}>{r.losses}</b>
                          </span>
                          <span style={{fontSize:10,fontWeight:800,minWidth:34,textAlign:'right',flexShrink:0,
                            color:r.winRate>=60?'#4ade80':r.winRate>=40?'#fbbf24':'#f87171'}}>{r.winRate}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── อยู่ในสนามแล้ว ── */}
              {arenaRoom && (
                <ArenaView
                  room={arenaRoom} me={user?.id} ended={arenaEnded} fx={arenaFx}
                  turnLeft={turnLeft} onAttack={arenaAttack} onLeave={arenaLeave}
                />
              )}
            </div>
          )}

          {/* ══ แผงแอดมิน ══ */}
          {activeTab==='admin' && isAdmin && (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{background:'rgba(239,68,68,0.10)',border:'1.5px solid rgba(239,68,68,0.35)',borderRadius:14,padding:'11px 13px'}}>
                <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:8,color:'#f87171',marginBottom:5}}>🛠️ จัดการสัตว์เลี้ยง</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',lineHeight:1.6}}>
                  ดูสัตว์เลี้ยงของผู้ใช้ทุกคน และรีเซ็ตค่าได้ — การรีเซ็ตย้อนกลับไม่ได้ โปรดตรวจให้แน่ใจก่อนกด
                </div>
              </div>

              {adminErr && (
                <div style={{background:'#ef444422',border:'1px solid #ef4444',borderRadius:9,padding:'9px 13px',color:'#fca5a5',fontSize:12}}>
                  ⚠️ {adminErr}
                </div>
              )}

              <div style={{display:'flex',gap:7}}>
                <input value={adminQ} onChange={e=>setAdminQ(e.target.value)} placeholder="ค้นหาชื่อผู้ใช้ / ชื่อสัตว์เลี้ยง"
                  style={{flex:1,padding:'10px 12px',borderRadius:11,border:'1.5px solid rgba(255,255,255,0.12)',
                    background:'rgba(0,0,0,0.3)',color:'#fff',fontSize:12,outline:'none'}}/>
                <button onClick={loadAdmin} disabled={adminLoading}
                  style={{padding:'10px 14px',borderRadius:11,border:'1.5px solid rgba(167,139,250,0.4)',
                    background:'rgba(167,139,250,0.15)',color:'#a78bfa',fontSize:12,
                    cursor:adminLoading?'wait':'pointer'}}>
                  {adminLoading?'⏳':'🔄'} รีเฟรช
                </button>
              </div>

              {adminLoading && !adminRows && (
                <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',textAlign:'center',padding:'14px 0'}}>กำลังโหลด...</div>
              )}

              {adminRows && (() => {
                const q = adminQ.trim().toLowerCase();
                const rows = q ? adminRows.filter(r =>
                  (r.owner||'').toLowerCase().includes(q) ||
                  (r.username||'').toLowerCase().includes(q) ||
                  (r.petName||'').toLowerCase().includes(q)) : adminRows;
                if (!rows.length) return (
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.35)',textAlign:'center',padding:'14px 0'}}>
                    {adminRows.length ? 'ไม่พบผู้ใช้ที่ค้นหา' : 'ยังไม่มีใครสร้างสัตว์เลี้ยง'}
                  </div>
                );
                return (
                  <>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>ทั้งหมด {rows.length} คน (เรียงตาม EXP)</div>
                    {rows.map(r=>{
                      const open = adminOpen===r.userId;
                      const rh = getHealth(r.health);
                      const rEl = getElem(r.element);
                      const rSt = getStage(r.xp);
                      const busy = adminBusy===r.userId;
                      return (
                        <div key={r.userId} style={{background:'rgba(255,255,255,0.04)',
                          border:`1px solid ${open?'rgba(167,139,250,0.4)':'rgba(255,255,255,0.1)'}`,borderRadius:13,overflow:'hidden'}}>
                          <button onClick={()=>setAdminOpen(open?null:r.userId)}
                            style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'10px 12px',
                              background:'transparent',border:'none',color:'#fff',cursor:'pointer',textAlign:'left'}}>
                            <span style={{fontSize:20,flexShrink:0}}>{(PET_TYPES[r.petType]||PET_TYPES.CAT).emoji}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                {r.petName} <span style={{fontSize:10,fontWeight:400,color:'rgba(255,255,255,0.4)'}}>· {r.owner}</span>
                              </div>
                              <div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>
                                {rSt.label} · {r.xp} EXP · <span style={{color:rh.color}}>{rh.emoji}{rh.label}</span>
                                {rEl && <span style={{color:rEl.color}}> · {rEl.emoji}</span>}
                              </div>
                            </div>
                            <span style={{fontSize:11,color:'rgba(255,255,255,0.3)',flexShrink:0}}>{open?'▲':'▼'}</span>
                          </button>

                          {open && (
                            <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:9}}>
                              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px 10px',fontSize:11,
                                color:'rgba(255,255,255,0.55)',background:'rgba(0,0,0,0.25)',borderRadius:10,padding:'9px 11px'}}>
                                <span>👤 {r.username} <span style={{color:'rgba(255,255,255,0.3)'}}>({r.role})</span></span>
                                <span>🍖 ความอิ่ม {r.hunger}%</span>
                                <span>⚔️ โจมตี Lv.{r.atkLv}</span>
                                <span>🛡️ ป้องกัน Lv.{r.defLv}</span>
                                <span>💨 หลบหลีก Lv.{r.evaLv}</span>
                                <span>⚡ พลังฝึก {r.stamina}/{STAMINA_MAX}</span>
                                <span>📖 คำศัพท์ {r.totalWords} คำ</span>
                                <span>🏟️ {r.wins}ชนะ / {r.losses}แพ้</span>
                                <span>🌿{r.itemHerb} 🧪{r.itemKit} 🍬{r.itemSnack}</span>
                                <span>👕 ชุด {r.wardrobe.length} ชิ้น</span>
                              </div>

                              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                <button onClick={()=>adminReset(r,'heal')} disabled={busy}
                                  style={{padding:'9px 11px',borderRadius:10,cursor:busy?'wait':'pointer',fontSize:12,textAlign:'left',
                                    border:'1.5px solid rgba(110,231,183,0.4)',background:'rgba(16,185,129,0.12)',color:'#6ee7b7'}}>
                                  💚 รักษา + เติมพลัง <span style={{opacity:0.6,fontSize:10}}>(หายป่วย/บาดเจ็บ · อิ่ม 100 · พลังฝึกเต็ม)</span>
                                </button>
                                <button onClick={()=>adminReset(r,'stats')} disabled={busy}
                                  style={{padding:'9px 11px',borderRadius:10,cursor:busy?'wait':'pointer',fontSize:12,textAlign:'left',
                                    border:'1.5px solid rgba(251,191,36,0.4)',background:'rgba(251,191,36,0.12)',color:'#fbbf24'}}>
                                  🔁 ล้างทักษะ + สถิติประลอง <span style={{opacity:0.6,fontSize:10}}>(คง EXP และคำศัพท์)</span>
                                </button>
                                <button onClick={()=>adminReset(r,'full')} disabled={busy}
                                  style={{padding:'9px 11px',borderRadius:10,cursor:busy?'wait':'pointer',fontSize:12,textAlign:'left',
                                    border:'1.5px solid rgba(239,68,68,0.45)',background:'rgba(239,68,68,0.12)',color:'#fca5a5'}}>
                                  🗑️ รีเซ็ตทั้งหมดกลับเป็นไข่ <span style={{opacity:0.6,fontSize:10}}>(EXP · คำศัพท์ · ทักษะ · ชุด หายทั้งหมด)</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
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
        @keyframes petLimp  { 0%,100%{transform:translateY(0) rotate(-3deg)} 40%{transform:translateY(-4px) rotate(3deg)} 60%{transform:translateY(1px) rotate(-1deg)} }
        @keyframes auraPulse{ 0%,100%{opacity:0.15;transform:scale(0.96)} 50%{opacity:0.45;transform:scale(1.05)} }
        @keyframes runeFloat{ 0%,100%{transform:translateY(0);opacity:0.35} 50%{transform:translateY(-5px);opacity:0.9} }
        @keyframes particleRise { 0%{transform:translateY(0);opacity:0} 20%{opacity:0.9} 100%{transform:translateY(-70px);opacity:0} }
        @keyframes cloudDrift{ 0%,100%{transform:translateX(0)} 50%{transform:translateX(-5px)} }
        @keyframes rainDrop { 0%{opacity:0;transform:translateY(-3px)} 40%{opacity:0.9} 100%{opacity:0;transform:translateY(7px)} }
        @keyframes arenaLungeR { 0%{transform:scaleX(1) translateX(0)} 40%{transform:scaleX(1) translateX(26px) scale(1.12)} 100%{transform:scaleX(1) translateX(0)} }
        @keyframes arenaLungeL { 0%{transform:scaleX(-1) translateX(0)} 40%{transform:scaleX(-1) translateX(26px) scale(1.12)} 100%{transform:scaleX(-1) translateX(0)} }
        @keyframes arenaShake { 0%,100%{filter:brightness(2.4);transform:translateX(0)} 20%{transform:translateX(-7px)} 45%{transform:translateX(6px)} 70%{transform:translateX(-4px)} }
        @keyframes arenaFloat { 0%{opacity:0;transform:translateY(10px) scale(0.7)} 22%{opacity:1;transform:translateY(0) scale(1.15)} 40%{transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-46px) scale(1)} }
      `}</style>
    </div>
  );
}
