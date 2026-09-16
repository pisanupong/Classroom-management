import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

/* ═════════════════════ ค่าคงที่ / ตัวช่วย ═════════════════════ */

const ROLE_LEVEL = { STUDENT: 0, PARENT: 0, STAFF: 1, CLASS_ADMIN: 1, TEACHER: 2, ADMIN: 3, SUPER_USER: 4 };
const isTeacher = (role) => (ROLE_LEVEL[role] ?? 0) >= ROLE_LEVEL.TEACHER;

const C = {
  bg: '#0f172a', card: '#1e293b', card2: '#273449',
  accent: '#38bdf8', accent2: '#a78bfa',
  ok: '#4ade80', warn: '#fbbf24', bad: '#f87171',
  text: '#f1f5f9', muted: '#94a3b8', border: 'rgba(148,163,184,0.18)',
};

const MASTERY = {
  new:        { label: 'ยังไม่เริ่ม',   icon: '⚪', color: '#94a3b8' },
  learning:   { label: 'เริ่มเรียนรู้', icon: '🔴', color: '#f87171' },
  developing: { label: 'กำลังพัฒนา',   icon: '🟠', color: '#fb923c' },
  proficient: { label: 'ชำนาญ',        icon: '🟡', color: '#fbbf24' },
  mastered:   { label: 'เชี่ยวชาญ',    icon: '🟢', color: '#4ade80' },
};

const BLOOM = {
  remember:   { label: 'จำได้',      icon: '🧠', color: '#38bdf8' },
  understand: { label: 'เข้าใจ',     icon: '💡', color: '#4ade80' },
  apply:      { label: 'ประยุกต์ใช้', icon: '🔧', color: '#fbbf24' },
  analyze:    { label: 'วิเคราะห์',   icon: '🔍', color: '#fb923c' },
  evaluate:   { label: 'ประเมินค่า',  icon: '⚖️', color: '#f87171' },
  create:     { label: 'สร้างสรรค์',  icon: '✨', color: '#a78bfa' },
};
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

const QUALITY_LABEL = {
  5: { t: 'ตอบถูก เร็วและมั่นใจ', c: '#4ade80' },
  4: { t: 'ตอบถูก แต่ใช้เวลาพอสมควร', c: '#a3e635' },
  3: { t: 'ตอบถูก แบบยังไม่มั่นใจ', c: '#fbbf24' },
  2: { t: 'ตอบผิด แต่มีร่องรอยการคิด', c: '#fb923c' },
  1: { t: 'ตอบผิด', c: '#f87171' },
  0: { t: 'ข้ามข้อนี้', c: '#94a3b8' },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '—');
