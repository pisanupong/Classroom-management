import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

/* ══════════════════════════════════════════════════════════
   ตัวแปล Python จำลอง — รันในเบราว์เซอร์เพื่อให้เห็น output ทันที
   (คะแนนตัดสินที่เซิร์ฟเวอร์อีกชั้น ที่นี่แค่ให้ผลลัพธ์)
══════════════════════════════════════════════════════════ */
function runPythonLike(code) {
  const lines = code.split('\n');
  const output = [];
  const vars = {};
  const functions = {};
  let i = 0;

  function evalExpr(expr, localVars = {}) {
    expr = expr.trim();
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) return expr.slice(1, -1);
    if (expr.startsWith('f"') || expr.startsWith("f'")) {
      let s = expr.slice(2, -1);
      return s.replace(/\{(\w+)\}/g, (_, k) => (k in localVars ? localVars[k] : (k in vars ? vars[k] : '{' + k + '}')));
    }
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    if (/^[\wก-๙]+$/.test(expr)) {
      if (expr in localVars) return localVars[expr];
      if (expr in vars) return vars[expr];
      throw new Error(`ชื่อ '${expr}' ยังไม่ได้กำหนด`);
    }
    if (expr.startsWith('[') && expr.endsWith(']')) {
      const inner = expr.slice(1, -1).trim();
      if (!inner) return [];
      const items = []; let cur = '', inStr = false, q = '';
      for (const c of inner) {
        if ((c === '"' || c === "'") && !inStr) { inStr = true; q = c; cur += c; }
        else if (c === q && inStr) { inStr = false; cur += c; }
        else if (c === ',' && !inStr) { items.push(cur.trim()); cur = ''; }
        else cur += c;
      }
      if (cur.trim()) items.push(cur.trim());
      return items.map(it => evalExpr(it, localVars));
    }
    // index: ชื่อ[0]
    const idxMatch = expr.match(/^([\wก-๙]+)\[(.+)\]$/);
    if (idxMatch) {
      const base = evalExpr(idxMatch[1], localVars);
      const idx = Number(evalExpr(idxMatch[2], localVars));
      if (!Array.isArray(base) && typeof base !== 'string') throw new Error('ใช้ [ ] ได้กับลิสต์หรือข้อความเท่านั้น');
      return base[idx];
    }
    const ops = ['>=', '<=', '==', '!=', '+', '-', '*', '/', '>', '<'];
    for (const op of ops) {
      let depth = 0, inS = false, qq = '';
      for (let j = 0; j < expr.length; j++) {
        const c = expr[j];
        if ((c === '"' || c === "'") && !inS) { inS = true; qq = c; }
        else if (c === qq && inS) inS = false;
        else if (!inS && c === '(') depth++;
        else if (!inS && c === ')') depth--;
        else if (!inS && depth === 0 && expr.slice(j, j + op.length) === op) {
          if (op === '-' && j === 0) continue;
          const left = evalExpr(expr.slice(0, j), localVars);
          const right = evalExpr(expr.slice(j + op.length), localVars);
          if (op === '+') return (typeof left === 'string' || typeof right === 'string') ? String(left) + String(right) : left + right;
          if (op === '-') return left - right;
          if (op === '*') return left * right;
          if (op === '/') return left / right;
          if (op === '>') return left > right;
          if (op === '<') return left < right;
          if (op === '>=') return left >= right;
          if (op === '<=') return left <= right;
          if (op === '==') return left == right;   // eslint-disable-line eqeqeq
          if (op === '!=') return left != right;   // eslint-disable-line eqeqeq
        }
      }
    }
    const callMatch = expr.match(/^([\wก-๙]+)\((.*)\)$/);
    if (callMatch) {
      const fname = callMatch[1], argStr = callMatch[2].trim();
      if (fname === 'range') {
        const args = argStr ? argStr.split(',').map(a => Number(evalExpr(a.trim(), localVars))) : [];
        if (args.length === 1) return Array.from({ length: args[0] }, (_, k) => k);
        if (args.length === 2) return Array.from({ length: Math.max(0, args[1] - args[0]) }, (_, k) => args[0] + k);
        if (args.length === 3) {
          const arr = [];
          for (let x = args[0]; args[2] > 0 ? x < args[1] : x > args[1]; x += args[2]) arr.push(x);
          return arr;
        }
      }
      if (fname === 'len') return evalExpr(argStr, localVars).length;
      if (fname === 'int') return parseInt(evalExpr(argStr, localVars), 10);
      if (fname === 'str') return String(evalExpr(argStr, localVars));
      if (fname in functions) {
        const fn = functions[fname];
        const argVals = argStr ? splitArgs(argStr).map(a => evalExpr(a.trim(), localVars)) : [];
        const local = {};
        fn.params.forEach((p, idx) => { local[p] = argVals[idx]; });
        for (const bline of fn.body) execLine(bline, local, output);
        return null;
      }
      throw new Error(`ไม่รู้จักฟังก์ชัน '${fname}'`);
    }
    throw new Error('ไม่เข้าใจนิพจน์: ' + expr);
  }

  function splitArgs(inner) {
    const parts = []; let cur = '', inS = false, q = '', depth = 0;
    for (const c of inner) {
      if ((c === '"' || c === "'") && !inS) { inS = true; q = c; cur += c; }
      else if (c === q && inS) { inS = false; cur += c; }
      else if (!inS && (c === '(' || c === '[')) { depth++; cur += c; }
      else if (!inS && (c === ')' || c === ']')) { depth--; cur += c; }
      else if (!inS && depth === 0 && c === ',') { parts.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  const show = (v) => Array.isArray(v)
    ? '[' + v.map(x => typeof x === 'string' ? `'${x}'` : x).join(', ') + ']'
    : String(v);

  function execLine(line, localVars = null, outArr = output) {
    line = line.replace(/#.*$/, '').trim();
    if (!line) return;
    if (line.startsWith('print(') && line.endsWith(')')) {
      const vals = splitArgs(line.slice(6, -1)).map(p => evalExpr(p, localVars || vars));
      outArr.push(vals.map(show).join(' '));
      return;
    }
    const assignMatch = line.match(/^([\wก-๙]+)\s*=\s*(.+)$/);
    if (assignMatch && !/^(if|for|while|def)\b/.test(line)) {
      const val = evalExpr(assignMatch[2], localVars || vars);
      if (localVars) localVars[assignMatch[1]] = val; else vars[assignMatch[1]] = val;
      return;
    }
    if (/^[\wก-๙]+\(.*\)$/.test(line)) { evalExpr(line, localVars || vars); return; }
    throw new Error('ไม่เข้าใจคำสั่ง: ' + line);
  }

  try {
    while (i < lines.length) {
      const raw = lines[i];
      let line = raw.replace(/#.*$/, '');
      const indent = raw.match(/^(\s*)/)[1].length;
      line = line.trim();
      if (!line) { i++; continue; }

      const defM = line.match(/^def\s+([\wก-๙]+)\s*\(([^)]*)\)\s*:$/);
      if (defM) {
        const fname = defM[1];
        const params = defM[2].split(',').map(p => p.trim()).filter(Boolean);
        const body = [];
        i++;
        while (i < lines.length) {
          const r2 = lines[i], ind2 = r2.match(/^(\s*)/)[1].length;
          if (r2.trim() === '' || ind2 > indent) { body.push(r2); i++; } else break;
        }
        functions[fname] = { params, body };
        continue;
      }

      const forM = line.match(/^for\s+([\wก-๙]+)\s+in\s+(.+):$/);
      if (forM) {
        const varName = forM[1];
        const iterable = evalExpr(forM[2]);
        const bodyLines = [];
        i++;
        while (i < lines.length) {
          const r2 = lines[i], ind2 = r2.match(/^(\s*)/)[1].length;
          if (r2.trim() === '' || ind2 > indent) { bodyLines.push(r2); i++; } else break;
        }
        if (!Array.isArray(iterable)) throw new Error('for ต้องใช้กับลิสต์หรือ range');
        for (const item of iterable) {
          vars[varName] = item;
          for (const bl of bodyLines) { const t = bl.replace(/#.*$/, '').trim(); if (t) execLine(t); }
        }
        continue;
      }

      const ifM = line.match(/^if\s+(.+):$/);
      if (ifM) {
        const cond = evalExpr(ifM[1]);
        const ifBody = []; const elseBody = [];
        i++;
        while (i < lines.length) {
          const r2 = lines[i], ind2 = r2.match(/^(\s*)/)[1].length, t2 = r2.trim();
          if (t2 === 'else:' && ind2 === indent) {
            i++;
            while (i < lines.length) {
              const r3 = lines[i], ind3 = r3.match(/^(\s*)/)[1].length;
              if (r3.trim() === '' || ind3 > indent) { elseBody.push(r3); i++; } else break;
            }
            break;
          }
          if (r2.trim() === '' || ind2 > indent) { ifBody.push(r2); i++; } else break;
        }
        for (const bl of (cond ? ifBody : elseBody)) { const t = bl.replace(/#.*$/, '').trim(); if (t) execLine(t); }
        continue;
      }

      execLine(line);
      i++;
    }
  } catch (err) {
    return { ok: false, error: err.message, output: output.join('\n') };
  }
  return { ok: true, output: output.join('\n') };
}

/* ══════════════════════════════════════════════════════════
   เสียง (Web Audio — ไม่ต้องโหลดไฟล์)
══════════════════════════════════════════════════════════ */
let audioCtx = null;
function playSound(type, enabled) {
  if (!enabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    if (type === 'levelup') {
      [523, 659, 784, 1046].forEach((f, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination); o.type = 'square';
        o.frequency.setValueAtTime(f, now + i * 0.12);
        g.gain.setValueAtTime(0.12, now + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
        o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.3);
      });
      return;
    }
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const seq = {
      click:   { t:'sine',     f:[[600,0]],                    v:0.15, d:0.1,  ramp:[400,0.08] },
      success: { t:'sine',     f:[[523,0],[659,0.1],[784,0.2]], v:0.2,  d:0.4 },
      mission: { t:'triangle', f:[[440,0],[554,0.12],[659,0.24]], v:0.18, d:0.45 },
      reward:  { t:'sine',     f:[[784,0],[988,0.15],[1175,0.3]], v:0.2, d:0.55 },
      error:   { t:'sawtooth', f:[[200,0]],                    v:0.1,  d:0.25, lin:[100,0.2] },
      run:     { t:'sine',     f:[[700,0]],                    v:0.12, d:0.08, ramp:[900,0.06] },
      score:   { t:'sine',     f:[[880,0],[1100,0.08]],        v:0.15, d:0.2 },
    }[type];
    if (!seq) return;
    osc.type = seq.t;
    seq.f.forEach(([f, t]) => osc.frequency.setValueAtTime(f, now + t));
    if (seq.ramp) osc.frequency.exponentialRampToValueAtTime(seq.ramp[0], now + seq.ramp[1]);
    if (seq.lin) osc.frequency.linearRampToValueAtTime(seq.lin[0], now + seq.lin[1]);
    gain.gain.setValueAtTime(seq.v, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seq.d);
    osc.start(now); osc.stop(now + seq.d);
  } catch { /* เสียงพังไม่ควรทำให้เกมพัง */ }
}

/* ══════════════════════════════════════════════════════════
   เนื้อหาบทเรียน (ฝั่งหน้าจอ — คะแนนอยู่ที่เซิร์ฟเวอร์)
══════════════════════════════════════════════════════════ */
const LESSON_CONTENT = [
  { id:'print', tab:'1.print', emoji:'🖨️', title:'พิมพ์ข้อความ', cmd:'print()',
    meaning:'สั่งให้คอมพิวเตอร์แสดงข้อความหรือตัวเลขออกจอ',
    example:'print("สวัสดีครับ!")\nprint(10 + 5)',
    starter:'print("สวัสดี ฉันกำลังเรียน Python!")' },
  { id:'var', tab:'2.ตัวแปร', emoji:'📦', title:'ตัวแปร', cmd:'ชื่อ = ค่า',
    meaning:'กล่องเก็บข้อมูลไว้เรียกใช้ทีหลัง',
    example:'name = "น้องบอท"\nprint(name)',
    starter:'name = "มิ้นท์"\nprint("ฉันชื่อ", name)' },
  { id:'input', tab:'3.input', emoji:'⌨️', title:'รับค่าจากผู้ใช้', cmd:'input()',
    meaning:'ให้โปรแกรมถาม แล้วรอคำตอบ',
    example:'name = input("เธอชื่ออะไร? ")\nprint("ยินดีต้อนรับ", name)',
    starter:'', isInput:true },
  { id:'if', tab:'4.if', emoji:'❓', title:'เงื่อนไข if', cmd:'if ... else ...',
    meaning:'ตัดสินใจตามเงื่อนไข',
    example:'score = 80\nif score >= 50:\n    print("ผ่านแล้ว!")\nelse:\n    print("ยังไม่ผ่าน")',
    starter:'score = 45\nif score >= 50:\n    print("ผ่านแล้ว!")\nelse:\n    print("ยังไม่ผ่าน")' },
  { id:'for', tab:'5.for', emoji:'🔁', title:'วนลูป for', cmd:'for ... in range()',
    meaning:'สั่งให้ทำซ้ำตามจำนวนรอบ',
    example:'for i in range(1, 6):\n    print("นับ", i)',
    starter:'for i in range(1, 4):\n    print("Python สนุก!", i)' },
  { id:'list', tab:'6.ลิสต์', emoji:'📋', title:'ลิสต์', cmd:'[ ค่า1, ค่า2 ]',
    meaning:'เก็บหลายค่าไว้ด้วยกัน',
    example:'fruits = ["แอปเปิ้ล", "กล้วย"]\nprint(fruits[0])',
    starter:'colors = ["แดง", "เขียว", "น้ำเงิน"]\nprint("สีแรก:", colors[0])\nfor c in colors:\n    print("สี", c)' },
  { id:'def', tab:'7.ฟังก์ชัน', emoji:'🎯', title:'ฟังก์ชัน', cmd:'def ชื่อ():',
    meaning:'สร้างคำสั่งของตัวเองไว้เรียกใช้ซ้ำ',
    example:'def hello(name):\n    print("สวัสดี", name)\nhello("บอท")',
    starter:'def congrat(name):\n    print("เก่งมาก", name, "!")\ncongrat("คุณ")' },
];

const countTrue = (o) => Object.keys(o || {}).filter(k => o[k]).length;

const CSS = `
.py-wrap{--bg:#0f172a;--card:#1e293b;--accent:#38bdf8;--accent2:#a78bfa;--success:#4ade80;--danger:#f87171;--warning:#fbbf24;--text:#f1f5f9;--muted:#94a3b8;--code-bg:#0b1220;
  font-family:'Kanit',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
.py-wrap *{box-sizing:border-box}
.py-stars{position:fixed;inset:0;background:radial-gradient(2px 2px at 20px 30px,#fff,transparent),radial-gradient(2px 2px at 40px 70px,rgba(255,255,255,.6),transparent),radial-gradient(1px 1px at 90px 40px,#fff,transparent);background-size:250px 150px;animation:py-twinkle 8s linear infinite;opacity:.3;pointer-events:none;z-index:0}
@keyframes py-twinkle{from{transform:translateY(0)}to{transform:translateY(-150px)}}
.py-container{position:relative;z-index:1;max-width:920px;margin:0 auto;padding:14px 14px 48px}
.py-h1{font-size:1.85rem;font-weight:700;background:linear-gradient(135deg,#38bdf8,#a78bfa);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;text-align:center}
.py-sub{color:var(--muted);font-size:.95rem;text-align:center;margin-bottom:10px}
.py-stats{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:11px}
.py-stat{background:var(--card);border-radius:10px;padding:7px 11px;min-width:80px;text-align:center;border:1px solid rgba(255,255,255,.06)}
.py-stat .l{font-size:.68rem;color:var(--muted)}
.py-stat .v{font-size:1.15rem;font-weight:700}
.py-banner{background:linear-gradient(135deg,rgba(251,191,36,.12),rgba(167,139,250,.12));border:1px solid rgba(251,191,36,.28);border-radius:12px;padding:10px 13px;margin-bottom:11px;text-align:center}
.py-xpbar{height:9px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;margin-top:6px}
.py-xpfill{height:100%;border-radius:99px;background:linear-gradient(90deg,#fbbf24,#a78bfa);transition:width .5s}
.py-tabs{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-bottom:11px}
.py-tab{font-family:inherit;background:rgba(255,255,255,.06);border:2px solid transparent;color:var(--muted);border-radius:99px;padding:5px 10px;font-size:.78rem;cursor:pointer}
.py-tab:hover{background:rgba(255,255,255,.1);color:var(--text)}
.py-tab.active{background:rgba(56,189,248,.15);border-color:var(--accent);color:var(--accent);font-weight:600}
.py-tab.done{border-color:var(--success);color:var(--success)}
.py-card{background:var(--card);border-radius:14px;padding:16px;border:1px solid rgba(255,255,255,.06);margin-bottom:11px}
.py-item{background:rgba(0,0,0,.22);border-radius:10px;padding:10px 11px;border:1px solid rgba(255,255,255,.06);display:flex;gap:8px;align-items:flex-start}
.py-item.done{border-color:var(--success);background:rgba(74,222,128,.07)}
.py-item.locked{opacity:.42}
.py-badge{font-size:.66rem;padding:2px 6px;border-radius:99px;font-weight:600}
.py-code{background:var(--code-bg);border-radius:9px;padding:10px;margin-bottom:7px;border:1px solid rgba(255,255,255,.07)}
.py-code pre{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.84rem;line-height:1.5;color:#e2e8f0;white-space:pre-wrap;margin:0}
.py-btn{font-family:inherit;background:linear-gradient(135deg,#38bdf8,#0ea5e9);color:#0f172a;border:none;border-radius:8px;padding:7px 13px;font-size:.86rem;font-weight:600;cursor:pointer}
.py-btn:hover{filter:brightness(1.1)}
.py-btn2{font-family:inherit;background:rgba(255,255,255,.08);color:var(--text);border:none;border-radius:8px;padding:7px 11px;font-size:.82rem;cursor:pointer}
.py-btn2:hover{background:rgba(255,255,255,.14)}
.py-btn-ok{font-family:inherit;background:linear-gradient(135deg,#4ade80,#22c55e);color:#0f172a;border:none;border-radius:8px;padding:7px 12px;font-size:.86rem;font-weight:600;cursor:pointer}
.py-btn-danger{font-family:inherit;background:rgba(248,113,113,.15);color:var(--danger);border:1px solid rgba(248,113,113,.3);border-radius:8px;padding:7px 12px;font-size:.82rem;cursor:pointer}
.py-out{background:#0a0f1a;border-radius:8px;padding:9px 11px;min-height:40px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.82rem;color:#a5f3fc;border:1px solid rgba(56,189,248,.2);white-space:pre-wrap;margin-top:7px}
.py-ta{width:100%;min-height:80px;background:var(--code-bg);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e2e8f0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.82rem;padding:8px;resize:vertical;outline:none;margin-bottom:5px}
.py-fb{text-align:center;padding:8px;border-radius:8px;margin-top:7px;font-weight:500;font-size:.88rem}
.py-fb.ok{background:rgba(74,222,128,.12);border:1px solid var(--success);color:var(--success)}
.py-fb.bad{background:rgba(248,113,113,.12);border:1px solid var(--danger);color:var(--danger)}
.py-fb.mission{background:rgba(167,139,250,.14);border:1px solid var(--accent2);color:#c4b5fd}
.py-rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(115px,1fr));gap:9px}
.py-rcard{background:rgba(0,0,0,.25);border-radius:11px;padding:12px 7px;text-align:center;border:2px solid rgba(255,255,255,.06)}
.py-rcard.locked{opacity:.4;filter:grayscale(.8)}
.py-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px}
.py-popup{background:var(--card);border-radius:15px;padding:22px 18px;text-align:center;max-width:340px;width:100%;border:2px solid var(--warning);animation:py-pop .35s ease}
@keyframes py-pop{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
.py-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--card);border:1px solid var(--accent2);border-radius:10px;padding:10px 16px;z-index:120;font-size:.88rem;text-align:center;max-width:90%;box-shadow:0 8px 28px rgba(0,0,0,.4)}
.py-mascot{text-align:center;font-size:2.2rem;margin:2px 0}
.py-mascot.happy{animation:py-bounce .45s ease}
@keyframes py-bounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-10px)}70%{transform:translateY(-4px)}}
@media(max-width:500px){.py-h1{font-size:1.4rem}.py-stat{min-width:70px}}
`;

export default function Python() {
  const navigate = useNavigate();
  const { user, refreshUser } = useContext(AuthContext);

  const [meta, setMeta] = useState(null);
  const [st, setSt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('home');
  const [sound, setSound] = useState(true);

  const [toast, setToast] = useState('');
  const [levelPopup, setLevelPopup] = useState(null);
  const [rewardPopup, setRewardPopup] = useState(null);

  // บทเรียน
  const [tryCode, setTryCode] = useState({});
  const [tryOut, setTryOut] = useState({});
  const [exampleOut, setExampleOut] = useState({});
  const [lessonFb, setLessonFb] = useState({});
  const [mascot, setMascot] = useState({});
  const [fakeInput, setFakeInput] = useState('');

  // แบบฝึกหัด
  const [curEx, setCurEx] = useState(null);
  const [exCode, setExCode] = useState('');
  const [exOut, setExOut] = useState(null);
  const [exFb, setExFb] = useState(null);
  const [exHint, setExHint] = useState('');

  // ตัวละคร / อันดับ / แอดมิน
  const [nameInput, setNameInput] = useState('');
  const [board, setBoard] = useState([]);
  const [adminRows, setAdminRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_USER';
  const beep = useCallback((t) => playSound(t, sound), [sound]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(t => (t === msg ? '' : t)), 2800);
  }, []);

  /* ── โหลดข้อมูลตั้งต้น ── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m, s] = await Promise.all([api.get('/python/meta'), api.get('/python/state')]);
        if (!alive) return;
        setMeta(m.data);
        setSt(s.data.state);
        setNameInput(s.data.state.charName || '');
        const seed = {};
        LESSON_CONTENT.forEach(l => { seed[l.id] = l.starter; });
        setTryCode(seed);
      } catch (e) {
        if (alive) setErr(e.response?.data?.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* ── เล่นเอฟเฟกต์จาก events ที่เซิร์ฟเวอร์ส่งกลับ ── */
  const applyResult = useCallback((data) => {
    if (data?.state) setSt(data.state);
    const events = data?.events || [];
    let lastMission = null;
    events.forEach(ev => {
      if (ev.type === 'levelup') { beep('levelup'); setLevelPopup(ev); }
      else if (ev.type === 'reward') { beep('reward'); setRewardPopup(ev); }
      else if (ev.type === 'mission') { beep('mission'); lastMission = ev; }
      else if (ev.type === 'hints') showToast(`💡 ได้คำใบ้เพิ่ม +${ev.gained} (เหลือ ${ev.left})`);
    });
    if (data?.earned > 0) {
      beep('score');
      refreshUser?.();                       // total_points เปลี่ยน — ให้หน้าอื่นเห็นด้วย
    }
    return lastMission;
  }, [beep, showToast, refreshUser]);

  /* ── บทเรียน ── */
  const bounce = (id, emoji) => {
    setMascot(m => ({ ...m, [id]: emoji }));
    setTimeout(() => setMascot(m => ({ ...m, [id]: null })), 500);
  };

  const runExample = (l) => {
    beep('run');
    const r = runPythonLike(l.example);
    setExampleOut(o => ({ ...o, [l.id]: r.ok ? (r.output || '(ไม่มี output)') : '❌ ' + r.error }));
    bounce(l.id, '🤩');
  };

  const runTry = async (l) => {
    const code = tryCode[l.id] ?? l.starter;
    const r = runPythonLike(code);
    if (!r.ok) {
      setTryOut(o => ({ ...o, [l.id]: '❌ ' + r.error }));
      bounce(l.id, '😵'); beep('error');
      return;
    }
    setTryOut(o => ({ ...o, [l.id]: r.output || '(ไม่มี output)' }));
    bounce(l.id, '😄'); beep('run');

    // ภารกิจของบทเรียนนี้ — ให้เซิร์ฟเวอร์ตัดสิน
    const pending = (meta?.missions || []).filter(m => m.lesson === l.id && !st?.missions?.[m.id]);
    for (const m of pending) {
      try {
        const res = await api.post('/python/mission', { id: m.id, output: r.output, code });
        if (res.data?.correct) {
          const hit = applyResult(res.data);
          if (hit) setLessonFb(f => ({ ...f, [l.id]: { kind:'mission', text:`🎯 ${hit.title} (+${hit.xp} XP · +${hit.score} คะแนน)` } }));
        }
      } catch { /* ภารกิจพลาดไม่ควรขวางการรันโค้ด */ }
    }
  };

  const runInputTry = async () => {
    const name = fakeInput.trim() || 'นักผจญภัย';
    setTryOut(o => ({ ...o, input: `เธอชื่ออะไร? ${name}\nยินดีต้อนรับ ${name}` }));
    bounce('input', '🤩'); beep('success');
    if (st?.missions?.m3) return;
    try {
      const res = await api.post('/python/mission', { id: 'm3', output: name, code: 'input()' });
      if (res.data?.correct) {
        const hit = applyResult(res.data);
        if (hit) setLessonFb(f => ({ ...f, input: { kind:'mission', text:`🎯 ${hit.title} (+${hit.xp} XP · +${hit.score} คะแนน)` } }));
      }
    } catch { /* ignore */ }
  };

  const markLearned = async (l) => {
    beep('success'); bounce(l.id, '🥳');
    try {
      const res = await api.post('/python/learn', { lesson: l.id });
      applyResult(res.data);
      setLessonFb(f => ({ ...f, [l.id]: res.data.already
        ? { kind:'ok', text:'✅ เรียนบทนี้ไปแล้ว (คะแนนไม่ซ้ำ)' }
        : { kind:'ok', text:`🎉 เยี่ยมมาก! +${meta.lessonReward.xp} XP · +${meta.lessonReward.score} คะแนน` } }));
    } catch (e) {
      showToast(e.response?.data?.message || 'บันทึกไม่สำเร็จ');
    }
  };

  /* ── แบบฝึกหัด ── */
  const openEx = (ex) => {
    setCurEx(ex); setExCode(ex.starter); setExOut(null); setExFb(null); setExHint('');
    beep('click');
  };

  const submitEx = async () => {
    if (!curEx || busy) return;
    const r = runPythonLike(exCode);
    if (!r.ok) {
      setExOut('❌ ' + r.error);
      setExFb({ kind:'bad', text:'😅 มีข้อผิดพลาด ลองแก้โค้ดอีกที' });
      beep('error');
      return;
    }
    setExOut(r.output || '(ไม่มี output)');
    setBusy(true);
    try {
      const res = await api.post('/python/exercise', { id: curEx.id, output: r.output, code: exCode });
      if (!res.data.correct) {
        setExFb({ kind:'bad', text:'🤔 ยังไม่ถูกตามโจทย์ ดู output แล้วลองใหม่นะ' });
        beep('error');
      } else if (res.data.already) {
        setExFb({ kind:'ok', text:'✅ ถูกต้อง! (เคยผ่านข้อนี้แล้ว คะแนนไม่ซ้ำ)' });
        beep('success');
        applyResult(res.data);
      } else {
        setExFb({ kind:'ok', text:`🎉 ถูกต้อง! +${curEx.score} คะแนน · +${curEx.xp} XP` });
        beep('success');
        applyResult(res.data);
      }
    } catch (e) {
      setExFb({ kind:'bad', text: e.response?.data?.message || 'ส่งคำตอบไม่สำเร็จ' });
    } finally { setBusy(false); }
  };

  const askHint = async () => {
    if (!curEx) return;
    if (exHint) { setExHint(''); return; }
    try {
      const res = await api.post('/python/hint', { id: curEx.id });
      if (!res.data.ok) {
        beep('error');
        setSt(res.data.state);
        showToast('😵 คำใบ้หมดแล้ว! อัปเลเวลเพื่อได้คำใบ้เพิ่ม +3');
        return;
      }
      setSt(res.data.state);
      setExHint(`💡 คำใบ้ (เหลือ ${res.data.state.hints} ครั้ง):\n${res.data.hint}`);
      beep('click');
      if (res.data.state.hints <= 2) showToast(`💡 เหลือคำใบ้ ${res.data.state.hints} ครั้ง`);
    } catch (e) {
      showToast(e.response?.data?.message || 'ขอคำใบ้ไม่สำเร็จ');
    }
  };

  /* ── ตัวละคร / อันดับ / แอดมิน ── */
  const saveCharName = async () => {
    try {
      const res = await api.post('/python/char-name', { name: nameInput });
      setSt(res.data.state);
      beep('click');
      showToast(`✅ ตั้งชื่อเป็น "${res.data.state.charName}" แล้ว`);
    } catch { showToast('บันทึกชื่อไม่สำเร็จ'); }
  };

  const loadBoard = useCallback(async () => {
    try { setBoard((await api.get('/python/leaderboard')).data); } catch { setBoard([]); }
  }, []);

  const loadAdmin = useCallback(async () => {
    try { setAdminRows((await api.get('/python/admin/list')).data); } catch { setAdminRows([]); }
  }, []);

  useEffect(() => {
    if (tab === 'rank') loadBoard();
    if (tab === 'admin') loadAdmin();
  }, [tab, loadBoard, loadAdmin]);

  const adminReset = async (row, mode) => {
    const label = { hints:'เติมคำใบ้เต็ม', progress:'ล้างความคืบหน้า (เก็บคะแนนเดิม)', full:'ล้างทุกอย่างรวมคะแนน' }[mode];
    if (!window.confirm(`${label}\nของ "${row.owner}" ใช่ไหม?`)) return;
    setBusy(true);
    try {
      await api.post(`/python/admin/reset/${row.userId}`, { mode });
      await loadAdmin();
      showToast('✅ รีเซ็ตแล้ว');
      if (row.userId === user?.id) {
        const s = await api.get('/python/state');
        setSt(s.data.state);
      }
    } catch (e) { showToast(e.response?.data?.message || 'รีเซ็ตไม่สำเร็จ'); }
    finally { setBusy(false); }
  };

  /* ── render ── */
  if (loading) {
    return <div className="py-wrap"><style>{CSS}</style><div className="py-container" style={{ textAlign:'center', paddingTop:80 }}>⏳ กำลังโหลด...</div></div>;
  }
  if (err || !st || !meta) {
    return (
      <div className="py-wrap"><style>{CSS}</style>
        <div className="py-container" style={{ textAlign:'center', paddingTop:80 }}>
          <p style={{ marginBottom:12 }}>😵 {err || 'ไม่พบข้อมูล'}</p>
          <button className="py-btn2" onClick={() => navigate('/dashboard')}>← กลับหน้าหลัก</button>
        </div>
      </div>
    );
  }

  const info = meta.levels.find(l => l.level === st.level) || meta.levels[0];
  const pct = Math.min(100, ((st.xp - info.need) / (info.next - info.need)) * 100);
  const nMissions = countTrue(st.missions);
  const nRewards = countTrue(st.rewards);
  const nExercises = countTrue(st.exercises);
  const nLearned = countTrue(st.learned);

  const TABS = [
    ['home','🏠 หลัก'], ['char','🧑‍💻 ตัวละคร'], ['score','📊 คะแนน'], ['exercises','✏️ แบบฝึกหัด'],
    ['missions','🎯 ภารกิจ'], ['rewards','🏆 รางวัล'], ['rank','🥇 อันดับ'],
    ...LESSON_CONTENT.map(l => [l.id, l.tab]),
    ...(isAdmin ? [['admin','🛠️ แอดมิน']] : []),
  ];

  const lesson = LESSON_CONTENT.find(l => l.id === tab);

  return (
    <div className="py-wrap">
      <style>{CSS}</style>
      <div className="py-stars" />

      <button className="py-btn2" onClick={() => setSound(s => !s)}
        style={{ position:'fixed', top:10, right:10, zIndex:50, borderRadius:99, opacity: sound ? 1 : .5 }}>
        {sound ? '🔊' : '🔇'}
      </button>

      <div className="py-container">
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <button className="py-btn2" onClick={() => navigate('/dashboard')}>←</button>
          <div style={{ flex:1 }}>
            <h1 className="py-h1">📚 Python Commands</h1>
            <p className="py-sub">เรียน · ภารกิจ · คะแนน · รางวัล · เลเวล</p>
          </div>
        </div>

        {/* สถิติ */}
        <div className="py-stats">
          <div className="py-stat"><div className="l">คะแนน</div><div className="v" style={{ color:'#fb923c' }}>{st.score.toLocaleString()}</div></div>
          <div className="py-stat"><div className="l">เลเวล</div><div className="v" style={{ color:'#fbbf24' }}>{st.level}</div></div>
          <div className="py-stat"><div className="l">XP</div><div className="v" style={{ color:'#a78bfa' }}>{st.xp}</div></div>
          <div className="py-stat"><div className="l">คำใบ้</div><div className="v" style={{ color: st.hints <= 0 ? '#f87171' : st.hints <= 2 ? '#fbbf24' : '#c4b5fd' }}>{st.hints}</div></div>
          <div className="py-stat"><div className="l">ภารกิจ</div><div className="v" style={{ color:'#4ade80' }}>{nMissions}</div></div>
          <div className="py-stat"><div className="l">รางวัล</div><div className="v" style={{ color:'#f472b6' }}>{nRewards}</div></div>
        </div>

        {/* แถบเลเวล */}
        <div className="py-banner">
          <div style={{ fontSize:'1.05rem', fontWeight:700, color:'#fbbf24' }}>{info.title}</div>
          <div style={{ fontSize:'.8rem', color:'#94a3b8' }}>
            {st.level >= 5 ? `คะแนน ${st.score}` : `เหลือ ${info.next - st.xp} XP · คะแนน ${st.score}`}
          </div>
          <div className="py-xpbar"><div className="py-xpfill" style={{ width: `${pct}%` }} /></div>
          <div style={{ fontSize:'.72rem', color:'#94a3b8', marginTop:2 }}>
            {st.level >= 5 ? '🏆 เลเวลสูงสุด!' : `${st.xp} / ${info.next} XP`}
          </div>
        </div>

        {/* แท็บ */}
        <div className="py-tabs">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); beep('click'); }}
              className={`py-tab${tab === id ? ' active' : ''}${st.learned?.[id] ? ' done' : ''}`}>{label}</button>
          ))}
        </div>

        {/* ── HOME ── */}
        {tab === 'home' && (
          <div className="py-card" style={{ textAlign:'center' }}>
            <div style={{ fontSize:'3.6rem' }}>{info.avatar}</div>
            <h2 style={{ fontSize:'1.3rem', marginBottom:4 }}>สวัสดี {user?.name || 'นักสำรวจโค้ด'}!</h2>
            <p style={{ color:'#94a3b8', maxWidth:390, margin:'0 auto 11px', fontSize:'.9rem' }}>
              เรียนรู้คำสั่ง ทำภารกิจ เก็บคะแนน อัปเลเวล และปลดล็อกรางวัล — คะแนนที่ได้จะเข้าพอยต์ของห้องเรียนด้วย
            </p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, justifyContent:'center', marginBottom:12 }}>
              {[`📖 ${LESSON_CONTENT.length} คำสั่ง`, `✏️ ${meta.exercises.length} แบบฝึกหัด`, `🎯 ${meta.missions.length} ภารกิจ`, `🏆 ${meta.rewards.length} รางวัล`].map(t => (
                <span key={t} style={{ background:'rgba(56,189,248,.12)', color:'#38bdf8', padding:'3px 9px', borderRadius:99, fontSize:'.78rem' }}>{t}</span>
              ))}
            </div>
            <div style={{ display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap' }}>
              <button className="py-btn" onClick={() => setTab('print')}>เริ่มเรียน →</button>
              <button className="py-btn2" onClick={() => setTab('exercises')}>✏️ แบบฝึกหัด</button>
              <button className="py-btn2" onClick={() => setTab('missions')}>🎯 ภารกิจ</button>
            </div>
            <p style={{ color:'#94a3b8', fontSize:'.76rem', marginTop:11 }}>💡 คะแนนบันทึกบนเซิร์ฟเวอร์ · เล่นต่อจากเครื่องไหนก็ได้</p>
          </div>
        )}

        {/* ── ตัวละคร ── */}
        {tab === 'char' && (
          <div className="py-card" style={{ textAlign:'center' }}>
            <div style={{ fontSize:'4.5rem', margin:'8px 0' }}>{info.avatar}</div>
            <div style={{ fontSize:'1.2rem', fontWeight:700, color:'#fbbf24' }}>{info.title}</div>
            <div style={{ fontSize:'.9rem', color:'#94a3b8', marginBottom:10 }}>Lv. {st.level} · {st.charName}</div>
            <div style={{ maxWidth:280, margin:'0 auto 14px' }}>
              <div className="py-xpbar"><div className="py-xpfill" style={{ width:`${pct}%` }} /></div>
              <div style={{ fontSize:'.72rem', color:'#94a3b8', marginTop:2 }}>{st.level >= 5 ? '🏆 เลเวลสูงสุด!' : `${st.xp} / ${info.next} XP`}</div>
            </div>
            <div style={{ marginBottom:14 }}>
              <input value={nameInput} maxLength={16} onChange={e => setNameInput(e.target.value)} placeholder="ตั้งชื่อตัวละคร..."
                style={{ width:'min(220px,90%)', padding:'8px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,.15)', background:'#0b1220', color:'#f1f5f9', fontFamily:'inherit', fontSize:'.9rem', textAlign:'center' }} />
              <button className="py-btn2" onClick={saveCharName} style={{ marginLeft:6 }}>บันทึกชื่อ</button>
            </div>

            <h3 style={{ fontSize:'.95rem', color:'#38bdf8', marginBottom:10, textAlign:'left' }}>📊 ค่าสถานะตัวละคร</h3>
            <div style={{ display:'grid', gap:8, textAlign:'left' }}>
              {[
                { name:'ความรู้',  icon:'📖', val: Math.min(100, nLearned * 14 + st.level * 5),  color:'#38bdf8' },
                { name:'ภารกิจ',   icon:'🎯', val: Math.min(100, nMissions * 8 + st.level * 3),  color:'#4ade80' },
                { name:'ฝึกฝน',    icon:'✏️', val: Math.min(100, nExercises * 12 + st.level * 4), color:'#fbbf24' },
                { name:'ชื่อเสียง', icon:'🏆', val: Math.min(100, nRewards * 7 + st.level * 6),   color:'#a78bfa' },
                { name:'พลังรวม',  icon:'⚡', val: Math.min(100, Math.floor(st.score / 50 + st.xp / 3 + st.level * 8)), color:'#fb923c' },
              ].map(s => (
                <div key={s.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ width:70, fontSize:'.82rem' }}>{s.icon} {s.name}</span>
                  <div style={{ flex:1, height:10, background:'rgba(255,255,255,.08)', borderRadius:99, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${s.val}%`, background:s.color, borderRadius:99, transition:'width .5s' }} />
                  </div>
                  <span style={{ width:32, textAlign:'right', fontSize:'.8rem', color:s.color, fontWeight:600 }}>{s.val}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop:14, padding:12, background:'rgba(0,0,0,.22)', borderRadius:11 }}>
              <div style={{ fontSize:'.88rem', color:'#94a3b8', marginBottom:6, textAlign:'left' }}>🎭 วิวัฒนาการตามเลเวล</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
                {meta.levels.map(lv => {
                  const on = st.level >= lv.level;
                  return (
                    <div key={lv.level} style={{ textAlign:'center', padding:8, borderRadius:10, minWidth:64, opacity: on ? 1 : .4,
                      border:`1px solid ${on ? 'rgba(251,191,36,.4)' : 'rgba(255,255,255,.08)'}`, background: on ? 'rgba(251,191,36,.1)' : 'rgba(0,0,0,.2)' }}>
                      <div style={{ fontSize:'1.6rem' }}>{on ? lv.avatar : '🔒'}</div>
                      <div style={{ fontSize:'.7rem', color:'#94a3b8' }}>Lv.{lv.level}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── คะแนน ── */}
        {tab === 'score' && (
          <div className="py-card">
            <h2 style={{ marginBottom:11, fontSize:'1.1rem' }}>📊 กระดานคะแนน</h2>
            <div style={{ textAlign:'center', padding:14, marginBottom:12, background:'linear-gradient(135deg,rgba(251,146,60,.12),rgba(251,191,36,.1))', borderRadius:13, border:'1px solid rgba(251,146,60,.3)' }}>
              <div style={{ fontSize:'2.6rem', fontWeight:700, color:'#fb923c', lineHeight:1.1 }}>{st.score.toLocaleString()}</div>
              <div style={{ fontSize:'.88rem', color:'#94a3b8' }}>คะแนนรวมจากเมนู Python</div>
              <div style={{ fontSize:'.76rem', color:'#94a3b8', marginTop:4 }}>พอยต์รวมของคุณในระบบ: {(user?.total_points ?? 0).toLocaleString()}</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginBottom:12 }}>
              {[[st.bestScore.toLocaleString(),'🏆 คะแนนสูงสุด'], [st.level,'📈 เลเวล'], [nMissions,'🎯 ภารกิจสำเร็จ'], [nRewards,'🏆 รางวัล']].map(([v, l]) => (
                <div key={l} style={{ background:'rgba(0,0,0,.22)', borderRadius:10, padding:11, textAlign:'center', border:'1px solid rgba(255,255,255,.06)' }}>
                  <div style={{ fontSize:'1.25rem', fontWeight:700, color:'#38bdf8' }}>{v}</div>
                  <div style={{ fontSize:'.72rem', color:'#94a3b8', marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
            <h3 style={{ fontSize:'.95rem', marginBottom:7, color:'#fbbf24' }}>📜 ประวัติคะแนนล่าสุด</h3>
            <div style={{ maxHeight:280, overflowY:'auto' }}>
              {!st.history.length
                ? <div style={{ textAlign:'center', color:'#94a3b8', padding:18, fontSize:'.88rem' }}>ยังไม่มีประวัติ เริ่มเรียนเพื่อเก็บคะแนน!</div>
                : st.history.map((h, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderRadius:8, marginBottom:5, background:'rgba(0,0,0,.2)', border:'1px solid rgba(255,255,255,.05)', fontSize:'.85rem' }}>
                    <span style={{ flex:1 }}>{h.reason}</span>
                    <span style={{ fontWeight:700, color:'#fb923c', minWidth:55, textAlign:'right' }}>+{h.pts}</span>
                    <span style={{ fontSize:'.7rem', color:'#94a3b8', minWidth:65, textAlign:'right', marginLeft:7 }}>
                      {new Date(h.time).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' })}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── แบบฝึกหัด ── */}
        {tab === 'exercises' && (
          <div className="py-card">
            <h2 style={{ marginBottom:6, fontSize:'1.1rem' }}>✏️ แบบฝึกหัด</h2>
            <p style={{ color:'#94a3b8', fontSize:'.85rem', marginBottom:12 }}>เลือกข้อ แล้วเขียนโค้ดให้ถูกเพื่อเก็บคะแนน!</p>

            {!curEx ? (
              <div style={{ display:'grid', gap:8 }}>
                {meta.exercises.map((ex, i) => {
                  const done = !!st.exercises?.[ex.id];
                  return (
                    <div key={ex.id} className={`py-item${done ? ' done' : ''}`} style={{ cursor:'pointer' }} onClick={() => openEx(ex)}>
                      <div style={{ fontSize:'1.3rem', width:32, textAlign:'center' }}>{ex.icon}</div>
                      <div style={{ flex:1 }}>
                        <h4 style={{ fontSize:'.88rem', marginBottom:2 }}>
                          ข้อ {i + 1}: {ex.title}{' '}
                          <span className="py-badge" style={done ? { background:'rgba(74,222,128,.2)', color:'#4ade80' } : { background:'rgba(56,189,248,.2)', color:'#38bdf8' }}>
                            {done ? '✓ ผ่าน' : 'ยังไม่ทำ'}
                          </span>
                        </h4>
                        <p style={{ fontSize:'.78rem', color:'#94a3b8' }}>{ex.desc}</p>
                        <div style={{ fontSize:'.72rem', color:'#fbbf24', marginTop:2 }}>🎁 +{ex.score} คะแนน · +{ex.xp} XP · {ex.topic}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <div style={{ background:'rgba(0,0,0,.25)', borderRadius:11, padding:14, border:'1px solid rgba(255,255,255,.08)', marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:'1.4rem' }}>{curEx.icon}</span>
                    <div>
                      <div style={{ fontWeight:600, fontSize:'1rem' }}>{curEx.title}</div>
                      <div style={{ fontSize:'.78rem', color:'#94a3b8' }}>หัวข้อ: {curEx.topic}</div>
                    </div>
                  </div>
                  <p style={{ fontSize:'.92rem', lineHeight:1.45, marginBottom:8 }}>{curEx.desc}</p>
                  <div style={{ fontSize:'.8rem', color:'#fbbf24' }}>
                    🎁 รางวัล: +{curEx.score} คะแนน · +{curEx.xp} XP{st.exercises?.[curEx.id] ? ' (ทำผ่านแล้ว)' : ''}
                  </div>
                </div>

                {exHint && (
                  <div style={{ background:'rgba(167,139,250,.12)', borderLeft:'4px solid #a78bfa', padding:'10px 12px', borderRadius:'0 10px 10px 0', marginBottom:10, fontSize:'.88rem', color:'#c4b5fd', whiteSpace:'pre-wrap', fontFamily:'ui-monospace,monospace', lineHeight:1.5 }}>
                    {exHint}
                  </div>
                )}

                <h3 style={{ fontSize:'.88rem', marginBottom:5, color:'#fbbf24' }}>✏️ เขียนโค้ดคำตอบ</h3>
                <textarea className="py-ta" style={{ minHeight:100 }} value={exCode} onChange={e => setExCode(e.target.value)} spellCheck={false} />
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <button className="py-btn" onClick={submitEx} disabled={busy}>▶️ ตรวจคำตอบ</button>
                  <button className="py-btn2" onClick={askHint}>{exHint ? '🙈 ซ่อนคำใบ้' : `💡 คำใบ้ (${st.hints})`}</button>
                  <button className="py-btn2" onClick={() => { setExCode(curEx.starter); setExOut(null); setExFb(null); }}>🔄 ล้าง</button>
                  <button className="py-btn2" onClick={() => setCurEx(null)}>← กลับรายการ</button>
                </div>
                {exOut !== null && <div className="py-out">{exOut}</div>}
                {exFb && <div className={`py-fb ${exFb.kind}`}>{exFb.text}</div>}
              </>
            )}
          </div>
        )}

        {/* ── ภารกิจ ── */}
        {tab === 'missions' && (
          <div className="py-card">
            <h2 style={{ marginBottom:10, fontSize:'1.1rem' }}>🎯 กระดานภารกิจ</h2>
            <div style={{ display:'grid', gap:8 }}>
              {meta.missions.map(m => {
                const done = !!st.missions?.[m.id];
                const locked = st.level < m.unlockLevel;
                return (
                  <div key={m.id} className={`py-item${done ? ' done' : ''}${locked ? ' locked' : ''}`}
                    style={{ cursor: !locked && !done && m.lesson ? 'pointer' : 'default' }}
                    onClick={() => { if (!locked && !done && m.lesson) { setTab(m.lesson); beep('click'); } }}>
                    <div style={{ fontSize:'1.3rem', width:32, textAlign:'center' }}>{m.icon}</div>
                    <div style={{ flex:1 }}>
                      <h4 style={{ fontSize:'.88rem', marginBottom:2 }}>
                        {m.title}{' '}
                        <span className="py-badge" style={
                          done ? { background:'rgba(74,222,128,.2)', color:'#4ade80' }
                            : locked ? { background:'rgba(148,163,184,.2)', color:'#94a3b8' }
                              : { background:'rgba(56,189,248,.2)', color:'#38bdf8' }}>
                          {done ? '✓ สำเร็จ' : locked ? `🔒 Lv.${m.unlockLevel}` : 'กำลังทำ'}
                        </span>
                      </h4>
                      <p style={{ fontSize:'.78rem', color:'#94a3b8' }}>{m.desc}</p>
                      <div style={{ fontSize:'.72rem', color:'#fbbf24', marginTop:2 }}>🎁 +{m.xp} XP · +{m.score} คะแนน</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── รางวัล ── */}
        {tab === 'rewards' && (
          <div className="py-card">
            <h2 style={{ marginBottom:4, fontSize:'1.1rem' }}>🏆 ห้องเก็บรางวัล</h2>
            <p style={{ color:'#94a3b8', fontSize:'.84rem', marginBottom:11 }}>แบ่ง 4 ระดับ: ธรรมดา · หายาก · มหากาพย์ · ตำนาน</p>
            <div className="py-rgrid">
              {[1, 2, 3, 4].map(tierNum => {
                const tier = meta.rewardTiers[tierNum];
                const items = meta.rewards.filter(r => r.tier === tierNum);
                if (!items.length) return null;
                const owned = items.filter(r => st.rewards?.[r.id]).length;
                return (
                  <React.Fragment key={tierNum}>
                    <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', gap:8, margin: tierNum > 1 ? '10px 0 4px' : '0 0 4px', padding:'6px 10px', borderRadius:8, background:tier.bg, border:`1px solid ${tier.border}` }}>
                      <span style={{ fontWeight:700, color:tier.color, fontSize:'.9rem' }}>{tier.name}</span>
                      <span style={{ fontSize:'.75rem', color:'#94a3b8' }}>{owned}/{items.length}</span>
                    </div>
                    {items.map(r => {
                      const has = !!st.rewards?.[r.id];
                      return (
                        <div key={r.id} className={`py-rcard${has ? '' : ' locked'}`}
                          style={has ? { borderColor:tier.border, background:tier.bg } : undefined}>
                          <div style={{ fontSize:'2rem', marginBottom:4 }}>{has ? r.icon : '🔒'}</div>
                          <div style={{ fontSize:'.82rem', fontWeight:600, color: has ? tier.color : undefined }}>{r.name}</div>
                          <div style={{ fontSize:'.7rem', color:'#94a3b8' }}>{has ? r.desc : '???'}</div>
                          <div style={{ fontSize:'.68rem', marginTop:3, color:tier.color }}>{tier.name}{has ? ` · +${r.scoreBonus}` : ''}</div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* ── อันดับ ── */}
        {tab === 'rank' && (
          <div className="py-card">
            <h2 style={{ marginBottom:10, fontSize:'1.1rem' }}>🥇 อันดับคะแนน Python</h2>
            {!board.length ? <div style={{ color:'#94a3b8', textAlign:'center', padding:18 }}>ยังไม่มีใครเก็บคะแนน</div> : (
              <div style={{ display:'grid', gap:6 }}>
                {board.map(r => (
                  <div key={r.userId} className="py-item" style={r.me ? { borderColor:'#38bdf8', background:'rgba(56,189,248,.08)' } : undefined}>
                    <div style={{ fontSize:'1.1rem', width:32, textAlign:'center', fontWeight:700, color: r.rank === 1 ? '#fbbf24' : r.rank === 2 ? '#cbd5e1' : r.rank === 3 ? '#cd7f32' : '#94a3b8' }}>
                      {r.rank <= 3 ? ['🥇','🥈','🥉'][r.rank - 1] : r.rank}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'.88rem', fontWeight:600 }}>{r.name} {r.me && <span style={{ fontSize:'.7rem', color:'#38bdf8' }}>(คุณ)</span>}</div>
                      <div style={{ fontSize:'.72rem', color:'#94a3b8' }}>Lv.{r.level} · {r.charName} · ✏️{r.exercises} 🎯{r.missions}</div>
                    </div>
                    <div style={{ fontWeight:700, color:'#fb923c' }}>{r.score.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── แอดมิน ── */}
        {tab === 'admin' && isAdmin && (
          <div className="py-card">
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <h2 style={{ fontSize:'1.1rem', flex:1 }}>🛠️ จัดการความคืบหน้า Python</h2>
              <button className="py-btn2" onClick={loadAdmin}>🔄 รีเฟรช</button>
            </div>
            {!adminRows.length ? <div style={{ color:'#94a3b8', textAlign:'center', padding:18 }}>ยังไม่มีใครเข้าเมนูนี้</div> : (
              <div style={{ display:'grid', gap:8 }}>
                {adminRows.map(row => (
                  <div key={row.userId} className="py-item" style={{ flexDirection:'column', alignItems:'stretch' }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'.9rem', fontWeight:600 }}>{row.owner} <span style={{ fontSize:'.7rem', color:'#94a3b8' }}>@{row.username} · {row.role}</span></div>
                        <div style={{ fontSize:'.75rem', color:'#94a3b8' }}>
                          🧑‍💻{row.charName} · Lv.{row.level} · {row.xp} XP · 💡{row.hints} · 📖{row.learned}/7 · ✏️{row.exercises}/8 · 🎯{row.missions} · 🏆{row.rewards}
                        </div>
                      </div>
                      <div style={{ fontWeight:700, color:'#fb923c' }}>{row.score.toLocaleString()}</div>
                    </div>
                    <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                      <button className="py-btn2" disabled={busy} onClick={() => adminReset(row, 'hints')}>💡 เติมคำใบ้</button>
                      <button className="py-btn2" disabled={busy} onClick={() => adminReset(row, 'progress')}>🔁 ล้างความคืบหน้า</button>
                      <button className="py-btn-danger" disabled={busy} onClick={() => adminReset(row, 'full')}>🗑️ ล้างทั้งหมด</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── บทเรียน ── */}
        {lesson && (
          <>
            <div className={`py-mascot${mascot[lesson.id] ? ' happy' : ''}`}>{mascot[lesson.id] || info.avatar}</div>
            <div className="py-card">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ fontSize:'2.1rem', width:48, height:48, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(56,189,248,.12)', borderRadius:10 }}>{lesson.emoji}</div>
                <div>
                  <h2 style={{ fontSize:'1.1rem' }}>
                    {lesson.title}{' '}
                    {st.learned?.[lesson.id] && <span style={{ background:'rgba(74,222,128,.15)', color:'#4ade80', fontSize:'.68rem', padding:'2px 6px', borderRadius:99 }}>✓</span>}
                  </h2>
                  <div style={{ fontFamily:'ui-monospace,monospace', color:'#38bdf8', fontSize:'.88rem' }}>{lesson.cmd}</div>
                </div>
              </div>

              <div style={{ background:'rgba(167,139,250,.1)', borderLeft:'4px solid #a78bfa', padding:'8px 11px', borderRadius:'0 8px 8px 0', marginBottom:11, fontSize:'.9rem', lineHeight:1.4 }}>
                <strong style={{ color:'#c4b5fd' }}>ความหมาย:</strong> {lesson.meaning}
              </div>

              <div className="py-code">
                <div style={{ fontSize:'.7rem', color:'#94a3b8', marginBottom:4 }}>📝 ตัวอย่าง</div>
                <pre>{lesson.example}</pre>
              </div>
              <button className="py-btn" onClick={() => runExample(lesson)}>▶️ รันตัวอย่าง</button>
              {exampleOut[lesson.id] && <div className="py-out">{exampleOut[lesson.id]}</div>}

              <div style={{ marginTop:11, paddingTop:10, borderTop:'1px solid rgba(255,255,255,.06)' }}>
                {lesson.isInput ? (
                  <>
                    <h3 style={{ fontSize:'.88rem', marginBottom:5, color:'#fbbf24' }}>✏️ ใส่ชื่อของคุณ</h3>
                    <input value={fakeInput} onChange={e => setFakeInput(e.target.value)} placeholder="พิมพ์ชื่อ..."
                      style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,.15)', background:'#0b1220', color:'#f1f5f9', fontFamily:'inherit', fontSize:'.88rem', marginBottom:5 }} />
                    <button className="py-btn" onClick={runInputTry}>▶️ รันพร้อมชื่อ</button>
                  </>
                ) : (
                  <>
                    <h3 style={{ fontSize:'.88rem', marginBottom:5, color:'#fbbf24' }}>✏️ ลองเขียนเอง</h3>
                    <textarea className="py-ta" spellCheck={false}
                      value={tryCode[lesson.id] ?? lesson.starter}
                      onChange={e => setTryCode(c => ({ ...c, [lesson.id]: e.target.value }))} />
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <button className="py-btn" onClick={() => runTry(lesson)}>▶️ รันโค้ด</button>
                      <button className="py-btn2" onClick={() => { setTryCode(c => ({ ...c, [lesson.id]: lesson.starter })); setTryOut(o => ({ ...o, [lesson.id]: null })); }}>🔄 รีเซ็ต</button>
                    </div>
                  </>
                )}
                {tryOut[lesson.id] && <div className="py-out">{tryOut[lesson.id]}</div>}
              </div>

              {lessonFb[lesson.id] && <div className={`py-fb ${lessonFb[lesson.id].kind}`}>{lessonFb[lesson.id].text}</div>}

              <div style={{ display:'flex', justifyContent:'space-between', gap:6, marginTop:11 }}>
                <button className="py-btn2" style={{ flex:1 }} onClick={() => setTab('home')}>← หลัก</button>
                <button className="py-btn-ok" style={{ flex:1 }} onClick={() => markLearned(lesson)}>⭐ เข้าใจแล้ว</button>
                <button className="py-btn2" style={{ flex:1 }} onClick={() => {
                  const idx = LESSON_CONTENT.findIndex(l => l.id === lesson.id);
                  setTab(idx < LESSON_CONTENT.length - 1 ? LESSON_CONTENT[idx + 1].id : 'score');
                }}>ถัดไป →</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* popup เลเวลอัป */}
      {levelPopup && (
        <div className="py-overlay" onClick={() => setLevelPopup(null)}>
          <div className="py-popup" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'2.8rem', marginBottom:4 }}>{levelPopup.avatar}</div>
            <h2 style={{ fontSize:'1.2rem', color:'#fbbf24', marginBottom:4 }}>เลเวลอัป!</h2>
            <p style={{ color:'#94a3b8', marginBottom:11, fontSize:'.88rem' }}>{st.charName} — {levelPopup.titleShort}</p>
            <button className="py-btn" onClick={() => setLevelPopup(null)}>สุดยอด!</button>
          </div>
        </div>
      )}

      {/* popup รางวัล */}
      {rewardPopup && (
        <div className="py-overlay" onClick={() => setRewardPopup(null)}>
          <div className="py-popup" style={{ borderColor:'#f472b6' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'2.8rem', marginBottom:4 }}>{rewardPopup.icon}</div>
            <h2 style={{ fontSize:'1.2rem', color:'#f472b6', marginBottom:4 }}>ได้รางวัล{rewardPopup.tierName}!</h2>
            <p style={{ color:'#94a3b8', marginBottom:11, fontSize:'.88rem' }}>
              {rewardPopup.name} — {rewardPopup.desc}<br />(+{rewardPopup.bonus} คะแนน)
            </p>
            <button className="py-btn" style={{ background:'linear-gradient(135deg,#f472b6,#ec4899)', color:'#fff' }} onClick={() => setRewardPopup(null)}>รับรางวัล!</button>
          </div>
        </div>
      )}

      {toast && <div className="py-toast">{toast}</div>}
    </div>
  );
}
