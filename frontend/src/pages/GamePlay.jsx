import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import ActorSprite from '../components/ActorSprite';
import api from '../services/api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

/* ── SFX ── */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function playTone(freq, dur, type = 'square', vol = 0.15, slideTo) {
  const ctx = ensureAudio();
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, ctx.currentTime + dur);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + dur + 0.05);
}
function playNoise(dur, vol = 0.2, filterFreq = 800) {
  const ctx = ensureAudio();
  const size = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(filter); filter.connect(gain); gain.connect(ctx.destination); src.start();
}
const SFX = {
  click:    () => playTone(600, 0.04, 'square', 0.08),
  correct:  () => { [523,659,784].forEach((f,i) => setTimeout(()=>playTone(f,.15,'sine',.2),i*80)); },
  wrong:    () => { playTone(200,.25,'sawtooth',.15,80); playNoise(.2,.1,400); },
  launch:   () => { playTone(300,.2,'sawtooth',.12,900); playNoise(.15,.08,1200); },
  impact:   () => { playNoise(.25,.3,500); playTone(60,.2,'square',.25,30); },
  heavyHit: () => { playNoise(.35,.35,400); playTone(50,.3,'square',.3,25); },
  victory:  () => { [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>playTone(f,.2,'sine',.2),i*100)); },
  beep:     () => playTone(880,.06,'square',.1),
  block:    () => { playTone(1200,.12,'square',.16,700); playNoise(.18,.14,2200); },
  heal:     () => { [523,698,880].forEach((f,i)=>setTimeout(()=>playTone(f,.18,'sine',.18),i*70)); },
  pick:     () => { playTone(700,.08,'triangle',.14,1100); },
};

/* ── Data ── */
const HUES = [210,280,330,155,22,240,0,40,170,310];
const ABILITIES = [
  { name:'Firebolt',        elem:'🔥', power:1.4, cost:1, desc:'1.4× dmg', color:'#F97316' },
  { name:'Chain Lightning', elem:'⚡', power:1.1, cost:2, desc:'1.1× dual', color:'#A78BFA' },
  { name:'Mana Surge',      elem:'✨', power:0,   cost:3, desc:'+Energy',   color:'#FBBF24' },
  { name:'Backstab',        elem:'🌑', power:1.3, cost:1, desc:'1.3× crit', color:'#6366F1' },
  { name:'Holy Strike',     elem:'☀️', power:1.6, cost:3, desc:'1.6× AOE',  color:'#FCD34D' },
  { name:'Nature Touch',    elem:'🌿', power:0.9, cost:1, desc:'0.9× heal', color:'#4ADE80' },
];

/* ── ของวิเศษ: เลือกได้ 1 อย่างก่อนเริ่มเกม ── */
const MAX_HP = 250;
const GR_ITEMS = [
  { key:'potion', emoji:'🧪', label:'ยาเพิ่มเลือด',   uses:2, color:'#22C55E',
    desc:'ฟื้น HP 70 ต่อครั้ง',  detail:'ใช้เองได้ 2 ครั้ง ระหว่างช่วงเลือกท่า' },
  { key:'shield', emoji:'🛡️', label:'เกราะป้องกัน',   uses:2, color:'#3B82F6',
    desc:'กันการโจมตี 2 ครั้ง',  detail:'ทำงานอัตโนมัติเมื่อโดนโจมตี ดาเมจเป็น 0' },
  { key:'power',  emoji:'⚔️', label:'ศิลาพลังโจมตี', uses:0, color:'#F97316',
    desc:'ดาเมจ +40%',            detail:'ติดตัวตลอดเกม ไม่จำกัดจำนวนครั้ง' },
];
const itemInfo = (k) => GR_ITEMS.find(i => i.key === k);

const CLASS_INFO = {
  warrior:     { icon:'⚔️', color:'#EF4444', label:'Warrior' },
  mage:        { icon:'🔮', color:'#A855F7', label:'Mage' },
  archer:      { icon:'🏹', color:'#22C55E', label:'Archer' },
  healer:      { icon:'💚', color:'#14B8A6', label:'Healer' },
  rogue:       { icon:'🗡️', color:'#475569', label:'Rogue' },
  knight:      { icon:'🛡️', color:'#3B82F6', label:'Knight' },
  berserker:   { icon:'💢', color:'#DC2626', label:'Berserker' },
  wizard:      { icon:'🌀', color:'#7C3AED', label:'Wizard' },
  ranger:      { icon:'🎯', color:'#16A34A', label:'Ranger' },
  paladin:     { icon:'✨', color:'#F59E0B', label:'Paladin' },
  necromancer: { icon:'💀', color:'#4B5563', label:'Necromancer' },
  monk:        { icon:'🥋', color:'#92400E', label:'Monk' },
};

function getClass(char) {
  const key = (char?.preset || 'warrior').toLowerCase();
  return CLASS_INFO[key] || CLASS_INFO.warrior;
}
function tint(i) { return `hsl(${HUES[i%HUES.length]} 60% 45%)`; }
function initials(n) { return (n||'?').slice(0,2).toUpperCase(); }