const fmtSec = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} วิ`);
const clr = (p) => (p == null ? C.muted : p >= 80 ? C.ok : p >= 60 ? C.warn : C.bad);

/* ═════════════════════ ชิ้นส่วน UI ที่ใช้ซ้ำ ═════════════════════ */

const Card = ({ children, style, ...rest }) => (
  <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, ...style }} {...rest}>
    {children}
  </div>
);

const Stat = ({ icon, label, value, sub, color }) => (
  <Card style={{ flex: '1 1 140px', minWidth: 140 }}>
    <div style={{ fontSize: 12, color: C.muted, display: 'flex', gap: 6, alignItems: 'center' }}>
      <span>{icon}</span>{label}
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: color || C.text, marginTop: 4, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{sub}</div>}
  </Card>
);

const Bar = ({ pct, color, height = 8 }) => (
  <div style={{ background: 'rgba(148,163,184,0.18)', borderRadius: 99, height, overflow: 'hidden' }}>
    <div style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .4s' }} />
  </div>
);

const Pill = ({ children, color, bg }) => (
  <span style={{
    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
    color: color || C.text, background: bg || 'rgba(148,163,184,0.15)', whiteSpace: 'nowrap',
  }}>{children}</span>
);

const MasteryPill = ({ status }) => {
  const m = MASTERY[status] || MASTERY.new;
  return <Pill color={m.color} bg={`${m.color}22`}>{m.icon} {m.label}</Pill>;
};

const Empty = ({ icon, title, hint }) => (
  <Card style={{ textAlign: 'center', padding: 40 }}>
    <div style={{ fontSize: 44 }}>{icon}</div>
    <div style={{ fontWeight: 700, marginTop: 10, color: C.text }}>{title}</div>
    {hint && <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.7 }}>{hint}</div>}
  </Card>
);

const btn = (variant = 'ghost') => {
  const base = {
    border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'transform .1s',
  };
  if (variant === 'primary') return { ...base, background: C.accent, color: '#062033' };
  if (variant === 'ok')      return { ...base, background: C.ok, color: '#052e16' };
  if (variant === 'danger')  return { ...base, background: 'rgba(248,113,113,0.15)', color: C.bad, border: `1px solid ${C.bad}55` };
  return { ...base, background: 'rgba(148,163,184,0.14)', color: C.text, border: `1px solid ${C.border}` };
};

const input = {
  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 9, padding: '9px 11px',
  color: C.text, fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};

/* ═════════════════════ แท็บ 1 · ฝึกวันนี้ ═════════════════════ */

const TabPractice = ({ meta, onFinished }) => {
  const [phase, setPhase] = useState('setup');      // setup | running | done
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [changes, setChanges] = useState(0);
  const [hint, setHint] = useState(null);
  const [result, setResult] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [log, setLog] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const startedAt = useRef(Date.now());
  const timer = useRef(null);

  // จับเวลาเฉพาะตอนยังไม่ส่งคำตอบ
  useEffect(() => {
    if (phase !== 'running' || result) return;
    timer.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer.current);
  }, [phase, result, idx]);

  const topics = [...new Set(meta.tree.filter(t => !subject || String(t.subjectId) === String(subject)).map(t => t.topic))];
  const available = meta.tree
    .filter(t => (!subject || String(t.subjectId) === String(subject)) && (!topic || t.topic === topic))
    .reduce((s, t) => s + t.count, 0);

  const start = async () => {
    setLoading(true); setErr('');
    try {
      const { data } = await api.get('/practice/session', {
        params: { count, ...(subject ? { subject } : {}), ...(topic ? { topic } : {}) },
      });
      if (!data.items.length) { setErr(data.reason || 'ไม่มีข้อสอบที่ตรงเงื่อนไข'); return; }
      setItems(data.items); setIdx(0); setLog([]);
      resetItem();
      setPhase('running');
    } catch (e) {
      setErr(e.response?.data?.message || 'เริ่มชุดฝึกไม่สำเร็จ');
    } finally { setLoading(false); }
  };

  const resetItem = () => {
    setChosen(null); setChanges(0); setHint(null); setResult(null); setElapsed(0);
    startedAt.current = Date.now();
  };

  const pick = (c) => {
    if (result) return;
    if (chosen !== null && chosen !== c) setChanges(n => n + 1);   // นับการเปลี่ยนใจก่อนส่ง
    setChosen(c);
  };

  const askHint = async () => {
    const item = items[idx];
    try {
      const { data } = await api.get(`/practice/hint/${item.id}`);
      setHint(data.hint);
    } catch { setHint('ดึงคำใบ้ไม่สำเร็จ'); }
  };

  const submit = async (skip = false) => {
    if (submitting) return;
    const item = items[idx];
    setSubmitting(true);
    clearInterval(timer.current);
    try {
      const { data } = await api.post('/practice/answer', {
        itemId: item.id,
        answer: skip ? null : chosen,
        timeSpentSec: elapsed,
        answerChanges: changes,
        hintUsed: hint !== null,
        skipped: skip,
      });
      setResult(data);
      setLog(l => [...l, { item, ...data, timeSpentSec: elapsed }]);
    } catch (e) {
      setErr(e.response?.data?.message || 'บันทึกคำตอบไม่สำเร็จ');
    } finally { setSubmitting(false); }
  };

  const next = () => {
    if (idx + 1 >= items.length) { setPhase('done'); onFinished?.(); return; }
    setIdx(i => i + 1);
    resetItem();
  };

  /* ── หน้าตั้งค่าชุดฝึก ── */
  if (phase === 'setup') {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <Card>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>🎯 เริ่มชุดฝึกสั้น</div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
            ระบบเลือกข้อให้อัตโนมัติ โดยเอาหัวข้อที่ถึงกำหนดทบทวนมาก่อน แล้วต่อด้วยหัวข้อที่ยังไม่ชำนาญ
            และข้อใหม่ที่ระดับความยากใกล้เคียงความสามารถของคุณ — ยิ่งฝึกบ่อย ยิ่งวัดผลได้แม่นขึ้น
          </div>
        </Card>

        <Card style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={{ fontSize: 12, color: C.muted }}>วิชา</span>
              <select style={input} value={subject} onChange={e => { setSubject(e.target.value); setTopic(''); }}>
                <option value="">ทุกวิชา</option>
                {meta.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={{ fontSize: 12, color: C.muted }}>หัวข้อ</span>
              <select style={input} value={topic} onChange={e => setTopic(e.target.value)}>
                <option value="">ทุกหัวข้อ</option>
                {topics.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <span style={{ fontSize: 12, color: C.muted }}>จำนวนข้อ</span>
              <select style={input} value={count} onChange={e => setCount(Number(e.target.value))}>
                {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n} ข้อ</option>)}
              </select>
            </label>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            มีข้อสอบที่ตรงเงื่อนไข <b style={{ color: C.accent }}>{available}</b> ข้อ
          </div>
          {err && <div style={{ color: C.bad, fontSize: 13 }}>{err}</div>}
          <button style={{ ...btn('primary'), padding: '12px 16px' }} onClick={start} disabled={loading}>
            {loading ? 'กำลังเตรียมชุดฝึก…' : '▶ เริ่มฝึก'}
          </button>
        </Card>
      </div>
    );
  }

  /* ── สรุปท้ายชุด ── */
  if (phase === 'done') {
    const correct = log.filter(l => l.correct).length;
    const totalTime = log.reduce((s, l) => s + l.timeSpentSec, 0);
    const acc = log.length ? Math.round((correct / log.length) * 100) : 0;
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <Card style={{ textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 48 }}>{acc >= 80 ? '🎉' : acc >= 50 ? '💪' : '📚'}</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>ทำครบ {log.length} ข้อแล้ว</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: clr(acc), marginTop: 8 }}>{correct}/{log.length}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>ความแม่นยำ {acc}% · ใช้เวลา {fmtSec(totalTime)}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <button style={btn('primary')} onClick={() => setPhase('setup')}>ฝึกชุดใหม่</button>
          </div>
        </Card>

        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>รายละเอียดแต่ละข้อ</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {log.map((l, i) => (
              <div key={i} style={{
                background: C.card2, borderRadius: 10, padding: 10,
                borderLeft: `3px solid ${l.correct ? C.ok : C.bad}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 13, flex: 1 }}>
                    <span style={{ color: C.muted, marginRight: 6 }}>{i + 1}.</span>
                    {l.item.question_text}
                  </div>
                  <Pill color={QUALITY_LABEL[l.quality]?.c}>{l.correct ? '✓' : '✕'} {fmtSec(l.timeSpentSec)}</Pill>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>
                  {l.item.sub_topic} · ทบทวนอีกครั้ง {fmtDate(l.nextReview?.date)} (อีก {l.nextReview?.days} วัน)
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  /* ── กำลังทำข้อสอบ ── */
  const item = items[idx];
  const over = elapsed > item.expected_sec;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* แถบความคืบหน้า */}
      <Card style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginBottom: 7 }}>
          <span>ข้อ {idx + 1} / {items.length}</span>
          <span style={{ color: result ? C.muted : over ? C.warn : C.accent, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            ⏱ {fmtSec(elapsed)} <span style={{ color: C.muted, fontWeight: 400 }}>/ ปกติ {fmtSec(item.expected_sec)}</span>
          </span>
        </div>
        <Bar pct={((idx + (result ? 1 : 0)) / items.length) * 100} color={C.accent} />
      </Card>

      {/* คำถาม */}
      <Card>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <Pill>{item.subject}</Pill>
          <Pill>{item.topic} › {item.sub_topic}</Pill>
          {BLOOM[item.bloom] && (
            <Pill color={BLOOM[item.bloom].color} bg={`${BLOOM[item.bloom].color}22`}>
              {BLOOM[item.bloom].icon} {BLOOM[item.bloom].label}
            </Pill>
          )}
          {item.due && <Pill color={C.accent2} bg="rgba(167,139,250,0.15)">🔁 ถึงกำหนดทบทวน</Pill>}
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.65, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
          {item.question_text}
        </div>

        <div style={{ display: 'grid', gap: 9 }}>
          {(item.choices || []).map((c, i) => {
            const sel = String(chosen) === String(c);
            const isRight = result && String(result.correctAnswer) === String(c);
            const isWrongPick = result && sel && !result.correct;
            let bg = C.card2, bd = C.border, col = C.text;
            if (isRight)          { bg = 'rgba(74,222,128,0.15)'; bd = C.ok;     col = C.ok; }
            else if (isWrongPick) { bg = 'rgba(248,113,113,0.15)'; bd = C.bad;   col = C.bad; }
            else if (sel)         { bg = 'rgba(56,189,248,0.15)';  bd = C.accent; col = C.accent; }
            return (
              <button key={i} onClick={() => pick(c)} disabled={!!result}
                style={{
                  display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left',
                  background: bg, border: `1.5px solid ${bd}`, borderRadius: 11, padding: '12px 14px',
                  color: col, fontSize: 15, fontFamily: 'inherit', cursor: result ? 'default' : 'pointer',
                  fontWeight: sel || isRight ? 700 : 500,
                }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: 'rgba(148,163,184,0.15)', fontSize: 12, fontWeight: 800,
                }}>{isRight ? '✓' : isWrongPick ? '✕' : String.fromCharCode(65 + i)}</span>
                <span>{c}</span>
              </button>
            );
          })}
        </div>

        {hint && (
          <div style={{
            marginTop: 13, background: 'rgba(251,191,36,0.1)', border: `1px solid ${C.warn}44`,
            borderRadius: 10, padding: 11, fontSize: 13, color: C.warn, lineHeight: 1.6,
          }}>💡 <b>คำใบ้:</b> {hint}</div>
        )}

        {changes > 0 && !result && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>เปลี่ยนคำตอบแล้ว {changes} ครั้ง</div>
        )}

        {!result && (
          <div style={{ display: 'flex', gap: 9, marginTop: 16, flexWrap: 'wrap' }}>
            <button style={{ ...btn('primary'), flex: 1, minWidth: 140 }}
              onClick={() => submit(false)} disabled={chosen === null || submitting}>
              {submitting ? 'กำลังตรวจ…' : 'ส่งคำตอบ'}
            </button>
            {item.has_hint && !hint && <button style={btn()} onClick={askHint}>💡 ขอคำใบ้</button>}
            <button style={btn()} onClick={() => submit(true)} disabled={submitting}>ข้ามข้อนี้</button>
          </div>
        )}
      </Card>

      {/* ผลตรวจทันที */}
      {result && (
        <Card style={{ borderColor: result.correct ? `${C.ok}55` : `${C.bad}55` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 22 }}>{result.correct ? '✅' : '❌'}</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: result.correct ? C.ok : C.bad }}>
              {result.correct ? 'ถูกต้อง!' : 'ยังไม่ถูก'}
            </div>
            <Pill color={QUALITY_LABEL[result.quality]?.c} bg={`${QUALITY_LABEL[result.quality]?.c}22`}>
              q={result.quality} · {QUALITY_LABEL[result.quality]?.t}
            </Pill>
            {result.streak >= 2 && <Pill color={C.warn} bg="rgba(251,191,36,0.15)">🔥 ถูกติดกัน {result.streak} ข้อ</Pill>}
          </div>

          {result.misconception && (
            <div style={{
              marginTop: 12, background: 'rgba(251,146,60,0.1)', border: `1px solid #fb923c55`,
              borderRadius: 10, padding: 12, fontSize: 13.5, lineHeight: 1.7,
            }}>
              <b style={{ color: '#fb923c' }}>🔍 จุดที่มักเข้าใจผิด:</b> {result.misconception}
            </div>
          )}

          {result.explanation && (
            <div style={{
              marginTop: 10, background: C.card2, borderRadius: 10, padding: 12,
              fontSize: 13.5, lineHeight: 1.75, whiteSpace: 'pre-wrap',
            }}>
              <b style={{ color: C.accent }}>📖 คำอธิบาย:</b> {result.explanation}
            </div>
          )}

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
            gap: 10, marginTop: 13,
          }}>
            <div style={{ background: C.card2, borderRadius: 9, padding: 10 }}>
              <div style={{ fontSize: 11, color: C.muted }}>ระดับความสามารถ</div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                {result.elo.after}{' '}
                <span style={{ fontSize: 12, color: result.elo.delta >= 0 ? C.ok : C.bad }}>
                  {result.elo.delta >= 0 ? '▲' : '▼'}{Math.abs(result.elo.delta)}
                </span>
              </div>
            </div>
            <div style={{ background: C.card2, borderRadius: 9, padding: 10 }}>
              <div style={{ fontSize: 11, color: C.muted }}>โอกาสที่เข้าใจแล้ว</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: clr(result.pKnown * 100) }}>
                {Math.round(result.pKnown * 100)}%
              </div>
            </div>
            <div style={{ background: C.card2, borderRadius: 9, padding: 10 }}>
              <div style={{ fontSize: 11, color: C.muted }}>สถานะหัวข้อนี้</div>
              <div style={{ marginTop: 4 }}><MasteryPill status={result.masteryStatus} /></div>
            </div>
            <div style={{ background: C.card2, borderRadius: 9, padding: 10 }}>
              <div style={{ fontSize: 11, color: C.muted }}>ทบทวนอีกครั้ง</div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>อีก {result.nextReview.days} วัน</div>
              <div style={{ fontSize: 10, color: C.muted }}>{fmtDate(result.nextReview.date)} · EF {result.nextReview.ef}</div>
            </div>
          </div>

          <button style={{ ...btn('primary'), width: '100%', marginTop: 14, padding: '12px' }} onClick={next}>
            {idx + 1 >= items.length ? 'ดูสรุปผล →' : 'ข้อต่อไป →'}
          </button>
        </Card>
      )}
    </div>
  );
};

