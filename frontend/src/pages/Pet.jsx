import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/* ─── Constants ─────────────────────────────────────────────── */
const MAX_HUNGER = 100;
const HUNGER_DRAIN_PER_SEC = 0.5;   // drain rate
const FULLNESS_PER_CHAR = 3;         // each character = 3 fullness pts
const MIN_WORD_LEN = 2;

const PET_MOODS = {
  ecstatic: { min: 85, label: 'ยิ้มแย้ม!', color: '#10b981', emoji: '🤩' },
  happy:    { min: 60, label: 'มีความสุข', color: '#6ee7b7', emoji: '😊' },
  okay:     { min: 35, label: 'พอไหว...', color: '#fbbf24', emoji: '😐' },
  hungry:   { min: 15, label: 'หิวแล้ว!', color: '#f97316', emoji: '😟' },
  starving: { min: 0,  label: 'หิวมาก!!', color: '#ef4444', emoji: '😭' },
};

function getMood(hunger) {
  for (const [key, m] of Object.entries(PET_MOODS)) {
    if (hunger >= m.min) return { key, ...m };
  }
  return { key: 'starving', ...PET_MOODS.starving };
}

/* ─── Pet SVG ────────────────────────────────────────────────── */
const PetSprite = ({ mood, isEating, bounce }) => {
  const colors = {
    ecstatic: ['#a78bfa', '#7c3aed'],
    happy:    ['#60a5fa', '#2563eb'],
    okay:     ['#fcd34d', '#d97706'],
    hungry:   ['#fb923c', '#c2410c'],
    starving: ['#f87171', '#b91c1c'],
  };
  const [body, accent] = colors[mood.key] || colors.happy;
  const eyeY = isEating ? 52 : 48;
  const mouthPath = mood.key === 'ecstatic' ? 'M38,62 Q50,72 62,62'
    : mood.key === 'happy' ? 'M40,62 Q50,68 60,62'
    : mood.key === 'okay'  ? 'M40,63 L60,63'
    : mood.key === 'hungry' ? 'M40,64 Q50,60 60,64'
    : 'M38,65 Q50,58 62,65';

  return (
    <svg
      width={180} height={200} viewBox="0 0 100 130"
      style={{
        filter: `drop-shadow(0 8px 20px ${body}88)`,
        transform: bounce ? 'translateY(-6px)' : 'translateY(0)',
        transition: 'transform 0.15s ease',
      }}
    >
      {/* shadow */}
      <ellipse cx={50} cy={126} rx={24} ry={6} fill="rgba(0,0,0,0.25)" />

      {/* body */}
      <ellipse cx={50} cy={75} rx={32} ry={35} fill={body} />

      {/* belly */}
      <ellipse cx={50} cy={82} rx={20} ry={22} fill={`${body}88`} />

      {/* left ear */}
      <ellipse cx={22} cy={44} rx={10} ry={14} fill={body} transform="rotate(-15,22,44)" />
      <ellipse cx={22} cy={44} rx={6}  ry={9}  fill={accent} transform="rotate(-15,22,44)" />

      {/* right ear */}
      <ellipse cx={78} cy={44} rx={10} ry={14} fill={body} transform="rotate(15,78,44)" />
      <ellipse cx={78} cy={44} rx={6}  ry={9}  fill={accent} transform="rotate(15,78,44)" />

      {/* eyes */}
      <circle cx={38} cy={eyeY} r={7} fill="white" />
      <circle cx={62} cy={eyeY} r={7} fill="white" />
      {/* pupils */}
      {isEating ? (
        <>
          <path d="M34,48 Q38,44 42,48" stroke="#1e293b" strokeWidth={2.5} fill="none" strokeLinecap="round"/>
          <path d="M58,48 Q62,44 66,48" stroke="#1e293b" strokeWidth={2.5} fill="none" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <circle cx={39} cy={eyeY+1} r={4} fill="#1e293b" />
          <circle cx={63} cy={eyeY+1} r={4} fill="#1e293b" />
          <circle cx={40} cy={eyeY-1} r={1.5} fill="white" />
          <circle cx={64} cy={eyeY-1} r={1.5} fill="white" />
        </>
      )}

      {/* cheeks */}
      <ellipse cx={28} cy={60} rx={8} ry={5} fill={`${accent}66`} />
      <ellipse cx={72} cy={60} rx={8} ry={5} fill={`${accent}66`} />

      {/* mouth */}
      <path d={mouthPath} stroke="#1e293b" strokeWidth={2.5} fill="none" strokeLinecap="round" />

      {/* arms */}
      <ellipse cx={16} cy={80} rx={8} ry={14} fill={body} transform="rotate(20,16,80)" />
      <ellipse cx={84} cy={80} rx={8} ry={14} fill={body} transform="rotate(-20,84,80)" />

      {/* legs */}
      <ellipse cx={38} cy={112} rx={10} ry={10} fill={body} />
      <ellipse cx={62} cy={112} rx={10} ry={10} fill={body} />

      {/* food particle when eating */}
      {isEating && (
        <>
          <circle cx={52} cy={68} r={3} fill="#fbbf24" opacity={0.9} />
          <circle cx={45} cy={64} r={2} fill="#fbbf24" opacity={0.7} />
          <circle cx={58} cy={65} r={2} fill="#fbbf24" opacity={0.7} />
        </>
      )}
    </svg>
  );
};