/* ── CharSprite: ตัวละครพิกเซลจริงของผู้เล่นบนสนามรบ ── */
function CharSprite({ player, idx, size = 72, hit = false, glow = false, flip = false, dead = false, walking = false, attack = false }) {
  const cls = getClass(player.character);
  const color = player.character?.topC || cls.color;
  return (
    <div style={{
      width:size, height:size, borderRadius:16,
      background:`linear-gradient(135deg,${color}33,${color}11)`,
      border:`2.5px solid ${glow?color:'rgba(255,255,255,.15)'}`,
      display:'flex', alignItems:'center', justifyContent:'center',
      transform: hit?'scale(1.18)':'scale(1)',
      transition:'transform .3s,box-shadow .3s',
      boxShadow: glow ? `0 0 20px ${color}88` : '0 4px 12px rgba(0,0,0,.4)',
      flexShrink:0, cursor:'pointer', position:'relative', overflow:'hidden',
    }}>
      <ActorSprite
        character={player.character}
        size={size*0.98}
        dir={flip ? 1 : 2}
        walking={walking}
        attack={attack}
        hit={hit}
        dead={dead}
      />
      {glow && (
        <div style={{position:'absolute',inset:-4,borderRadius:18,border:`2px solid ${color}`,animation:'ringPulse 1s ease infinite',pointerEvents:'none'}}/>
      )}
      {/* โล่ยังเหลืออยู่ — เรืองแสงคลุมตัว */}
      {player.shieldUp && !dead && (
        <div style={{
          position:'absolute',inset:0,borderRadius:14,pointerEvents:'none',
          border:'2px solid #60A5FA',
          background:'radial-gradient(circle at 50% 55%,rgba(96,165,250,.28),transparent 70%)',
          boxShadow:'inset 0 0 18px rgba(96,165,250,.5)',
          animation:'shieldShimmer 2s ease infinite',
        }}/>
      )}
      {/* ป้ายของวิเศษ */}
      {player.item && !dead && (
        <div style={{
          position:'absolute',top:2,right:2,fontSize:11,lineHeight:1,
          background:'rgba(0,0,0,.65)',borderRadius:8,padding:'2px 4px',
          display:'flex',alignItems:'center',gap:2,pointerEvents:'none',
        }}>
          <span>{itemInfo(player.item)?.emoji}</span>
          {player.item !== 'power' && (
            <span style={{fontSize:9,fontWeight:800,color:'#FBBF24'}}>{player.itemUses}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── HP Bar ── */
function HpBar({ hp, maxHp = MAX_HP, label, width = 96, height = 9 }) {
  const val = Math.max(0, hp ?? 0);
  const pct = Math.max(0, Math.min(100, (val / maxHp) * 100));
  const color = pct > 50 ? '#22C55E' : pct > 25 ? '#FBBF24' : '#EF4444';
  return (
    <div style={{width, minWidth:width, flexShrink:0}}>
      {label && <div style={{fontSize:11,fontWeight:600,marginBottom:3,color:'#94A3B8'}}>{label}</div>}
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <div style={{
          flex:1, height, background:'#0F172A', borderRadius:height/2,
          overflow:'hidden', border:'1px solid rgba(255,255,255,.12)',
        }}>
          <div style={{
            height:'100%', width:`${pct}%`, borderRadius:height/2,
            background:`linear-gradient(90deg,${color},${color}aa)`,
            boxShadow:`0 0 8px ${color}66`,
            transition:'width .7s cubic-bezier(.2,1,.35,1),background .3s',
          }}/>
        </div>
        <span style={{fontSize:11,fontWeight:800,color,flexShrink:0,minWidth:40,textAlign:'right',fontFamily:'Consolas,monospace'}}>{val}</span>
      </div>
    </div>
  );
}

/* ── Attack Projectile ── */
function Projectile({ from, to, color, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !from || !to) return;
    const el = ref.current;
    const dx = to.x - from.x, dy = to.y - from.y;
    el.style.setProperty('--dx', dx+'px');
    el.style.setProperty('--dy', dy+'px');
    const t = setTimeout(onDone, 420);
    return () => clearTimeout(t);
  }, []);
  if (!from || !to) return null;
  return (
    <div ref={ref} style={{
      position:'fixed', left: from.x-20, top: from.y-20,
      width:40, height:40, zIndex:200, pointerEvents:'none',
      animation:'projectileFly .42s cubic-bezier(.4,0,.2,1) forwards',
    }}>
      {/* หางไฟ */}
      <div style={{
        position:'absolute', inset:-14, borderRadius:'50%',
        background:`radial-gradient(circle,${color}66,transparent 70%)`,
        animation:'projTrail .42s ease-out forwards',
      }}/>
      {/* แกนกลาง */}
      <div style={{
        position:'absolute', inset:0, borderRadius:'50%',
        background:`radial-gradient(circle at 32% 30%, #fff, ${color} 55%, transparent 82%)`,
        boxShadow:`0 0 26px 10px ${color}cc, 0 0 60px 20px ${color}44`,
        animation:'projSpin .42s linear infinite',
      }}/>
    </div>
  );
}

/* ── แสงวาบเต็มจอตอนกระแทก ── */
function ScreenFlash({ color, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 400); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:190, pointerEvents:'none',
      background:`radial-gradient(circle at 50% 45%, ${color}55, ${color}18 40%, transparent 72%)`,
      animation:'screenFlash .4s ease-out forwards',
    }}/>
  );
}

/* ── Impact Burst ── */
function ImpactBurst({ pos, color, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 900); return () => clearTimeout(t); }, []);
  if (!pos) return null;
  return (
    <>
      {/* คลื่นกระแทก 3 ชั้น */}
      {[0, 90, 180].map((delay, i) => (
        <div key={`ring${i}`} style={{
          position:'fixed', left:pos.x-55, top:pos.y-55,
          width:110, height:110, borderRadius:'50%', zIndex:195, pointerEvents:'none',
          border:`${4-i}px solid ${color}`, boxShadow:`0 0 34px 10px ${color}55`,
          animation:`impactBurst .7s ease-out ${delay}ms forwards`, opacity:0,
        }}/>
      ))}
      {/* แกนแสงขาว */}
      <div style={{
        position:'fixed', left:pos.x-42, top:pos.y-42,
        width:84, height:84, borderRadius:'50%', zIndex:196, pointerEvents:'none',
        background:`radial-gradient(circle,#fff,${color} 45%,transparent 72%)`,
        animation:'impactCore .45s ease-out forwards',
      }}/>
      {/* แฉกแสง */}
      {[0, 45, 90, 135].map((rot, i) => (
        <div key={`spark${i}`} style={{
          position:'fixed', left:pos.x-70, top:pos.y-3,
          width:140, height:6, zIndex:196, pointerEvents:'none',
          background:`linear-gradient(90deg,transparent,${color},#fff,${color},transparent)`,
          transform:`rotate(${rot}deg)`, transformOrigin:'50% 50%',
          animation:'sparkLine .5s ease-out forwards',
        }}/>
      ))}
      {/* สะเก็ด */}
      {[...Array(22)].map((_,i) => {
        const a = (i/22)*Math.PI*2 + Math.random()*0.3;
        const d = 60 + Math.random()*70;
        const sz = 5 + Math.random()*6;
        return <div key={i} style={{
          position:'fixed', left:pos.x-sz/2, top:pos.y-sz/2,
          width:sz, height:sz, borderRadius:'50%', zIndex:197, pointerEvents:'none',
          background: i%3===0 ? '#fff' : color, boxShadow:`0 0 10px 3px ${color}aa`,
          '--px': Math.cos(a)*d+'px', '--py': Math.sin(a)*d+'px',
          animation:`particleOut ${.6+Math.random()*.35}s ease-out forwards`,
        }}/>;
      })}
    </>
  );
}

/* ── ป้าย BLOCK ตอนเกราะกันไว้ ── */
function BlockText({ x, y }) {
  return (
    <div style={{
      position:'fixed', left:x-56, top:y-24, width:112, textAlign:'center',
      fontSize:26, fontWeight:900, color:'#60A5FA', letterSpacing:2,
      textShadow:'0 0 18px rgba(96,165,250,.9),0 2px 8px rgba(0,0,0,.7)',
      animation:'blockPop .9s cubic-bezier(.22,1,.36,1) forwards',
      zIndex:210, pointerEvents:'none',
    }}>🛡️ BLOCK!</div>
  );
}

/* ── ตัวเลขฟื้นพลัง ── */
function HealFloat({ n, x, y }) {
  return (
    <div style={{
      position:'fixed', left:x-24, top:y,
      fontSize:32, fontWeight:900, color:'#4ADE80',
      textShadow:'0 0 16px rgba(74,222,128,.8),0 2px 8px rgba(0,0,0,.6)',
      animation:'floatUp 1.2s ease forwards', zIndex:210, pointerEvents:'none',
    }}>+{n}</div>
  );
}

/* ── Floating Damage ── */
function DmgFloat({ n, crit, x, y, empowered }) {
  return (
    <div style={{
      position:'fixed', left:x-40, top:y, width:80, textAlign:'center',
      fontSize: crit?56:38, fontWeight:900,
      color: crit?'#FDE047':'#FBBF24',
      WebkitTextStroke: crit?'2px rgba(120,53,15,.9)':'1px rgba(120,53,15,.7)',
      textShadow: crit
        ? '0 0 26px rgba(253,224,71,.95),0 0 60px rgba(249,115,22,.7),0 3px 10px rgba(0,0,0,.7)'
        : '0 0 14px rgba(251,191,36,.7),0 2px 8px rgba(0,0,0,.6)',
      animation: crit?'dmgCritPop 1.3s cubic-bezier(.22,1,.36,1) forwards':'floatUp 1.1s ease forwards',
      zIndex:210, pointerEvents:'none', lineHeight:1,
    }}>
      −{n}
      {empowered && <div style={{fontSize:12,color:'#F97316',fontWeight:800,marginTop:2}}>⚔️ EMPOWERED</div>}
      {crit && <div style={{fontSize:14,color:'#FDE047',fontWeight:800,letterSpacing:2}}>CRITICAL!</div>}
    </div>
  );
}