/* ═════════════════════ แท็บ 2 · ความรู้ของฉัน ═════════════════════ */

const TabMyKnowledge = ({ viewUserId, viewName }) => {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/practice/dashboard', { params: viewUserId ? { userId: viewUserId } : {} });
      setD(data);
    } catch { setD(null); } finally { setLoading(false); }
  }, [viewUserId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Card style={{ textAlign: 'center', color: C.muted, padding: 30 }}>กำลังโหลดรายงาน…</Card>;
  if (!d) return <Empty icon="⚠️" title="ดึงรายงานไม่สำเร็จ" hint="ลองรีเฟรชอีกครั้ง" />;
  if (!d.summary.totalAttempts) {
    return <Empty icon="📊" title="ยังไม่มีข้อมูลการเรียนรู้"
      hint={'เริ่มจากแท็บ "ฝึกวันนี้" — ทำแบบฝึกหัดสัก 3–5 ข้อ ระบบจะเริ่มวัดผลและวางแผนทบทวนให้ทันที'} />;
  }

  const s = d.summary;
  const maxTrend = Math.max(...d.trend.map(t => t.total), 1);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {viewName && (
        <Card style={{ padding: 12, fontSize: 13 }}>
          👀 กำลังดูรายงานของ <b style={{ color: C.accent }}>{viewName}</b>
        </Card>
      )}

      {/* สรุป */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat icon="📝" label="ทำไปทั้งหมด" value={s.totalAttempts} sub={`${s.daysActive} วันที่ฝึก`} />
        <Stat icon="🎯" label="ความแม่นยำ" value={`${s.accuracy ?? 0}%`} color={clr(s.accuracy)} />
        <Stat icon="⚡" label="ระดับความสามารถ" value={s.elo} sub="Elo เฉลี่ยทุกหัวข้อ" color={C.accent} />
        <Stat icon="🟢" label="เชี่ยวชาญแล้ว" value={`${s.mastered}/${s.subTopics}`} sub={`ชำนาญอีก ${s.proficient} หัวข้อ`} color={C.ok} />
        <Stat icon="🔁" label="ถึงกำหนดทบทวน" value={s.dueToday} sub="หัวข้อวันนี้" color={s.dueToday ? C.warn : C.muted} />
        <Stat icon="🔥" label="ถูกติดกันสูงสุด" value={s.longestStreak} sub="ข้อ" color={C.warn} />
      </div>

      {/* แผนซ่อมเสริม */}
      {!!d.recommendations.length && (
        <Card>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>🧭 ควรฝึกเรื่องนี้ก่อน</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            เรียงตามความจำเป็น — รวมทั้งเรื่องที่เคยทำได้แล้วแต่เริ่มลืม
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {d.recommendations.map((r, i) => (
              <div key={i} style={{
                background: C.card2, borderRadius: 10, padding: 11,
                borderLeft: `3px solid ${r.decay.level === 'high' ? C.bad : r.due ? C.warn : C.accent}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{i + 1}. {r.subTopic}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <MasteryPill status={r.status} />
                    {r.accuracy != null && <Pill color={clr(r.accuracy)}>{r.accuracy}%</Pill>}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                  {r.subject} › {r.topic} · {r.reason}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Knowledge Heatmap */}
      <Card>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>🗺️ แผนที่ความรู้</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          กดที่หัวข้อเพื่อดูรายละเอียดรายหัวข้อย่อย · สีแสดงระดับความเชี่ยวชาญ
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {d.heatmap.map(sub => (
            <div key={sub.subjectId} style={{ background: C.card2, borderRadius: 11, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>📚 {sub.subject}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Pill color={C.accent}>Elo {sub.elo}</Pill>
                  <Pill color={C.ok}>🟢 {sub.masteredCount}/{sub.subTopicCount}</Pill>
                  <Pill>{sub.attempts} ครั้ง</Pill>
                </div>
              </div>

              {sub.topics.map(t => (
                <div key={t.topic} style={{ marginTop: 10 }}>
                  <div onClick={() => setOpen(o => ({ ...o, [`${sub.subjectId}-${t.topic}`]: !o[`${sub.subjectId}-${t.topic}`] }))}
                    style={{ cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: C.muted, fontSize: 11 }}>
                      {open[`${sub.subjectId}-${t.topic}`] ? '▼' : '▶'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1 }}>{t.topic}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>
                      {t.mastered} เชี่ยวชาญ · {t.weak} ต้องฝึก
                    </span>
                  </div>
                  {/* แถบรวมของหัวข้อ */}
                  <div style={{ display: 'flex', gap: 3, marginTop: 6, marginLeft: 19 }}>
                    {t.subTopics.map(st => (
                      <div key={st.subTopic} title={`${st.subTopic} — ${MASTERY[st.status]?.label} ${Math.round(st.pKnown * 100)}%`}
                        style={{
                          flex: 1, height: 10, borderRadius: 3,
                          background: MASTERY[st.status]?.color || C.muted,
                          opacity: 0.35 + st.pKnown * 0.65,
                        }} />
                    ))}
                  </div>

                  {open[`${sub.subjectId}-${t.topic}`] && (
                    <div style={{ display: 'grid', gap: 7, marginTop: 9, marginLeft: 19 }}>
                      {t.subTopics.map(st => (
                        <div key={st.subTopic} style={{ background: C.bg, borderRadius: 9, padding: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{st.subTopic}</div>
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              <MasteryPill status={st.status} />
                              {st.due && <Pill color={C.warn} bg="rgba(251,191,36,0.15)">🔁 ควรทบทวน</Pill>}
                              {st.decay.level === 'high' && <Pill color={C.bad} bg="rgba(248,113,113,0.15)">⚠️ เริ่มลืม</Pill>}
                            </div>
                          </div>
                          <div style={{ marginTop: 8 }}><Bar pct={st.pKnown * 100} color={MASTERY[st.status]?.color} /></div>
                          <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(88px,1fr))',
                            gap: 7, marginTop: 9, fontSize: 11, color: C.muted,
                          }}>
                            <div>ทำไป <b style={{ color: C.text }}>{st.attempts}</b> ครั้ง</div>
                            <div>แม่นยำ <b style={{ color: clr(st.accuracy) }}>{st.accuracy ?? '—'}%</b></div>
                            <div>เวลาเฉลี่ย <b style={{ color: C.text }}>{Math.round(st.avgTimeSec)} วิ</b></div>
                            <div>Elo <b style={{ color: C.accent }}>{st.elo}</b></div>
                            {st.growth != null && (
                              <div>พัฒนาการ <b style={{ color: st.growth >= 0 ? C.ok : C.bad }}>
                                {st.growth >= 0 ? '+' : ''}{st.growth}%</b></div>
                            )}
                            {st.fluency != null && (
                              <div>ความคล่อง <b style={{ color: st.fluency >= 0 ? C.ok : C.warn }}>
                                {st.fluency >= 0 ? 'เร็วขึ้น' : 'ช้าลง'} {Math.abs(st.fluency)}%</b></div>
                            )}
                            <div>ทบทวน <b style={{ color: C.text }}>{fmtDate(st.nextReviewDate)}</b></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      {/* กราฟความแม่นยำรายวัน */}
      {d.trend.length > 1 && (
        <Card>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>📈 ความแม่นยำย้อนหลัง</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 130 }}>
            {d.trend.map(t => (
              <div key={t.date} title={`${t.date} — ${t.total} ข้อ, แม่นยำ ${t.accuracy}%`}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 3, minWidth: 5 }}>
                <div style={{
                  height: `${Math.max(4, (t.accuracy || 0))}%`, background: clr(t.accuracy),
                  borderRadius: '3px 3px 0 0', opacity: 0.45 + (t.total / maxTrend) * 0.55,
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted, marginTop: 6 }}>
            <span>{d.trend[0].date}</span><span>{d.trend[d.trend.length - 1].date}</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
            ความสูง = ความแม่นยำ · ความเข้มของสี = จำนวนข้อที่ทำในวันนั้น
          </div>
        </Card>
      )}

      {/* Bloom */}
      <Card>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>🎓 ความสามารถตามระดับการคิด</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>ตามลำดับขั้น Bloom's Taxonomy</div>
        <div style={{ display: 'grid', gap: 9 }}>
          {BLOOM_ORDER.map(k => {
            const b = d.bloom.find(x => x.key === k) || { attempts: 0, accuracy: null };
            const meta = BLOOM[k];
            return (
              <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 118, fontSize: 12.5, fontWeight: 600 }}>{meta.icon} {meta.label}</div>
                <div style={{ flex: 1 }}><Bar pct={b.accuracy || 0} color={meta.color} height={10} /></div>
                <div style={{ width: 96, textAlign: 'right', fontSize: 11.5, color: C.muted }}>
                  {b.attempts ? <><b style={{ color: clr(b.accuracy) }}>{b.accuracy}%</b> · {b.attempts} ข้อ</> : 'ยังไม่มีข้อมูล'}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div><button style={btn()} onClick={load}>↻ รีเฟรช</button></div>
    </div>
  );
};

/* ═════════════════════ แท็บ 3 · ภาพรวมห้อง (ครู) ═════════════════════ */

const TabClass = ({ meta, onViewStudent }) => {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [view, setView] = useState('overview');   // overview | groups | items

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/practice/class', { params: subject ? { subject } : {} });
      setD(data);
    } catch { setD(null); } finally { setLoading(false); }
  }, [subject]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Card style={{ textAlign: 'center', color: C.muted, padding: 30 }}>กำลังวิเคราะห์…</Card>;
  if (!d) return <Empty icon="⚠️" title="ดึงข้อมูลไม่สำเร็จ" />;
  if (!d.summary.totalAttempts) {
    return <Empty icon="👩‍🏫" title="ยังไม่มีนักเรียนทำแบบฝึกหัด"
      hint={'เพิ่มข้อสอบในแท็บ "คลังข้อสอบ" แล้วให้นักเรียนเข้าไปฝึก — ระบบจะสรุปให้อัตโนมัติ'} />;
  }

  const s = d.summary;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: 12 }}>
        <select style={{ ...input, width: 'auto', minWidth: 150 }} value={subject} onChange={e => setSubject(e.target.value)}>
          <option value="">ทุกวิชา</option>
          {meta.subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['overview', '📊 ภาพรวม'], ['groups', '👥 จัดกลุ่ม'], ['items', '🔬 วิเคราะห์ข้อสอบ']].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)}
              style={{ ...btn(view === k ? 'primary' : 'ghost'), padding: '7px 13px' }}>{l}</button>
          ))}
        </div>
        <button style={{ ...btn(), marginLeft: 'auto' }} onClick={load}>↻</button>
      </Card>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat icon="👥" label="นักเรียนที่ฝึก" value={s.students} />
        <Stat icon="📝" label="จำนวนครั้งทั้งหมด" value={s.totalAttempts} />
        <Stat icon="🎯" label="ความแม่นยำของห้อง" value={`${s.accuracy ?? 0}%`} color={clr(s.accuracy)} />
        <Stat icon="🗂️" label="ข้อสอบในคลัง" value={s.items} sub={`${s.subTopics} หัวข้อย่อย`} />
        <Stat icon="🔴" label="ต้องสอนซ่อมเสริม" value={s.needsHelp} sub="คน" color={s.needsHelp ? C.bad : C.ok} />
      </div>

      {view === 'overview' && (
        <>
          {!!d.misconceptions.length && (
            <Card style={{ borderColor: '#fb923c55' }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>🚨 สัญญาณความเข้าใจผิดร่วมกัน</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                ตัวเลือกผิดเดียวกันที่นักเรียนตั้งแต่ 3 คนเลือก และเป็นคำตอบผิดส่วนใหญ่ของข้อนั้น
              </div>
              <div style={{ display: 'grid', gap: 9 }}>
                {d.misconceptions.map((m, i) => (
                  <div key={i} style={{ background: C.card2, borderRadius: 10, padding: 11, borderLeft: '3px solid #fb923c' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.question_text}</div>
                    <div style={{ fontSize: 12, marginTop: 7, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Pill color={C.bad} bg="rgba(248,113,113,0.15)">เลือกผิดว่า: {m.chosen}</Pill>
                      <Pill color={C.ok} bg="rgba(74,222,128,0.15)">ที่ถูก: {m.correct}</Pill>
                      <Pill color="#fb923c">{m.students} คน</Pill>
                    </div>
                    {m.note && <div style={{ fontSize: 12.5, color: '#fdba74', marginTop: 7 }}>🔍 {m.note}</div>}
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                      {m.sub_topic} · {m.studentNames.join(', ')}{m.students > 8 ? ' …' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>📉 หัวข้อที่ห้องอ่อนที่สุด</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {d.weakTopics.slice(0, 12).map(t => (
                <div key={t.subTopic} style={{ background: C.card2, borderRadius: 10, padding: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.subTopic}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Pill color={clr(t.accuracy)}>{t.accuracy ?? '—'}%</Pill>
                      <Pill>{t.students} คน · {t.attempts} ครั้ง</Pill>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, margin: '5px 0 7px' }}>
                    {t.topic} · 🟢 เชี่ยวชาญ {t.mastered} คน · 🔴 ยังไม่ผ่าน {t.struggling} คน
                  </div>
                  <Bar pct={t.avgPKnown * 100} color={clr(t.avgPKnown * 100)} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 12 }}>🎓 ระดับการคิดของทั้งห้อง</div>
            <div style={{ display: 'grid', gap: 9 }}>
              {BLOOM_ORDER.map(k => {
                const b = d.bloom.find(x => x.key === k) || { attempts: 0, accuracy: null };
                return (
                  <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 118, fontSize: 12.5 }}>{BLOOM[k].icon} {BLOOM[k].label}</div>
                    <div style={{ flex: 1 }}><Bar pct={b.accuracy || 0} color={BLOOM[k].color} height={10} /></div>
                    <div style={{ width: 96, textAlign: 'right', fontSize: 11.5, color: C.muted }}>
                      {b.attempts ? <><b style={{ color: clr(b.accuracy) }}>{b.accuracy}%</b> · {b.attempts}</> : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {view === 'groups' && (
        <>
          <Card style={{ padding: 12, fontSize: 12.5, color: C.muted, lineHeight: 1.7 }}>
            แบ่งกลุ่มจากค่าเฉลี่ยโอกาสที่เข้าใจแล้ว (BKT) ของทุกหัวข้อย่อย — ใช้วางแผนสอนซ่อมเสริมหรือให้งานที่ยากขึ้น
          </Card>
          {d.groups.map(g => (
            <Card key={g.key} style={{ borderColor: `${g.color}44` }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: g.color, marginBottom: 10 }}>
                {g.label} · {g.students.length} คน
              </div>
              {!g.students.length ? (
                <div style={{ fontSize: 13, color: C.muted }}>ยังไม่มีนักเรียนในกลุ่มนี้</div>
              ) : (
                <div style={{ display: 'grid', gap: 7 }}>
                  {g.students.map(st => (
                    <div key={st.userId} onClick={() => onViewStudent(st.userId, st.name)}
                      style={{ background: C.card2, borderRadius: 10, padding: 11, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{st.name}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Pill color={C.accent}>Elo {st.elo}</Pill>
                          <Pill color={clr(st.accuracy)}>{st.accuracy ?? '—'}%</Pill>
                          <Pill color={C.ok}>🟢 {st.mastered}/{st.subTopics}</Pill>
                        </div>
                      </div>
                      {!!st.weakTopics.length && (
                        <div style={{ fontSize: 11, color: C.bad, marginTop: 5 }}>
                          ต้องช่วย: {st.weakTopics.join(' · ')}
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>กดเพื่อดูรายงานรายบุคคล →</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </>
      )}

      {view === 'items' && (
        <>
          <Card style={{ padding: 12, fontSize: 12.5, color: C.muted, lineHeight: 1.8 }}>
            <b style={{ color: C.text }}>p</b> = ค่าความยาก (สัดส่วนคนตอบถูก — 0.3–0.8 คือช่วงที่ดี) ·{' '}
            <b style={{ color: C.text }}>d</b> = อำนาจจำแนก (ควร ≥ 0.2; ถ้าติดลบแสดงว่าเด็กเก่งตอบผิดมากกว่า
            น่าจะมีปัญหาที่ตัวคำถามหรือเฉลย) · ต้องมีคนทำ ≥ 10 ครั้งจึงคำนวณ d ได้
          </Card>
          <Card style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 640 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 70px 70px 60px 120px',
                gap: 8, padding: '8px 4px', fontSize: 11, color: C.muted,
                borderBottom: `1px solid ${C.border}`, fontWeight: 700,
              }}>
                <div>คำถาม</div><div>หัวข้อย่อย</div><div>p</div><div>d</div><div>n</div><div>คุณภาพ</div>
              </div>
              {d.itemAnalysis.map(it => (
                <div key={it.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 70px 70px 60px 120px',
                  gap: 8, padding: '9px 4px', fontSize: 12.5, borderBottom: `1px solid ${C.border}`,
                  alignItems: 'center',
                }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.question_text}>
                    {it.question_text}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{it.sub_topic}</div>
                  <div style={{ color: it.p == null ? C.muted : it.p > 0.9 || it.p < 0.25 ? C.warn : C.ok, fontWeight: 700 }}>
                    {it.p ?? '—'}
                  </div>
                  <div style={{ color: it.d == null ? C.muted : it.d < 0 ? C.bad : it.d < 0.2 ? C.warn : C.ok, fontWeight: 700 }}>
                    {it.d ?? '—'}
                  </div>
                  <div style={{ color: C.muted }}>{it.n}</div>
                  <div><Pill color={it.qualityLabel?.color} bg={`${it.qualityLabel?.color}22`}>{it.qualityLabel?.label}</Pill></div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

/* ═════════════════════ แท็บ 4 · คลังข้อสอบ (ครู) ═════════════════════ */

const emptyForm = () => ({
  subject_id: '', topic: '', sub_topic: '', bloom: 'understand',
  question_text: '', choices: ['', '', '', ''], correct_answer: '',
  explanation: '', hint: '', misconception: {}, is_active: true,
});

const TabBank = ({ meta, reloadMeta }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [form, setForm] = useState(null);        // null = ไม่ได้เปิดฟอร์ม
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [quizzes, setQuizzes] = useState([]);
  const [imp, setImp] = useState({ quizId: '', subject_id: '', topic: '', sub_topic: '', bloom: 'understand' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/practice/items', {
        params: { ...(filterSubject ? { subject: filterSubject } : {}), ...(search ? { search } : {}) },
      });
      setItems(data);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [filterSubject, search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const openImport = async () => {
    setImportOpen(true);
    try { const { data } = await api.get('/practice/importable-quizzes'); setQuizzes(data); } catch { setQuizzes([]); }
  };

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      if (form.id) await api.put(`/practice/items/${form.id}`, form);
      else await api.post('/practice/items', form);
      setMsg('✅ บันทึกแล้ว');
      setForm(null);
      load(); reloadMeta();
    } catch (e) {
      setMsg(`⚠️ ${e.response?.data?.message || 'บันทึกไม่สำเร็จ'}`);
    } finally { setSaving(false); }
  };

  const remove = async (it) => {
    if (!window.confirm(`ลบ/ปิดใช้งานข้อนี้?\n\n${it.question_text}`)) return;
    try {
      const { data } = await api.delete(`/practice/items/${it.id}`);
      setMsg(data.message || (data.deleted ? '✅ ลบแล้ว' : '✅ ปิดใช้งานแล้ว'));
      load();
    } catch (e) { setMsg(`⚠️ ${e.response?.data?.message || 'ลบไม่สำเร็จ'}`); }
  };

  const doImport = async () => {
    if (!imp.quizId) return setMsg('⚠️ เลือก Quiz ที่จะนำเข้าก่อน');
    setSaving(true); setMsg('');
    try {
      const { data } = await api.post(`/practice/items/import-quiz/${imp.quizId}`, imp);
      setMsg(`✅ นำเข้า ${data.imported} ข้อ${data.skipped ? ` (ข้ามที่นำเข้าแล้ว ${data.skipped} ข้อ)` : ''}`);
      setImportOpen(false); load(); reloadMeta();
    } catch (e) {
      setMsg(`⚠️ ${e.response?.data?.message || 'นำเข้าไม่สำเร็จ'}`);
    } finally { setSaving(false); }
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /* ── ฟอร์มเพิ่ม/แก้ข้อสอบ ── */
  if (form) {
    const validChoices = form.choices.filter(c => c.trim());
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{form.id ? '✏️ แก้ไขข้อสอบ' : '➕ เพิ่มข้อสอบ'}</div>
            <button style={btn()} onClick={() => setForm(null)}>ยกเลิก</button>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.muted }}>วิชา *</span>
                <select style={input} value={form.subject_id} onChange={e => setF('subject_id', e.target.value)}>
                  <option value="">— เลือกวิชา —</option>
                  {meta.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.muted }}>หัวข้อ *</span>
                <input style={input} value={form.topic} onChange={e => setF('topic', e.target.value)}
                  list="topic-list" placeholder="เช่น เศษส่วน" />
                <datalist id="topic-list">
                  {[...new Set(meta.tree.map(t => t.topic))].map(t => <option key={t} value={t} />)}
                </datalist>
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.muted }}>หัวข้อย่อย * (หน่วยที่ใช้วัดผล)</span>
                <input style={input} value={form.sub_topic} onChange={e => setF('sub_topic', e.target.value)}
                  list="sub-list" placeholder="เช่น การบวกเศษส่วนต่างส่วน" />
                <datalist id="sub-list">
                  {[...new Set(meta.tree.map(t => t.subTopic))].map(t => <option key={t} value={t} />)}
                </datalist>
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ fontSize: 12, color: C.muted }}>ระดับการคิด (Bloom)</span>
                <select style={input} value={form.bloom} onChange={e => setF('bloom', e.target.value)}>
                  {BLOOM_ORDER.map(k => <option key={k} value={k}>{BLOOM[k].icon} {BLOOM[k].label}</option>)}
                </select>
              </label>
            </div>

            <label style={{ display: 'grid', gap: 5 }}>
              <span style={{ fontSize: 12, color: C.muted }}>คำถาม *</span>
              <textarea style={{ ...input, minHeight: 76, resize: 'vertical' }} value={form.question_text}
                onChange={e => setF('question_text', e.target.value)} />
            </label>

            <div style={{ display: 'grid', gap: 7 }}>
              <span style={{ fontSize: 12, color: C.muted }}>ตัวเลือก * (กดวงกลมเพื่อกำหนดข้อที่ถูก)</span>
              {form.choices.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => c.trim() && setF('correct_answer', c)}
                    style={{
                      width: 30, height: 30, borderRadius: 99, flexShrink: 0, cursor: 'pointer',
                      border: `2px solid ${form.correct_answer === c && c.trim() ? C.ok : C.border}`,
                      background: form.correct_answer === c && c.trim() ? C.ok : 'transparent',
                      color: '#052e16', fontWeight: 900, fontSize: 13,
                    }} title="กำหนดเป็นคำตอบที่ถูก">
                    {form.correct_answer === c && c.trim() ? '✓' : String.fromCharCode(65 + i)}
                  </button>
                  <input style={input} value={c} placeholder={`ตัวเลือกที่ ${i + 1}`}
                    onChange={e => {
                      const arr = [...form.choices];
                      const old = arr[i];
                      arr[i] = e.target.value;
                      setForm(f => ({
                        ...f, choices: arr,
                        correct_answer: f.correct_answer === old ? e.target.value : f.correct_answer,
                      }));
                    }} />
                  {form.choices.length > 2 && (
                    <button style={{ ...btn('danger'), padding: '6px 10px' }}
                      onClick={() => setF('choices', form.choices.filter((_, j) => j !== i))}>✕</button>
                  )}
                </div>
              ))}
              {form.choices.length < 6 && (
                <button style={{ ...btn(), justifySelf: 'start' }}
                  onClick={() => setF('choices', [...form.choices, ''])}>+ เพิ่มตัวเลือก</button>
              )}
            </div>

            <label style={{ display: 'grid', gap: 5 }}>
              <span style={{ fontSize: 12, color: C.muted }}>คำอธิบายเฉลย (แสดงหลังตอบ)</span>
              <textarea style={{ ...input, minHeight: 60, resize: 'vertical' }} value={form.explanation}
                onChange={e => setF('explanation', e.target.value)} />
            </label>

            <label style={{ display: 'grid', gap: 5 }}>
              <span style={{ fontSize: 12, color: C.muted }}>คำใบ้ (นักเรียนกดขอได้ — ระบบจะบันทึกว่าใช้คำใบ้)</span>
              <input style={input} value={form.hint} onChange={e => setF('hint', e.target.value)} />
            </label>

            {/* misconception ต่อตัวเลือกผิด */}
            {validChoices.filter(c => c !== form.correct_answer).length > 0 && (
              <div style={{ display: 'grid', gap: 7 }}>
                <span style={{ fontSize: 12, color: C.muted }}>
                  มโนทัศน์ที่คลาดเคลื่อนของแต่ละตัวเลือกผิด (ไม่บังคับ — ใช้เตือนครูและอธิบายให้นักเรียน)
                </span>
                {validChoices.filter(c => c !== form.correct_answer).map(c => (
                  <div key={c} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{
                      width: 110, fontSize: 11.5, color: C.bad, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={c}>{c}</div>
                    <input style={input} placeholder="เช่น บวกทั้งตัวเศษและตัวส่วน"
                      value={form.misconception?.[c] || ''}
                      onChange={e => setF('misconception', { ...form.misconception, [c]: e.target.value })} />
                  </div>
                ))}
              </div>
            )}

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} />
              เปิดใช้งาน (นำไปออกในชุดฝึก)
            </label>

            {msg && <div style={{ fontSize: 13, color: msg.startsWith('✅') ? C.ok : C.warn }}>{msg}</div>}
            <button style={{ ...btn('ok'), padding: '12px' }} onClick={save} disabled={saving}>
              {saving ? 'กำลังบันทึก…' : '💾 บันทึกข้อสอบ'}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  /* ── รายการคลังข้อสอบ ── */
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Card style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: 12 }}>
        <input style={{ ...input, width: 'auto', flex: '1 1 180px' }} placeholder="🔍 ค้นหาคำถาม / หัวข้อ"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...input, width: 'auto' }} value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
          <option value="">ทุกวิชา</option>
          {meta.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button style={btn('primary')} onClick={() => { setMsg(''); setForm(emptyForm()); }}>➕ เพิ่มข้อสอบ</button>
        <button style={btn()} onClick={openImport}>📥 นำเข้าจาก Quiz</button>
      </Card>

      {msg && <Card style={{ padding: 11, fontSize: 13, color: msg.startsWith('✅') ? C.ok : C.warn }}>{msg}</Card>}

      {importOpen && (
        <Card style={{ borderColor: `${C.accent}55` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>📥 นำเข้าข้อสอบจาก Quiz เดิม</div>
            <button style={btn()} onClick={() => setImportOpen(false)}>ปิด</button>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.7, marginBottom: 12 }}>
            ข้อสอบใน Quiz ไม่มีแท็บวิชา/หัวข้อ จึงต้องระบุตรงนี้ให้ทั้งชุด — นำเข้าแล้วมาแก้หัวข้อย่อยรายข้อทีหลังได้
            และผลการทำ Quiz ของนักเรียนจะถูกส่งเข้าระบบวิเคราะห์ให้อัตโนมัติ
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <select style={input} value={imp.quizId} onChange={e => setImp(v => ({ ...v, quizId: e.target.value }))}>
              <option value="">— เลือก Quiz —</option>
              {quizzes.map(q => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.total} ข้อ{q.imported ? ` · นำเข้าแล้ว ${q.imported}` : ''})
                </option>
              ))}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
              <select style={input} value={imp.subject_id} onChange={e => setImp(v => ({ ...v, subject_id: e.target.value }))}>
                <option value="">— วิชา —</option>
                {meta.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input style={input} placeholder="หัวข้อ" value={imp.topic}
                onChange={e => setImp(v => ({ ...v, topic: e.target.value }))} />
              <input style={input} placeholder="หัวข้อย่อย" value={imp.sub_topic}
                onChange={e => setImp(v => ({ ...v, sub_topic: e.target.value }))} />
              <select style={input} value={imp.bloom} onChange={e => setImp(v => ({ ...v, bloom: e.target.value }))}>
                {BLOOM_ORDER.map(k => <option key={k} value={k}>{BLOOM[k].icon} {BLOOM[k].label}</option>)}
              </select>
            </div>
            <button style={btn('ok')} onClick={doImport} disabled={saving}>
              {saving ? 'กำลังนำเข้า…' : 'นำเข้า'}
            </button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card style={{ textAlign: 'center', color: C.muted, padding: 30 }}>กำลังโหลด…</Card>
      ) : !items.length ? (
        <Empty icon="🗂️" title="คลังข้อสอบยังว่าง"
          hint={'กด "เพิ่มข้อสอบ" เพื่อกรอกเอง หรือ "นำเข้าจาก Quiz" เพื่อดึงข้อสอบที่มีอยู่แล้วมาติดแท็กวิชา/หัวข้อ'} />
      ) : (
        <Card>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>ทั้งหมด {items.length} ข้อ</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {items.map(it => (
              <div key={it.id} style={{
                background: C.card2, borderRadius: 10, padding: 11,
                opacity: it.is_active ? 1 : 0.5,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, flex: '1 1 220px' }}>{it.question_text}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ ...btn(), padding: '5px 10px' }}
                      onClick={() => {
                        setMsg('');
                        setForm({
                          ...it,
                          subject_id: String(it.subject_id),
                          choices: Array.isArray(it.choices) ? it.choices.map(String) : ['', ''],
                          explanation: it.explanation || '', hint: it.hint || '',
                          misconception: it.misconception || {},
                        });
                      }}>✏️</button>
                    <button style={{ ...btn('danger'), padding: '5px 10px' }} onClick={() => remove(it)}>🗑</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <Pill>{it.subject?.name}</Pill>
                  <Pill>{it.topic} › {it.sub_topic}</Pill>
                  {BLOOM[it.bloom] && (
                    <Pill color={BLOOM[it.bloom].color} bg={`${BLOOM[it.bloom].color}22`}>
                      {BLOOM[it.bloom].icon} {BLOOM[it.bloom].label}
                    </Pill>
                  )}
                  <Pill color={C.accent}>Elo {it.elo}</Pill>
                  {it.times_shown > 0 && <Pill color={clr(it.accuracy)}>ตอบถูก {it.accuracy}% ({it.times_shown} ครั้ง)</Pill>}
                  {it.linkedToQuiz && <Pill color={C.accent2} bg="rgba(167,139,250,0.15)">🔗 จาก Quiz</Pill>}
                  {!it.is_active && <Pill color={C.muted}>ปิดใช้งาน</Pill>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

/* ═════════════════════ หน้าหลัก ═════════════════════ */

export default function Practice() {
  const { user } = useContext(AuthContext);
  const teacher = isTeacher(user?.role);

  const [tab, setTab] = useState('practice');
  const [meta, setMeta] = useState(null);
  const [viewStudent, setViewStudent] = useState(null);   // { id, name } — ครูดูรายบุคคล
  const [refresh, setRefresh] = useState(0);

  const loadMeta = useCallback(async () => {
    try { const { data } = await api.get('/practice/meta'); setMeta(data); }
    catch { setMeta({ subjects: [], tree: [] }); }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  const TABS = [
    { id: 'practice', icon: '🎯', label: 'ฝึกวันนี้' },
    { id: 'me',       icon: '📊', label: 'ความรู้ของฉัน' },
    ...(teacher ? [
      { id: 'class', icon: '👩‍🏫', label: 'ภาพรวมห้อง' },
      { id: 'bank',  icon: '🗂️', label: 'คลังข้อสอบ' },
    ] : []),
  ];

  if (!meta) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'grid', placeItems: 'center' }}>
        <div style={{ color: C.muted }}>กำลังโหลด…</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text, padding: '18px 16px 60px',
      fontFamily: '"Sarabun", system-ui, sans-serif',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'grid', gap: 16 }}>
        {/* หัวเรื่อง */}
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>🧪 วิเคราะห์การเรียนรู้</h1>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 5, lineHeight: 1.7 }}>
            ฝึกทำโจทย์แต่ละหัวข้อบ่อยๆ ระบบจะเก็บสถิติรายข้อ วัดระดับความเข้าใจ
            และกำหนดวันทบทวนให้ตามเส้นโค้งการลืม
          </div>
        </div>

        {/* แท็บ */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== 'me') setViewStudent(null); }}
              style={{
                ...btn(tab === t.id ? 'primary' : 'ghost'),
                padding: '9px 15px', fontSize: 13.5,
              }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {tab === 'practice' && (
          <TabPractice key={refresh} meta={meta} onFinished={() => setRefresh(n => n + 1)} />
        )}
        {tab === 'me' && (
          <>
            {viewStudent && (
              <button style={btn()} onClick={() => setViewStudent(null)}>← กลับมาดูของตัวเอง</button>
            )}
            <TabMyKnowledge
              key={`${viewStudent?.id || 'me'}-${refresh}`}
              viewUserId={viewStudent?.id}
              viewName={viewStudent?.name}
            />
          </>
        )}
        {tab === 'class' && teacher && (
          <TabClass meta={meta}
            onViewStudent={(id, name) => { setViewStudent({ id, name }); setTab('me'); }} />
        )}
        {tab === 'bank' && teacher && <TabBank meta={meta} reloadMeta={loadMeta} />}
      </div>
    </div>
  );
}