/* ─── Floating text ──────────────────────────────────────────── */
const FloatText = ({ items }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}>
    {items.map(ft => (
      <div key={ft.id} style={{
        position: 'absolute',
        left: `${ft.x}%`, top: `${ft.y}%`,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 11,
        color: ft.color || '#fbbf24',
        textShadow: `0 0 10px ${ft.color || '#fbbf24'}`,
        animation: 'floatUp 1.4s ease-out forwards',
        whiteSpace: 'nowrap',
        transform: 'translateX(-50%)',
      }}>{ft.text}</div>
    ))}
  </div>
);

/* ─── Word History ────────────────────────────────────────────── */
const WordHistory = ({ words }) => (
  <div style={{
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: '10px 14px',
    maxHeight: 130,
    overflowY: 'auto',
  }}>
    <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 8, color: '#a78bfa', marginBottom: 8 }}>
      📖 คำที่ป้อนแล้ว
    </div>
    {words.length === 0 ? (
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>ยังไม่มีคำ...</div>
    ) : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[...words].reverse().map((w, i) => (
          <span key={i} style={{
            background: 'rgba(167,139,250,0.15)',
            border: '1px solid rgba(167,139,250,0.3)',
            borderRadius: 8,
            padding: '2px 8px',
            fontSize: 12,
            color: '#c4b5fd',
          }}>
            {w.word} <span style={{ color: '#fbbf24', fontSize: 10 }}>+{w.pts}</span>
          </span>
        ))}
      </div>
    )}
  </div>
);