/* ══════════════════════════════════════════════
   BATTLE BOARD
══════════════════════════════════════════════ */
function BattleBoard({ players, myId, targetId, setTargetId, attacking, abilityIdx, lungeIds = [], hitIds = [] }) {
  const myPlayer = players.find(p => p.id === myId);
  const myIdx = players.indexOf(myPlayer);
  const enemies = players.filter(p => p.id !== myId);
  const abilityColor = ABILITIES[abilityIdx]?.color || '#FBBF24';

  const myRef = useRef(null);
  const enemyRefs = useRef({});

  return (
    <div style={{
      background:'linear-gradient(135deg,#0F1A2E,#1A0E2E)',
      borderRadius:20, padding:'20px 16px', marginBottom:14,
      border:'1px solid rgba(255,255,255,.08)',
      position:'relative', overflow:'hidden',
    }}>
      {/* Grid background */}
      <div style={{
        position:'absolute',inset:0,opacity:.06,
        backgroundImage:'linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px)',
        backgroundSize:'40px 40px',pointerEvents:'none',
      }}/>

      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        position:'relative', minHeight:110,
      }}>
        {/* My character (left side) */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
          <div ref={myRef} id={`char-${myId}`} style={{position:'relative'}}>
            <CharSprite player={myPlayer||{character:{}}} idx={myIdx}
              size={76} glow={!!attacking} hit={hitIds.includes(myId)}
              walking={!attacking && (myPlayer?.hp ?? 0) > 0}
              attack={!!attacking || lungeIds.includes(myId)}
              dead={(myPlayer?.hp ?? 0) <= 0}/>
            {attacking && (
              <div style={{
                position:'absolute',bottom:-4,left:'50%',transform:'translateX(-50%)',
                fontSize:9,fontWeight:700,color:abilityColor,background:'rgba(0,0,0,.7)',
                padding:'2px 6px',borderRadius:999,whiteSpace:'nowrap',
              }}>{ABILITIES[abilityIdx]?.elem} {ABILITIES[abilityIdx]?.name}</div>
            )}
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:11,fontWeight:600,color:'#93C5FD',marginBottom:3}}>คุณ</div>
            <HpBar hp={myPlayer?.hp||0} maxHp={myPlayer?.maxHp||MAX_HP} width={112}/>
          </div>
        </div>

        {/* VS */}
        <div style={{
          fontSize:18,fontWeight:900,color:'rgba(255,255,255,.2)',
          padding:'0 8px',flexShrink:0,
        }}>VS</div>

        {/* Enemies (right side) */}
        <div style={{display:'flex',flexDirection:'column',gap:10,alignItems:'flex-end'}}>
          {enemies.map((p, i) => {
            const isTarget = targetId === p.id;
            const isDead = p.hp <= 0;
            return (
              <div key={p.id} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                <div
                  id={`char-${p.id}`}
                  ref={el => { if(el) enemyRefs.current[p.id]=el; }}
                  onClick={() => !isDead && setTargetId(p.id)}
                  style={{cursor:isDead?'default':'pointer',position:'relative'}}
                >
                  <CharSprite player={p} idx={i+2} size={68} flip glow={isTarget} dead={isDead}
                    walking={!isDead && !lungeIds.includes(p.id)}
                    attack={lungeIds.includes(p.id)} hit={hitIds.includes(p.id)}/>
                  {isTarget && !isDead && (
                    <div style={{
                      position:'absolute',top:-10,left:'50%',transform:'translateX(-50%)',
                      fontSize:16,animation:'bounceUpDown 0.6s ease infinite',
                    }}>🎯</div>
                  )}
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:10,color:'#F87171',fontWeight:600,maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',margin:'0 auto 3px'}}>{p.name}</div>
                  <HpBar hp={p.hp} maxHp={p.maxHp||MAX_HP} width={104}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attack hint */}
      {!targetId && enemies.some(p=>p.hp>0) && (
        <div style={{textAlign:'center',fontSize:11,color:'#94A3B8',marginTop:10}}>
          👆 แตะตัวละครฝั่งตรงข้ามเพื่อเลือกเป้าหมาย
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════ */
export default function GamePlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  const [room, setRoom] = useState(location.state?.room || null);
  const [phase, setPhase] = useState('lobby');
  const [question, setQuestion] = useState(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [totalQ, setTotalQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(12);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [choiceResult, setChoiceResult] = useState(null);
  const [selectedAbility, setSelectedAbility] = useState(0);
  const [targetId, setTargetId] = useState(null);
  const [evalResult, setEvalResult] = useState(null);
  const [winner, setWinner] = useState(null);
  const [toast, setToast] = useState('');
  const [vfx, setVfx] = useState([]); // [{id, type, ...}]
  const [attacking, setAttacking] = useState(false);
  const [lungeIds, setLungeIds] = useState([]);   // ตัวละครที่กำลังพุ่งเข้าโจมตี
  const [hitIds, setHitIds] = useState([]);       // ตัวละครที่กำลังโดนตี
  const [ranking, setRanking] = useState([]);     // อันดับของเกมนี้
  const [leaderboard, setLeaderboard] = useState(null); // สถิติชนะ/แพ้รวม
  const [revealLeft, setRevealLeft] = useState(0);      // นับถอยหลังเวลาโชว์เฉลย
  const revealTimerRef = useRef(null);
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const answerSentRef = useRef(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const loadLeaderboard = useCallback(() => {
    api.get('/game/leaderboard').then(r => setLeaderboard(r.data)).catch(() => {});
  }, []);

  const addVfx = (vfxObj) => {
    const id = Date.now() + Math.random();
    const obj = { id, ...vfxObj };
    setVfx(prev => [...prev, obj]);
    setTimeout(() => setVfx(prev => prev.filter(v => v.id !== id)), 1200);
    return id;
  };

  const playAttackVfx = useCallback((casterId, targetIdV, damage, abilityIdx, opts = {}) => {
    const { blocked = false, empowered = false } = opts;
    const crit = damage >= 45;
    const fromEl = document.getElementById(`char-${casterId}`);
    const toEl   = document.getElementById(`char-${targetIdV}`);
    if (!fromEl || !toEl) {
      addVfx({ type:'dmg', n:damage, crit, empowered, x:window.innerWidth/2, y:window.innerHeight/3 });
      return;
    }
    const fr = fromEl.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    const from = { x: fr.left+fr.width/2, y: fr.top+fr.height/2 };
    const to   = { x: tr.left+tr.width/2, y: tr.top+tr.height/2 };
    const color = ABILITIES[abilityIdx]?.color || '#FBBF24';

    // ตัวละครผู้โจมตีพุ่งเข้าใส่
    setLungeIds(ids => [...ids, casterId]);
    setTimeout(() => setLungeIds(ids => ids.filter(id => id !== casterId)), 460);

    // Projectile
    addVfx({ type:'proj', from, to, color });

    // Impact + dmg after projectile
    setTimeout(() => {
      setHitIds(ids => [...ids, targetIdV]);
      setTimeout(() => setHitIds(ids => ids.filter(id => id !== targetIdV)), 340);

      if (blocked) {
        SFX.block();
        addVfx({ type:'impact', pos:to, color:'#60A5FA' });
        addVfx({ type:'flash', color:'#60A5FA' });
        addVfx({ type:'block', x:to.x, y:to.y-50 });
        document.body.classList.add('shake-medium');
        setTimeout(() => document.body.classList.remove('shake-medium'), 400);
        return;
      }

      crit ? SFX.heavyHit() : SFX.impact();
      addVfx({ type:'impact', pos:to, color });
      addVfx({ type:'flash', color });
      addVfx({ type:'dmg', n:damage, crit, empowered, x:to.x, y:to.y-70 });
      // Shake — แรงขึ้นเมื่อดาเมจสูง
      const cls = crit ? 'shake-heavy' : 'shake-medium';
      document.body.classList.add(cls);
      setTimeout(() => document.body.classList.remove(cls), crit ? 560 : 400);
    }, 400);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const sock = io(SOCKET_URL, { auth: { token } });
    socketRef.current = sock;

    const initRoom = location.state?.room;
    const joinRoom = () => { if (initRoom) sock.emit('game:join_room', { roomId: initRoom.id }); };
    sock.on('connect', joinRoom);
    if (sock.connected) joinRoom();

    sock.on('game:room_joined', (r) => {
      setRoom(r);
      setPhase(r.status === 'playing' ? 'loading' : 'lobby');
    });
    sock.on('game:room_updated', (r) => {
      if (r) setRoom(r); else { showToast('ห้องถูกยกเลิก'); navigate('/game'); }
    });
    sock.on('game:error', showToast);

    sock.on('game:started', (r) => { setRoom(r); setPhase('starting'); });

    sock.on('game:question', ({ questionIdx: qi, total, question: q, choices, timeLimit }) => {
      setQuestion({ question: q, choices });
      setQuestionIdx(qi);
      setTotalQ(total);
      setSelectedChoice(null);
      setChoiceResult(null);
      setEvalResult(null);
      answerSentRef.current = false;
      setTimeLeft(timeLimit || 12);
      startTimeRef.current = Date.now();
      setPhase('question');

      clearInterval(timerRef.current);
      let t = timeLimit || 12;
      timerRef.current = setInterval(() => {
        t = parseFloat((t - 0.1).toFixed(1));
        setTimeLeft(t);
        if (t <= 4 && t > 0) SFX.beep();
        if (t <= 0) clearInterval(timerRef.current);
      }, 100);
    });

    sock.on('game:eval', ({ correctAnswer, correctIndex, playerResults, scores, revealMs }) => {
      clearInterval(timerRef.current);
      setChoiceResult({ correctIndex, playerResults });
      setEvalResult({ correctAnswer, playerResults, scores, revealMs: revealMs || 4500 });
      const myRes = playerResults[user?.id];
      if (myRes?.correct) SFX.correct(); else SFX.wrong();
      setPhase('eval');

      // นับถอยหลังเวลาที่เฉลยยังโชว์อยู่
      let left = (revealMs || 4500) / 1000;
      setRevealLeft(left);
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = setInterval(() => {
        left = parseFloat((left - 0.1).toFixed(1));
        setRevealLeft(Math.max(0, left));
        if (left <= 0) clearInterval(revealTimerRef.current);
      }, 100);
    });

    sock.on('game:action_phase', ({ evalResults, players, scores }) => {
      setRoom(r => r ? { ...r, players, scores: scores || r.scores } : r);
      setEvalResult(ev => ev ? { ...ev, playerResults: evalResults } : { playerResults: evalResults });
      setTargetId(null);
      setSelectedAbility(0);
      setAttacking(false);
      setPhase('action');
    });

    sock.on('game:result', ({ actionResults, players, scores }) => {
      // Play attack VFX for each action
      actionResults?.forEach((ar, i) => {
        if (ar.targetId && (ar.damage > 0 || ar.blocked)) {
          setTimeout(() => playAttackVfx(
            ar.casterId, ar.targetId, ar.damage, ar.abilityIdx ?? 0,
            { blocked: !!ar.blocked, empowered: !!ar.empowered },
          ), i * 260);
        }
      });

      setTimeout(() => {
        setRoom(r => r ? { ...r, players, scores: scores || r.scores } : r);
        setPhase('result');
      }, 600);
    });

    sock.on('game:item_used', ({ userId, healed, players }) => {
      setRoom(r => r ? { ...r, players } : r);
      SFX.heal();
      const el = document.getElementById(`char-${userId}`);
      const rect = el?.getBoundingClientRect();
      addVfx({
        type:'heal', n:healed,
        x: rect ? rect.left + rect.width/2 : window.innerWidth/2,
        y: rect ? rect.top - 10 : window.innerHeight/3,
      });
      addVfx({ type:'flash', color:'#22C55E' });
    });

    sock.on('game:ended', ({ winner: w, players, scores, ranking: rk }) => {
      setWinner(w);
      setRanking(rk || []);
      loadLeaderboard();
      setRoom(r => r ? { ...r, players, scores } : r);
      setPhase('ended');
      if (w.id === user?.id) { SFX.victory(); spawnConfetti(); }
    });

    return () => { clearInterval(timerRef.current); clearInterval(revealTimerRef.current); sock.disconnect(); };
  }, []);

  const spawnConfetti = () => {
    const colors = ['#FBBF24','#A855F7','#3B82F6','#22C55E','#EF4444'];
    for (let i = 0; i < 40; i++) {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;width:8px;height:8px;border-radius:2px;z-index:150;pointer-events:none;background:${colors[i%5]};left:${Math.random()*100}vw;top:-10px;animation:confettiFall ${1.8+Math.random()*1.2}s ease-in ${Math.random()*0.8}s forwards;`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    }
  };

  const handleAnswer = (idx) => {
    if (selectedChoice !== null || answerSentRef.current) return;
    answerSentRef.current = true;
    setSelectedChoice(idx);
    const responseTime = parseFloat(((Date.now() - (startTimeRef.current||Date.now())) / 1000).toFixed(2));
    socketRef.current?.emit('game:answer', { roomId: room?.id, choiceIdx: idx, responseTime });
    SFX.click();
  };

  const handleCast = () => {
    if (!targetId) return showToast('แตะตัวละครฝั่งตรงข้ามเพื่อเลือกเป้าหมาย');
    setAttacking(true);
    SFX.launch();
    socketRef.current?.emit('game:cast_action', { roomId: room?.id, targetId, abilityIdx: selectedAbility });
    setTimeout(() => setAttacking(false), 500);
  };

  const handlePickItem = (key) => {
    SFX.pick();
    socketRef.current?.emit('game:pick_item', { roomId: room?.id, itemKey: key });
  };

  const handleUseItem = () => {
    SFX.click();
    socketRef.current?.emit('game:use_item', { roomId: room?.id });
  };

  const handleStart = () => socketRef.current?.emit('game:start_game', { roomId: room?.id });
  const handleLeave = () => { socketRef.current?.emit('game:leave_room', { roomId: room?.id }); navigate('/game'); };

  const myPlayer = room?.players?.find(p => p.id === user?.id);
  const myEvalRes = evalResult?.playerResults?.[user?.id];
  const isHost = room?.host?.id === user?.id;
  const canCast = myEvalRes?.correct && myEvalRes?.baseDmg > 0 && ABILITIES[selectedAbility]?.power > 0;

  /* ── CSS ── */
  const css = `
    @keyframes fadeSlideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
    @keyframes scalePop{0%{transform:scale(1)}40%{transform:scale(1.18)}70%{transform:scale(.95)}100%{transform:scale(1)}}
    @keyframes shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-8px)}30%{transform:translateX(8px)}45%{transform:translateX(-6px)}60%{transform:translateX(6px)}}
    @keyframes greenFlash{0%{background:#14532D}40%{background:#22C55E}100%{background:#14532D}}
    @keyframes redFlash{0%{background:#450A0A}40%{background:#EF4444}100%{background:#450A0A}}
    @keyframes floatUp{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-60px)}}
    @keyframes dmgCritPop{0%{transform:scale(.3) translateY(0);opacity:0}30%{transform:scale(1.4) translateY(-10px);opacity:1}60%{transform:scale(1.1) translateY(-30px);opacity:1}100%{transform:scale(.9) translateY(-70px);opacity:0}}
    @keyframes projectileFly{0%{transform:translate(0,0) scale(.4);opacity:1}70%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1.1);opacity:.9}}
    @keyframes impactBurst{0%{transform:scale(.2);opacity:1}50%{transform:scale(1.4);opacity:.8}100%{transform:scale(2.2);opacity:0}}
    @keyframes particleOut{0%{transform:translate(0,0);opacity:1}100%{transform:translate(var(--px),var(--py)) scale(0);opacity:0}}
    @keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
    @keyframes bounceIn{0%{transform:scale(0);opacity:0}50%{transform:scale(1.15)}70%{transform:scale(.95)}100%{transform:scale(1);opacity:1}}
    @keyframes bounceUpDown{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-5px)}}
    @keyframes actorLunge{0%{transform:translateX(0)}35%{transform:translateX(16px) scale(1.08)}60%{transform:translateX(10px)}100%{transform:translateX(0)}}
    @keyframes actorLungeL{0%{transform:translateX(0)}35%{transform:translateX(-16px) scale(1.08)}60%{transform:translateX(-10px)}100%{transform:translateX(0)}}
    @keyframes ringPulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.9;transform:scale(1.1)}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes timerUrgent{0%,100%{color:#FBBF24;transform:scale(1)}50%{color:#EF4444;transform:scale(1.08)}}
    @keyframes shakeMedium{0%,100%{transform:translate(0,0)}10%{transform:translate(-6px,2px)}20%{transform:translate(5px,-3px)}30%{transform:translate(-4px,4px)}40%{transform:translate(4px,-2px)}50%{transform:translate(-3px,1px)}60%{transform:translate(2px,-2px)}70%{transform:translate(-1px,1px)}}
    body.shake-medium{animation:shakeMedium .4s ease-out;}
    @keyframes shakeHeavy{0%,100%{transform:translate(0,0) rotate(0)}8%{transform:translate(-12px,5px) rotate(-.6deg)}18%{transform:translate(11px,-7px) rotate(.6deg)}28%{transform:translate(-10px,8px) rotate(-.5deg)}38%{transform:translate(9px,-5px) rotate(.4deg)}50%{transform:translate(-7px,4px) rotate(-.3deg)}62%{transform:translate(6px,-4px) rotate(.3deg)}74%{transform:translate(-4px,2px)}86%{transform:translate(2px,-1px)}}
    body.shake-heavy{animation:shakeHeavy .56s cubic-bezier(.36,.07,.19,.97);}

    /* ── VFX รอบใหญ่ ── */
    @keyframes shieldShimmer{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.85;transform:scale(1.12)}}
    @keyframes projTrail{0%{opacity:.9;transform:scale(1.6,.7)}100%{opacity:0;transform:scale(2.6,.4)}}
    @keyframes projSpin{0%{transform:rotate(0deg) scale(1)}100%{transform:rotate(720deg) scale(1.15)}}
    @keyframes screenFlash{0%{opacity:0}12%{opacity:.55}100%{opacity:0}}
    @keyframes impactCore{0%{transform:scale(.2);opacity:1}45%{transform:scale(1.5);opacity:.95}100%{transform:scale(2.6);opacity:0}}
    @keyframes sparkLine{0%{transform:rotate(var(--rot)) scaleX(0);opacity:1}45%{transform:rotate(var(--rot)) scaleX(1.35);opacity:1}100%{transform:rotate(var(--rot)) scaleX(1.9);opacity:0}}
    @keyframes blockPop{0%{transform:scale(.3) translateY(0);opacity:0}30%{transform:scale(1.25);opacity:1}70%{transform:scale(1) translateY(-16px);opacity:1}100%{transform:scale(.9) translateY(-42px);opacity:0}}
    @keyframes healFloat{0%{transform:scale(.5) translateY(0);opacity:0}25%{transform:scale(1.2);opacity:1}100%{transform:scale(1) translateY(-64px);opacity:0}}

    /* ── ของวิเศษ ── */
    .gp-item{background:#1F2937;border:2px solid #334155;border-radius:14px;padding:11px 12px;display:flex;align-items:center;gap:11px;text-align:left;width:100%;cursor:pointer;margin-bottom:8px;color:#F8FAFC;font-family:inherit;transition:.18s;}
    .gp-item:hover{transform:translateX(3px);border-color:#64748B;}
    .gp-item:active{transform:scale(.97);}
    .gp-item.on{border-color:var(--ic,#FBBF24);background:#111827;box-shadow:0 0 18px rgba(251,191,36,.22);}
    .gp-item .emo{font-size:26px;flex-shrink:0;}
    .gp-item .nm{font-size:14px;font-weight:800;}
    .gp-item .ds{font-size:11px;color:#94A3B8;margin-top:2px;}

    .gp-root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:#0A0F1A;color:#F8FAFC;min-height:100vh;}
    .gp-wrap{max-width:480px;margin:0 auto;padding:14px 14px 80px;min-height:100vh;}
    .gp-topbar{display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #1F2937;margin-bottom:12px;}
    .gp-logo{font-weight:800;font-size:16px;color:#FBBF24;letter-spacing:1px;}
    .gp-phase{background:#1F2937;color:#94A3B8;font-size:10px;padding:3px 9px;border-radius:20px;text-transform:uppercase;letter-spacing:1px;}
    .gp-card{background:#111827;border-radius:16px;padding:14px;margin-bottom:12px;border:1px solid #1F2937;}
    .gp-card.gold{border:2px solid #FBBF24;box-shadow:0 0 20px rgba(251,191,36,.15);}
    .gp-status{display:flex;justify-content:space-between;align-items:center;background:#1F2937;border-radius:10px;padding:9px 14px;margin-bottom:12px;font-size:13px;color:#94A3B8;}
    .gp-timer{background:#1E3A5F;color:#FBBF24;font-family:Consolas,monospace;font-weight:700;font-size:16px;padding:5px 12px;border-radius:8px;transition:.3s;}
    .gp-timer.urgent{background:#450A0A;animation:timerUrgent .6s ease infinite;}
    .gp-btn{display:block;width:100%;padding:13px;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;margin-bottom:8px;transition:.15s;font-family:inherit;color:#F8FAFC;}
    .gp-btn:active{transform:scale(.96);}
    .gp-btn-gold{background:linear-gradient(135deg,#FBBF24,#F59E0B);color:#0A0F1A;position:relative;overflow:hidden;}
    .gp-btn-gold::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);background-size:200%;animation:shimmer 2.5s infinite;}
    .gp-btn-gold:hover{box-shadow:0 4px 20px rgba(251,191,36,.4);}
    .gp-btn-gold:disabled{opacity:.5;pointer-events:none;}
    .gp-btn-outline{background:transparent;border:1px solid #374151;color:#94A3B8;}
    .gp-choice{background:#1F2937;color:#F8FAFC;border:1.5px solid #334155;text-align:left;padding-left:16px;transition:.2s;}
    .gp-choice:hover:not(:disabled){border-color:#FBBF24;background:#1E293B;transform:translateX(3px);}
    .gp-choice.correct{border-color:#22C55E!important;animation:greenFlash .6s ease,scalePop .4s ease;}
    .gp-choice.wrong{border-color:#EF4444!important;animation:redFlash .6s ease,shake .45s ease;}
    .gp-choice.revealed{border-color:#22C55E!important;background:#14532D!important;}
    .gp-choice:disabled{pointer-events:none;}
    .gp-ability{background:#1F2937;color:#F8FAFC;border:1.5px solid #334155;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;text-align:left;transition:.2s;}
    .gp-ability:hover{transform:translateX(3px);}
    .gp-ability.on{border-color:#FBBF24;border-width:2px;box-shadow:0 0 14px rgba(251,191,36,.2);}
    .gp-combo{background:linear-gradient(135deg,#4C1D95,#7C3AED);border-radius:12px;padding:11px;text-align:center;font-weight:700;font-size:14px;margin-bottom:12px;animation:bounceIn .5s cubic-bezier(.22,1,.36,1);}
    .gp-toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#111827;border:1px solid #FBBF24;color:#FBBF24;padding:9px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:300;opacity:0;pointer-events:none;transition:.25s;}
    .gp-toast.show{opacity:1;}
    .gp-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
    .gp-stat{background:#1F2937;border-radius:10px;padding:12px;text-align:center;}
    .gp-stat .val{font-size:20px;font-weight:800;color:#FBBF24;}
    .gp-stat .lbl{font-size:11px;color:#94A3B8;margin-top:3px;}
  `;

  return (
    <div className="gp-root">
      <style>{css}</style>

      {/* VFX layer */}
      {vfx.map(v => {
        if (v.type === 'proj') return <Projectile key={v.id} from={v.from} to={v.to} color={v.color} onDone={()=>{}}/>;
        if (v.type === 'impact') return <ImpactBurst key={v.id} pos={v.pos} color={v.color} onDone={()=>{}}/>;
        if (v.type === 'dmg') return <DmgFloat key={v.id} n={v.n} crit={v.crit} empowered={v.empowered} x={v.x} y={v.y}/>;
        if (v.type === 'flash') return <ScreenFlash key={v.id} color={v.color} onDone={()=>{}}/>;
        if (v.type === 'block') return <BlockText key={v.id} x={v.x} y={v.y}/>;
        if (v.type === 'heal') return <HealFloat key={v.id} n={v.n} x={v.x} y={v.y}/>;
        return null;
      })}

      <div className={`gp-toast${toast?' show':''}`}>{toast}</div>

      <div className="gp-wrap">
        <div className="gp-topbar">
          <div className="gp-logo">⚔️ QUIZ RUMBLE</div>
          <div className="gp-phase">{phase === 'question' ? `ข้อ ${questionIdx+1}/${totalQ}` : phase}</div>
        </div>

        {/* ── LOBBY ── */}
        {phase === 'lobby' && room && (
          <>
            <div className="gp-card gold" style={{textAlign:'center',padding:'20px 16px'}}>
              <div style={{fontSize:32,marginBottom:8}}>🏟️</div>
              <h2 style={{margin:'0 0 4px',fontSize:17}}>{room.name}</h2>
              <div style={{fontSize:12,color:'#94A3B8',marginBottom:4}}>{room.quizTitle}</div>
              <div style={{fontSize:12,color:'#4ADE80',fontWeight:600}}>{room.players?.length}/{room.maxPlayers} ผู้เล่น</div>
              <div style={{fontSize:12,color:'#FBBF24',fontWeight:600,marginTop:4}}>⏱️ ตอบข้อละ {room.timeLimit || 12} วินาที</div>
            </div>

            <div className="gp-card">
              <div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>ผู้เล่น</div>
              {room.players?.map((p, i) => {
                const cls = getClass(p.character);
                return (
                  <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <CharSprite player={p} idx={i} size={48}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>
                        {p.name} {p.id===user?.id&&<span style={{fontSize:10,background:'#1D4ED8',padding:'1px 5px',borderRadius:4,color:'#93C5FD',marginLeft:4}}>คุณ</span>}
                        {p.id===room.host?.id&&<span style={{fontSize:10,background:'#78350F',padding:'1px 5px',borderRadius:4,color:'#FCD34D',marginLeft:4}}>HOST</span>}
                      </div>
                      <div style={{fontSize:11,color:'#94A3B8'}}>{p.character?.name || cls.label}</div>
                    </div>
                    <HpBar hp={p.hp} maxHp={p.maxHp||MAX_HP}/>
                  </div>
                );
              })}
            </div>

            {/* ── เลือกของวิเศษ 1 อย่าง ── */}
            <div className="gp-card">
              <div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>
                🎁 หยิบของวิเศษ 1 อย่าง
              </div>
              <div style={{fontSize:11,color:'#64748B',marginBottom:12}}>เปลี่ยนใจได้จนกว่าเกมจะเริ่ม</div>
              {GR_ITEMS.map(it => {
                const on = myPlayer?.item === it.key;
                return (
                  <button key={it.key} className="gp-btn gp-item" onClick={()=>handlePickItem(it.key)}
                    style={{
                      borderColor: on ? it.color : '#334155',
                      borderWidth: on ? 2 : 1.5,
                      boxShadow: on ? `0 0 16px ${it.color}44` : 'none',
                      background: on ? `${it.color}18` : '#1F2937',
                    }}>
                    <span style={{fontSize:26,flexShrink:0}}>{it.emoji}</span>
                    <div style={{flex:1,textAlign:'left'}}>
                      <div style={{fontWeight:700,fontSize:13,color:on?it.color:'#F8FAFC'}}>
                        {it.label}{on && ' ✓'}
                      </div>
                      <div style={{fontSize:11,color:'#94A3B8'}}>{it.desc}</div>
                      <div style={{fontSize:10,color:'#64748B',marginTop:2}}>{it.detail}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {isHost ? (
              <button className="gp-btn gp-btn-gold" onClick={handleStart}
                disabled={!room.players||room.players.length<2}>
                {room.players?.length>=2 ? '▶ เริ่มเกม' : `รอผู้เล่อีก ${2-(room.players?.length||0)} คน`}
              </button>
            ) : (
              <div style={{textAlign:'center',color:'#94A3B8',fontSize:13,padding:'12px 0'}}>⏳ รอเจ้าของห้องเริ่มเกม</div>
            )}
            <button className="gp-btn gp-btn-outline" onClick={handleLeave}>ออกจากห้อง</button>
          </>
        )}

        {/* ── STARTING ── */}
        {(phase==='starting'||phase==='loading') && (
          <div style={{textAlign:'center',padding:'80px 20px',animation:'fadeSlideUp .4s ease'}}>
            <div style={{fontSize:52,marginBottom:16}}>⚔️</div>
            <div style={{fontSize:22,fontWeight:700,marginBottom:8}}>เกมกำลังเริ่ม!</div>
            <div style={{color:'#94A3B8'}}>เตรียมพร้อม...</div>
          </div>
        )}

        {/* ── QUESTION ── */}
        {phase==='question' && question && (
          <>
            <div className="gp-status">
              <span>ข้อ {questionIdx+1} / {totalQ}</span>
              <span className={`gp-timer${timeLeft<=4?' urgent':''}`}>
                {String(Math.floor(timeLeft)).padStart(2,'0')}:{String(Math.round((timeLeft%1)*10))}
              </span>
            </div>

            {/* HP bar strip */}
            <div className="gp-card" style={{padding:'10px 12px',marginBottom:10}}>
              {room?.players?.map((p,i) => (
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:i<room.players.length-1?6:0}}>
                  <ActorSprite character={p.character} size={26} dir={0} dead={p.hp<=0}/>
                  <span style={{fontSize:11,fontWeight:600,color:p.id===user?.id?'#93C5FD':'#94A3B8',width:64,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {p.id===user?.id?'คุณ':p.name}
                  </span>
                  <div style={{flex:1,minWidth:0}}><HpBar hp={p.hp} maxHp={p.maxHp||MAX_HP} width="100%"/></div>
                </div>
              ))}
            </div>

            <div className="gp-card gold" style={{animation:'fadeSlideUp .35s ease'}}>
              <p style={{fontSize:16,fontWeight:600,textAlign:'center',marginBottom:18,lineHeight:1.55}}>
                {question.question}
              </p>
              {question.choices?.map((c,i) => {
                let cls = 'gp-btn gp-choice';
                if (choiceResult) {
                  if (i===choiceResult.correctIndex) cls+=' revealed';
                  else if (i===selectedChoice) cls+=' wrong';
                } else if (i===selectedChoice) cls+=' correct';
                return (
                  <button key={i} className={cls} disabled={selectedChoice!==null} onClick={()=>handleAnswer(i)}>
                    {String.fromCharCode(65+i)}. {c}
                  </button>
                );
              })}
            </div>
            {selectedChoice!==null&&!choiceResult&&(
              <div style={{textAlign:'center',color:'#94A3B8',fontSize:12}}>⏳ รอผู้เล่นคนอื่น...</div>
            )}
          </>
        )}

        {/* ── EVAL ── */}
        {phase==='eval' && myEvalRes && (
          <div style={{animation:'fadeSlideUp .4s ease'}}>
            <div className="gp-card" style={{textAlign:'center',padding:'22px 16px'}}>
              <div style={{fontSize:52,marginBottom:10}}>{myEvalRes.correct?'✓':'✗'}</div>
              <div style={{fontSize:20,fontWeight:800,color:myEvalRes.correct?'#22C55E':'#EF4444',marginBottom:6}}>
                {myEvalRes.correct?'ถูกต้อง!':'ผิด!'}
              </div>
              {myEvalRes.correct && (
                <div style={{fontSize:12,color:'#94A3B8',marginBottom:14}}>ตอบใน {myEvalRes.responseTime} วิ</div>
              )}

              {/* เฉลยคำตอบ */}
              {evalResult?.correctAnswer != null && (
                <div style={{
                  background:'linear-gradient(160deg,#14532D,#0B3D22)',
                  border:'2.5px solid #22C55E',borderRadius:16,
                  padding:'16px 18px',margin:'0 0 16px',textAlign:'left',
                  boxShadow:'0 0 26px rgba(34,197,94,.25)',
                  animation:'fadeSlideUp .35s ease',
                }}>
                  <div style={{fontSize:12,color:'#4ADE80',letterSpacing:2,fontWeight:800,marginBottom:8}}>✅ เฉลย</div>
                  {question?.question && (
                    <div style={{fontSize:14,color:'#A7F3D0',marginBottom:10,lineHeight:1.6}}>{question.question}</div>
                  )}
                  <div style={{fontSize:26,fontWeight:900,color:'#FFFFFF',lineHeight:1.4,textShadow:'0 2px 10px rgba(0,0,0,.5)'}}>
                    {choiceResult?.correctIndex >= 0 && `${String.fromCharCode(65+choiceResult.correctIndex)}. `}
                    {evalResult.correctAnswer}
                  </div>
                  {/* แถบเวลาที่เฉลยยังโชว์อยู่ */}
                  {evalResult.revealMs > 0 && (
                    <div style={{marginTop:12}}>
                      <div style={{height:5,background:'rgba(0,0,0,.35)',borderRadius:3,overflow:'hidden'}}>
                        <div style={{
                          height:'100%',borderRadius:3,background:'#4ADE80',
                          width:`${Math.max(0, (revealLeft*1000/evalResult.revealMs)*100)}%`,
                          transition:'width .1s linear',
                        }}/>
                      </div>
                      <div style={{fontSize:11,color:'#4ADE80',marginTop:5,textAlign:'right',fontFamily:'Consolas,monospace'}}>
                        {revealLeft.toFixed(1)} วิ
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div style={{display:'flex',justifyContent:'center',gap:28}}>
                <div>
                  <div style={{fontSize:28,fontWeight:800,color:'#FBBF24'}}>{myEvalRes.mult}×</div>
                  <div style={{fontSize:11,color:'#94A3B8'}}>Speed Mult</div>
                </div>
                <div>
                  <div style={{fontSize:28,fontWeight:800,color:'#22C55E'}}>{myEvalRes.baseDmg}</div>
                  <div style={{fontSize:11,color:'#94A3B8'}}>Base Damage</div>
                </div>
              </div>
            </div>
            <div style={{textAlign:'center',color:'#94A3B8',fontSize:12}}>⚔️ เตรียมท่าโจมตี...</div>
          </div>
        )}

        {/* ── ACTION ── */}
        {phase==='action' && (
          <>
            {/* แถบของวิเศษ */}
            {myPlayer?.item && (
              <div style={{
                display:'flex',alignItems:'center',gap:10,marginBottom:12,
                background:'#111827',border:`1.5px solid ${itemInfo(myPlayer.item)?.color}55`,
                borderRadius:14,padding:'10px 14px',
              }}>
                <span style={{fontSize:24}}>{itemInfo(myPlayer.item)?.emoji}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:itemInfo(myPlayer.item)?.color}}>
                    {itemInfo(myPlayer.item)?.label}
                  </div>
                  <div style={{fontSize:11,color:'#94A3B8'}}>
                    {myPlayer.item === 'power'
                      ? 'ดาเมจ +40% ตลอดเกม'
                      : `เหลือ ${myPlayer.itemUses} ครั้ง`}
                  </div>
                </div>
                {myPlayer.item === 'potion' && (
                  <button className="gp-btn" onClick={handleUseItem}
                    disabled={myPlayer.itemUses <= 0 || myPlayer.hp >= (myPlayer.maxHp||MAX_HP)}
                    style={{
                      width:'auto',margin:0,padding:'8px 16px',fontSize:12,
                      background: myPlayer.itemUses>0 ? 'linear-gradient(135deg,#22C55E,#15803D)' : '#334155',
                      opacity: (myPlayer.itemUses<=0 || myPlayer.hp>=(myPlayer.maxHp||MAX_HP)) ? .45 : 1,
                    }}>
                    ใช้ยา +70
                  </button>
                )}
              </div>
            )}

            {canCast ? (
              <>
                <div className="gp-combo">
                  ⚡ ตอบถูก {myEvalRes.mult}× — เลือกท่าโจมตี!
                </div>

                {/* Battle Board */}
                {room?.players && (
                  <BattleBoard
                    players={room.players}
                    myId={user?.id}
                    targetId={targetId}
                    setTargetId={(id) => { setTargetId(id); SFX.click(); }}
                    attacking={attacking}
                    abilityIdx={selectedAbility}
                    lungeIds={lungeIds}
                    hitIds={hitIds}
                  />
                )}

                {/* Abilities */}
                <div style={{marginBottom:12}}>
                  {ABILITIES.map((ab,i) => (
                    <button key={i} className={`gp-btn gp-ability${selectedAbility===i?' on':''}`}
                      onClick={()=>{ setSelectedAbility(i); SFX.click(); }}>
                      <div>
                        <div style={{fontWeight:700,fontSize:13}}>{ab.elem} {ab.name}</div>
                        <div style={{fontSize:11,color:'#94A3B8'}}>{ab.desc}</div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                        <span style={{fontSize:12,color:ab.color,fontWeight:700}}>{ab.power>0?`×${ab.power}`:'-'}</span>
                        <div style={{background:'#FBBF24',color:'#0A0F1A',width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13}}>{ab.cost}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <button className="gp-btn gp-btn-gold" onClick={handleCast} disabled={!targetId}>
                  {targetId
                    ? `${ABILITIES[selectedAbility]?.elem} CAST ${ABILITIES[selectedAbility]?.name}`
                    : '👆 เลือกเป้าหมายก่อน'}
                </button>
              </>
            ) : (
              <>
                {room?.players && (
                  <BattleBoard
                    players={room.players}
                    myId={user?.id}
                    targetId={null}
                    setTargetId={()=>{}}
                    attacking={false}
                    abilityIdx={0}
                    lungeIds={lungeIds}
                    hitIds={hitIds}
                  />
                )}
                <div style={{textAlign:'center',padding:'18px 16px',background:'#111827',borderRadius:16,border:'1px solid #1F2937'}}>
                  <div style={{fontSize:30,marginBottom:6}}>💤</div>
                  <div style={{color:'#94A3B8',fontSize:14,marginBottom:evalResult?.correctAnswer!=null?12:0}}>ตอบผิด — รอรอบหน้า</div>
                  {evalResult?.correctAnswer != null && (
                    <div style={{
                      background:'linear-gradient(160deg,#14532D,#0B3D22)',
                      border:'2.5px solid #22C55E',borderRadius:16,
                      padding:'14px 16px',textAlign:'left',
                      boxShadow:'0 0 22px rgba(34,197,94,.2)',
                    }}>
                      <div style={{fontSize:12,color:'#4ADE80',letterSpacing:2,fontWeight:800,marginBottom:6}}>✅ เฉลย</div>
                      <div style={{fontSize:24,fontWeight:900,color:'#FFFFFF',lineHeight:1.4}}>{evalResult.correctAnswer}</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ── RESULT ── */}
        {phase==='result' && (
          <>
            {room?.players && (
              <BattleBoard
                players={room.players}
                myId={user?.id}
                targetId={null}
                setTargetId={()=>{}}
                attacking={false}
                abilityIdx={0}
                lungeIds={lungeIds}
                hitIds={hitIds}
              />
            )}
            {evalResult?.correctAnswer != null && (
              <div style={{
                background:'#14532D',border:'2px solid #22C55E',borderRadius:14,
                padding:'12px 16px',marginBottom:12,textAlign:'left',
              }}>
                <div style={{fontSize:11,color:'#4ADE80',letterSpacing:2,fontWeight:800,marginBottom:5}}>✅ เฉลยข้อนี้</div>
                <div style={{fontSize:20,fontWeight:900,color:'#FFFFFF',lineHeight:1.4}}>{evalResult.correctAnswer}</div>
              </div>
            )}
            <div className="gp-stat-grid" style={{marginBottom:12}}>
              <div className="gp-stat"><div className="val">{myEvalRes?.mult||0}×</div><div className="lbl">Speed Mult</div></div>
              <div className="gp-stat"><div className="val">{ABILITIES[selectedAbility]?.power||0}×</div><div className="lbl">Ability Power</div></div>
              <div className="gp-stat"><div className="val">×1.8</div><div className="lbl">Combo Bonus</div></div>
              <div className="gp-stat"><div className="val">{myEvalRes?.correct?'✓':'✗'}</div><div className="lbl">ผลตอบ</div></div>
            </div>
            <div style={{textAlign:'center',color:'#94A3B8',fontSize:12}}>⏳ ข้อถัดไปกำลังมา...</div>
          </>
        )}

        {/* ── ENDED ── */}
        {phase==='ended' && (
          <>
            <div style={{textAlign:'center',fontSize:46,fontWeight:900,margin:'20px 0 6px',animation:'bounceIn .6s cubic-bezier(.22,1,.36,1)',color:winner?.id===user?.id?'#FBBF24':'#EF4444'}}>
              {winner?.id===user?.id ? 'VICTORY! 🏆' : 'DEFEAT 💀'}
            </div>
            <div style={{textAlign:'center',color:'#94A3B8',fontSize:13,marginBottom:18}}>
              {winner?.id===user?.id ? 'คุณชนะ! +50 pt' : `${winner?.name} เป็นผู้ชนะ`}
            </div>

            <div className="gp-card" style={{marginBottom:14}}>
              <div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>
                🏆 ลำดับเกมนี้
              </div>
              {[...(room?.players||[])].sort((a,b)=>{
                if (ranking?.length) {
                  const ra = ranking.find(r=>r.id===a.id)?.rank ?? 99;
                  const rb = ranking.find(r=>r.id===b.id)?.rank ?? 99;
                  return ra - rb;
                }
                return (room?.scores?.[b.id]||0)-(room?.scores?.[a.id]||0);
              }).map((p,i)=>{
                const cls = getClass(p.character);
                return (
                  <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <span style={{fontSize:20,width:28}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`}</span>
                    <CharSprite player={p} idx={i} size={44}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>{p.id===user?.id?'คุณ':p.name}</div>
                      <div style={{fontSize:11,color:'#94A3B8'}}>{p.character?.name || cls.label}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:14,fontWeight:700,color:'#FBBF24'}}>{room?.scores?.[p.id]||0} pt</div>
                      <div style={{fontSize:11,color:p.hp>0?'#22C55E':'#EF4444'}}>{p.hp} HP</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── สถิติชนะ/แพ้สะสม ── */}
            {leaderboard?.me && (
              <div className="gp-card" style={{marginBottom:14}}>
                <div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>
                  📊 สถิติของคุณ
                </div>
                <div className="gp-stat-grid">
                  <div className="gp-stat">
                    <div className="val" style={{color:'#FBBF24'}}>{leaderboard.me.rank ? `#${leaderboard.me.rank}` : '—'}</div>
                    <div className="lbl">อันดับรวม</div>
                  </div>
                  <div className="gp-stat">
                    <div className="val" style={{color:'#4ADE80'}}>{leaderboard.me.winRate}%</div>
                    <div className="lbl">อัตราชนะ</div>
                  </div>
                  <div className="gp-stat">
                    <div className="val" style={{color:'#22C55E'}}>{leaderboard.me.wins}</div>
                    <div className="lbl">ชนะ</div>
                  </div>
                  <div className="gp-stat">
                    <div className="val" style={{color:'#EF4444'}}>{leaderboard.me.losses}</div>
                    <div className="lbl">แพ้</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ตารางอันดับผู้เล่นทั้งหมด ── */}
            {leaderboard?.rows?.length > 0 && (
              <div className="gp-card" style={{marginBottom:14}}>
                <div style={{fontSize:11,color:'#94A3B8',textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>
                  🏅 อันดับผู้เล่น (ชนะ · อัตราชนะ)
                </div>
                {leaderboard.rows.slice(0,10).map(r => (
                  <div key={r.userId} style={{
                    display:'flex',alignItems:'center',gap:10,padding:'7px 8px',borderRadius:10,
                    marginBottom:4,
                    background: r.userId===user?.id ? 'rgba(251,191,36,.12)' : 'transparent',
                    border: r.userId===user?.id ? '1px solid rgba(251,191,36,.35)' : '1px solid transparent',
                  }}>
                    <span style={{width:26,fontSize:13,fontWeight:800,color:r.rank<=3?'#FBBF24':'#64748B',flexShrink:0}}>
                      {r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':`#${r.rank}`}
                    </span>
                    <ActorSprite character={r.character} size={26} dir={0}/>
                    <div style={{flex:1,minWidth:0,fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {r.name}
                    </div>
                    <span style={{fontSize:11,color:'#94A3B8',flexShrink:0}}>
                      <span style={{color:'#22C55E',fontWeight:700}}>{r.wins}</span>
                      <span style={{margin:'0 2px'}}>/</span>
                      <span style={{color:'#EF4444',fontWeight:700}}>{r.losses}</span>
                    </span>
                    <span style={{
                      fontSize:11,fontWeight:800,flexShrink:0,minWidth:38,textAlign:'right',
                      color: r.winRate>=60?'#4ADE80':r.winRate>=40?'#FBBF24':'#F87171',
                      fontFamily:'Consolas,monospace',
                    }}>{r.winRate}%</span>
                  </div>
                ))}
              </div>
            )}

            <button className="gp-btn gp-btn-gold" onClick={()=>navigate('/game')}>เล่นอีกครั้ง</button>
            <button className="gp-btn gp-btn-outline" onClick={()=>navigate('/dashboard')}>กลับ Dashboard</button>
          </>
        )}
      </div>
    </div>
  );
}