/* ─── Main Component ─────────────────────────────────────────── */
export default function Pet() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const storageKey = `pet_state_${user?.id || 'guest'}`;

  const loadState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved) return null;
      // compute offline drain
      const elapsed = (Date.now() - saved.lastSaved) / 1000;
      const drained = elapsed * HUNGER_DRAIN_PER_SEC;
      return { ...saved, hunger: Math.max(0, saved.hunger - drained) };
    } catch { return null; }
  };

  const [hunger, setHunger] = useState(() => loadState()?.hunger ?? 60);
  const [wordHistory, setWordHistory] = useState(() => loadState()?.wordHistory ?? []);
  const [input, setInput] = useState('');
  const [floats, setFloats] = useState([]);
  const [isEating, setIsEating] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [error, setError] = useState('');
  const [totalWords, setTotalWords] = useState(() => loadState()?.totalWords ?? 0);
  const [petName, setPetName] = useState(() => loadState()?.petName ?? 'น้องฟัฟฟี่');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const inputRef = useRef(null);
  const floatId = useRef(0);

  const mood = getMood(hunger);

  // drain hunger over time
  useEffect(() => {
    const interval = setInterval(() => {
      setHunger(h => Math.max(0, h - HUNGER_DRAIN_PER_SEC));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // save state
  useEffect(() => {
    const state = { hunger, wordHistory, totalWords, petName, lastSaved: Date.now() };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [hunger, wordHistory, totalWords, petName, storageKey]);

  const addFloat = (text, color, x, y) => {
    const id = ++floatId.current;
    setFloats(f => [...f, { id, text, color, x: x ?? 30 + Math.random() * 40, y: y ?? 20 + Math.random() * 20 }]);
    setTimeout(() => setFloats(f => f.filter(ft => ft.id !== id)), 1500);
  };

  const feedPet = useCallback(() => {
    const word = input.trim();
    if (!word) return;
    if (word.length < MIN_WORD_LEN) {
      setError(`คำต้องยาวอย่างน้อย ${MIN_WORD_LEN} ตัวอักษร`);
      return;
    }
    setError('');

    const pts = word.length * FULLNESS_PER_CHAR;
    const gain = Math.min(pts, MAX_HUNGER - hunger);
    setHunger(h => Math.min(MAX_HUNGER, h + pts));
    setWordHistory(wh => [...wh.slice(-49), { word, pts }]);
    setTotalWords(t => t + 1);
    setInput('');
    setIsEating(true);
    setBounce(true);
    setTimeout(() => setIsEating(false), 800);
    setTimeout(() => setBounce(false), 300);

    const color = pts >= 24 ? '#10b981' : pts >= 15 ? '#fbbf24' : '#a78bfa';
    addFloat(`+${pts} 🍖`, color);
    if (word.length >= 8) addFloat('คำยาวมาก! 🔥', '#f97316', 60, 15);
    inputRef.current?.focus();
  }, [input, hunger]);

  const handleKey = (e) => {
    if (e.key === 'Enter') feedPet();
  };

  const hpColor = mood.color;
  const hpPct = (hunger / MAX_HUNGER) * 100;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* nav */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.2)',
      }}>
        <button onClick={() => navigate('/dashboard')}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
          ← กลับ
        </button>
        <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 12, color: '#a78bfa' }}>
          🐾 สัตว์เลี้ยงของฉัน
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          📊 ป้อนแล้ว {totalWords} คำ
        </div>
      </div>

      {/* main */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '24px 16px', gap: 20, maxWidth: 480, margin: '0 auto', width: '100%',
      }}>

        {/* pet card */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: `1.5px solid ${hpColor}44`,
          borderRadius: 24,
          padding: '24px 28px',
          width: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          position: 'relative',
          boxShadow: `0 0 40px ${hpColor}22`,
        }}>
          <FloatText items={floats} />

          {/* name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {editingName ? (
              <input
                autoFocus
                value={tempName}
                onChange={e => setTempName(e.target.value)}
                onBlur={() => { setPetName(tempName || petName); setEditingName(false); }}
                onKeyDown={e => { if (e.key === 'Enter') { setPetName(tempName || petName); setEditingName(false); } }}
                style={{
                  fontFamily: '"Press Start 2P", monospace', fontSize: 13,
                  background: 'rgba(167,139,250,0.15)', border: '1px solid #a78bfa',
                  borderRadius: 8, padding: '4px 10px', color: '#fff', outline: 'none', width: 160,
                }}
              />
            ) : (
              <button onClick={() => { setTempName(petName); setEditingName(true); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 14, color: '#e2e8f0' }}>
                  {petName} ✏️
                </span>
              </button>
            )}
          </div>

          {/* mood badge */}
          <div style={{
            background: `${hpColor}22`, border: `1px solid ${hpColor}55`,
            borderRadius: 20, padding: '4px 16px',
            fontFamily: '"Press Start 2P", monospace', fontSize: 9, color: hpColor,
          }}>
            {mood.emoji} {mood.label}
          </div>

          {/* pet sprite */}
          <PetSprite mood={mood} isEating={isEating} bounce={bounce} />

          {/* hunger bar */}
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
                🍖 ความอิ่ม
              </span>
              <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 8, color: hpColor }}>
                {Math.round(hunger)}/{MAX_HUNGER}
              </span>
            </div>
            <div style={{ height: 18, background: 'rgba(0,0,0,0.4)', borderRadius: 9, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{
                height: '100%', width: `${hpPct}%`, borderRadius: 9,
                background: `linear-gradient(90deg, ${hpColor}88, ${hpColor})`,
                transition: 'width 0.4s ease, background 0.5s ease',
                boxShadow: `0 0 10px ${hpColor}88`,
              }} />
            </div>
          </div>

          {/* tip */}
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.35)',
            textAlign: 'center', lineHeight: 1.6,
          }}>
            💡 ยิ่งพิมพ์คำยาว น้องยิ่งอิ่มนาน<br />
            1 ตัวอักษร = +{FULLNESS_PER_CHAR} ความอิ่ม
          </div>
        </div>

        {/* input card */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20, padding: '20px 20px',
          width: '100%',
        }}>
          <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 9, color: '#a78bfa', marginBottom: 12 }}>
            ✍️ พิมพ์คำศัพท์เพื่อให้อาหาร
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); }}
              onKeyDown={handleKey}
              placeholder="พิมพ์คำศัพท์ที่นี่..."
              style={{
                flex: 1, padding: '12px 16px',
                background: 'rgba(255,255,255,0.07)',
                border: error ? '1.5px solid #ef4444' : '1.5px solid rgba(255,255,255,0.12)',
                borderRadius: 12, color: '#fff', fontSize: 15,
                outline: 'none', fontFamily: 'inherit',
              }}
              autoFocus
            />
            <button
              onClick={feedPet}
              style={{
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                border: 'none', borderRadius: 12,
                color: '#fff', fontFamily: '"Press Start 2P", monospace',
                fontSize: 10, cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(124,58,237,0.4)',
              }}>
              ให้<br />อาหาร
            </button>
          </div>
          {error && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#f87171' }}>{error}</div>
          )}
          {input.trim().length >= MIN_WORD_LEN && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#a78bfa' }}>
              คำนี้ยาว {input.trim().length} ตัว → ได้รับ +{input.trim().length * FULLNESS_PER_CHAR} ความอิ่ม
            </div>
          )}
        </div>

        {/* word history */}
        <div style={{ width: '100%' }}>
          <WordHistory words={wordHistory} />
        </div>
      </div>

      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-60px); }
        }
      `}</style>
    </div>
  );
}
