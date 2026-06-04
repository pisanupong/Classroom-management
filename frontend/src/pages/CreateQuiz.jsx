import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const emptyQ = () => ({ question_text:'', choices:['','','',''], correct_answer:'' });

/* ════════════════════════════════════════════════
   XML TEMPLATE — ใช้ส่งให้ AI สร้างแบบฝึกหัด
════════════════════════════════════════════════ */
const XML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  ════════════════════════════════════════════════
  📋 XML TEMPLATE สำหรับสร้างแบบฝึกหัด
  ────────────────────────────────────────────────
  คัดลอก Prompt นี้ไปให้ AI (ChatGPT / Claude / Gemini):

  "สร้างแบบฝึกหัดปรนัย [วิชา] เรื่อง [หัวข้อ]
  จำนวน [N] ข้อ ระดับ [ง่าย/ปานกลาง/ยาก]
  ตอบในรูปแบบ XML ตามโครงสร้างนี้เท่านั้น:
  [วาง XML Template ด้านล่างนี้]"
  ════════════════════════════════════════════════
-->
<quiz>
  <meta>
    <title>ชื่อแบบฝึกหัด</title>
    <description>คำอธิบายเพิ่มเติม (ถ้ามี)</description>
    <time_limit>600</time_limit>       <!-- หน่วย: วินาที / 0 = ไม่จำกัด -->
    <max_attempts>1</max_attempts>     <!-- 0 = ไม่จำกัดจำนวนครั้ง -->
    <points_per_q>10</points_per_q>    <!-- คะแนนต่อ 1 ข้อ -->
  </meta>

  <questions>

    <question>
      <text>คำถามข้อที่ 1 เขียนที่นี่</text>
      <choices>
        <choice correct="true">ตัวเลือกที่ถูกต้อง</choice>
        <choice>ตัวเลือกที่ผิด 1</choice>
        <choice>ตัวเลือกที่ผิด 2</choice>
        <choice>ตัวเลือกที่ผิด 3</choice>
      </choices>
    </question>

    <question>
      <text>คำถามข้อที่ 2 เขียนที่นี่</text>
      <choices>
        <choice>ตัวเลือกที่ผิด 1</choice>
        <choice correct="true">ตัวเลือกที่ถูกต้อง</choice>
        <choice>ตัวเลือกที่ผิด 2</choice>
        <choice>ตัวเลือกที่ผิด 3</choice>
      </choices>
    </question>

  </questions>
</quiz>

<!--
  📌 กฎสำคัญสำหรับ AI:
  1. ต้องมี correct="true" ใน <choice> ที่ถูกต้อง 1 ข้อเท่านั้น
  2. แต่ละ <question> ต้องมี <choice> อย่างน้อย 2 ตัวเลือก (แนะนำ 4)
  3. ห้ามเพิ่ม attribute หรือ tag ที่ไม่อยู่ใน template นี้
  4. ตอบเป็น XML เท่านั้น ไม่ต้องมีคำอธิบายเพิ่มเติม
-->`;

/* ════════════════════════════════════════════════
   XML PARSER — แปลง XML string → quiz data
   รองรับทั้ง full XML และ fragment <question> blocks
════════════════════════════════════════════════ */
function autoFixXML(raw) {
  let s = raw.trim();

  // ถ้าเป็นแค่ fragment <question>...</question> ให้ wrap ให้
  if (!s.includes('<quiz') && s.includes('<question')) {
    // ถ้าไม่มี <questions> wrapper
    const inner = s.includes('<questions>') ? s : `<questions>${s}</questions>`;
    s = `<?xml version="1.0" encoding="UTF-8"?><quiz><meta><title>แบบฝึกหัด</title></meta>${inner}</quiz>`;
  }

  // ถ้าไม่มี xml declaration ให้เพิ่ม
  if (!s.startsWith('<?xml')) {
    s = `<?xml version="1.0" encoding="UTF-8"?>${s}`;
  }

  return s;
}

function parseQuizXML(xmlStr) {
  const fixed = autoFixXML(xmlStr);
  const errors = [];
  let doc;

  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(fixed, 'text/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      // พยายามดึงบรรทัดที่มีปัญหา
      const errText = parseError.textContent || '';
      const lineMatch = errText.match(/line (\d+)/i);
      const colMatch  = errText.match(/column (\d+)/i);
      const lineInfo  = lineMatch ? ` (บรรทัด ${lineMatch[1]}${colMatch ? ` คอลัมน์ ${colMatch[1]}` : ''})` : '';
      // หา tag ที่น่าจะมีปัญหา
      const tagMatch = errText.match(/<\/?(\w+)/);
      const tagInfo  = tagMatch ? ` — tag ที่น่าจะผิด: <${tagMatch[1]}>` : '';
      throw new Error(`XML syntax ผิดพลาด${lineInfo}${tagInfo}\n\nวิธีแก้: ตรวจสอบว่า tag เปิด-ปิดครบ เช่น </question> ไม่ใช่ </choices>`);
    }
  } catch (e) {
    throw new Error(e.message);
  }

  const getText = (el, tag) => el.querySelector(tag)?.textContent?.trim() || '';

  // Meta (optional ถ้า AI ส่งแค่ questions)
  const meta = doc.querySelector('meta');
  const result = {
    title:        meta ? (getText(meta, 'title') || 'แบบฝึกหัด') : 'แบบฝึกหัด',
    description:  meta ? getText(meta, 'description') : '',
    time_limit:   meta ? (parseInt(getText(meta, 'time_limit'))   || 600) : 600,
    max_attempts: meta ? (parseInt(getText(meta, 'max_attempts'))  || 1)   : 1,
    points_per_q: meta ? (parseInt(getText(meta, 'points_per_q')) || 10)  : 10,
    questions: [],
  };

  // Questions
  const qEls = doc.querySelectorAll('question');
  if (!qEls.length) throw new Error('ไม่พบ <question> ใน XML — ตรวจสอบว่า AI ใส่ tag <question> ครบ');

  qEls.forEach((qEl, i) => {
    const text = getText(qEl, 'text');
    if (!text) { errors.push(`ข้อ ${i+1}: ไม่มีเนื้อหาคำถาม (<text>)`); return; }

    const choiceEls = qEl.querySelectorAll('choice');
    if (choiceEls.length < 2) { errors.push(`ข้อ ${i+1}: ต้องมีตัวเลือกอย่างน้อย 2 ข้อ`); return; }

    const choices = [];
    let correct_answer = '';
    let correctCount = 0;

    choiceEls.forEach(cEl => {
      const val = cEl.textContent?.trim();
      if (!val) return;
      choices.push(val);
      if (cEl.getAttribute('correct') === 'true') {
        correct_answer = val;
        correctCount++;
      }
    });

    if (correctCount === 0) { errors.push(`ข้อ ${i+1}: ไม่มีตัวเลือกถูกต้อง — ใส่ correct="true" ใน <choice>`); return; }
    if (correctCount > 1)   { errors.push(`ข้อ ${i+1}: มี correct="true" มากกว่า 1 ตัวเลือก`); return; }

    result.questions.push({ question_text: text, choices, correct_answer });
  });

  if (errors.length) throw new Error('พบปัญหาในบางข้อ:\n' + errors.join('\n'));
  return result;
}

/* ════════════════════════════════════════════════
   AI IMPORT PANEL COMPONENT
════════════════════════════════════════════════ */
const AIImportPanel = ({ onImport, onClose }) => {
  const [xmlInput, setXmlInput]     = useState('');
  const [preview, setPreview]       = useState(null);
  const [parseError, setParseError] = useState('');
  const [copied, setCopied]         = useState(false);
  const [tab, setTab]               = useState('paste'); // 'template' | 'paste'

  const handleParse = () => {
    setParseError('');
    setPreview(null);
    try {
      const data = parseQuizXML(xmlInput);
      setPreview(data);
    } catch (e) {
      setParseError(e.message);
    }
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(XML_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)' }}>
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 overflow-hidden"
        style={{ background:'#0f0c29' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10"
          style={{ background:'rgba(124,58,237,0.15)' }}>
          <div>
            <h2 className="text-lg font-bold text-white">🤖 นำเข้าแบบฝึกหัดจาก AI</h2>
            <p className="text-xs text-white/40 mt-0.5">คัดลอก template ไปให้ AI สร้าง แล้ววาง XML ที่ได้กลับมา</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-xl">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[['template','📋 Template สำหรับ AI'],['paste','📥 วาง XML']].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                tab===v ? 'text-purple-300 border-purple-400 bg-white/5' : 'text-white/40 border-transparent hover:text-white'
              }`}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {tab === 'template' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/60">คัดลอก XML Template นี้ แล้วส่งให้ AI พร้อมคำสั่งของคุณ</p>
                <button onClick={handleCopyTemplate}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    copied ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-white border border-purple-500/40 hover:bg-purple-500/20'
                  }`}>
                  {copied ? '✅ คัดลอกแล้ว!' : '📋 คัดลอก Template'}
                </button>
              </div>

              {/* Prompt example */}
              <div className="rounded-xl p-4 border border-blue-500/20" style={{background:'rgba(59,130,246,0.08)'}}>
                <p className="text-xs text-blue-300 font-semibold mb-2">💡 ตัวอย่าง Prompt ที่ใช้กับ AI:</p>
                <p className="text-xs text-white/60 leading-relaxed font-mono">
                  "สร้างแบบฝึกหัดวิชาคณิตศาสตร์ เรื่องสมการเชิงเส้น จำนวน 10 ข้อ ระดับมัธยมต้น
                  ตอบในรูปแบบ XML ตาม template นี้เท่านั้น ห้ามเพิ่มคำอธิบายอื่น: [วาง template]"
                </p>
              </div>

              <pre className="text-xs text-green-300/80 font-mono leading-relaxed overflow-auto rounded-xl p-4 border border-white/5 select-all"
                style={{background:'rgba(0,0,0,0.4)', maxHeight:380, whiteSpace:'pre-wrap'}}>
                {XML_TEMPLATE}
              </pre>
            </>
          )}

          {tab === 'paste' && (
            <>
              <div>
                <label className="text-xs text-white/50 block mb-2">วาง XML ที่ได้จาก AI ที่นี่</label>
                <textarea
                  value={xmlInput} onChange={e=>setXmlInput(e.target.value)}
                  placeholder={'<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n  ...\n</quiz>'}
                  rows={10}
                  className="w-full px-4 py-3 rounded-xl text-xs font-mono text-green-300 placeholder-white/15 focus:outline-none focus:border-purple-400 resize-none border border-white/10"
                  style={{background:'rgba(0,0,0,0.4)', lineHeight:1.7}}
                />
              </div>

              {parseError && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono whitespace-pre-wrap">
                  ❌ {parseError}
                </div>
              )}

              <button onClick={handleParse} disabled={!xmlInput.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-30 transition-all hover:opacity-90"
                style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)'}}>
                🔍 ตรวจสอบและ Preview
              </button>

              {/* Preview */}
              {preview && (
                <div className="rounded-xl border border-emerald-500/20 overflow-hidden"
                  style={{background:'rgba(16,185,129,0.05)'}}>
                  <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-emerald-300">✅ อ่าน XML สำเร็จ</p>
                      <p className="text-xs text-white/40 mt-0.5">{preview.questions.length} ข้อ · {preview.points_per_q} แต้ม/ข้อ · {preview.time_limit}s</p>
                    </div>
                    <button onClick={() => onImport(preview)}
                      className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                      style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>
                      ✨ นำเข้าเลย ({preview.questions.length} ข้อ)
                    </button>
                  </div>

                  {/* Meta preview */}
                  <div className="px-5 py-3 border-b border-white/5">
                    <p className="text-base font-bold text-white">{preview.title}</p>
                    {preview.description && <p className="text-xs text-white/40 mt-0.5">{preview.description}</p>}
                  </div>

                  {/* Questions preview */}
                  <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
                    {preview.questions.map((q, i) => (
                      <div key={i} className="px-5 py-3">
                        <p className="text-xs text-white/70 mb-2">
                          <span className="text-white/30">ข้อ {i+1}: </span>{q.question_text}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {q.choices.map((c, ci) => (
                            <span key={ci} className={`text-xs px-2 py-0.5 rounded-full border ${
                              c === q.correct_answer
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-white/5 text-white/30 border-white/10'
                            }`}>
                              {c === q.correct_answer && '✓ '}{c}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const CreateQuiz = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [meta, setMeta] = useState({ title:'', description:'', time_limit:600, max_attempts:1, points_per_q:10 });
  const [questions, setQuestions] = useState([emptyQ()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAIPanel, setShowAIPanel] = useState(false);

  if (!['TEACHER','ADMIN','SUPER_USER'].includes(user?.role)) {
    navigate('/quiz'); return null;
  }

  const handleAIImport = (data) => {
    setMeta({
      title:        data.title,
      description:  data.description,
      time_limit:   data.time_limit,
      max_attempts: data.max_attempts,
      points_per_q: data.points_per_q,
    });
    setQuestions(data.questions.map(q => ({
      question_text: q.question_text,
      choices:       q.choices,
      correct_answer: q.correct_answer,
    })));
    setShowAIPanel(false);
    setError('');
  };

  const setQ = (i, key, val) => setQuestions(qs => qs.map((q,j) => j === i ? { ...q, [key]: val } : q));
  const setChoice = (i, ci, val) => setQuestions(qs => qs.map((q,j) => j === i ? { ...q, choices: q.choices.map((c,k) => k === ci ? val : c) } : q));
  const addChoice = (i) => setQuestions(qs => qs.map((q,j) => j === i && q.choices.length < 6 ? { ...q, choices: [...q.choices, ''] } : q));
  const removeChoice = (i, ci) => setQuestions(qs => qs.map((q,j) => j === i && q.choices.length > 2 ? { ...q, choices: q.choices.filter((_,k)=>k!==ci), correct_answer: q.choices[ci]===q.correct_answer?'':q.correct_answer } : q));
  const addQ = () => setQuestions(qs => [...qs, emptyQ()]);
  const removeQ = (i) => questions.length > 1 && setQuestions(qs => qs.filter((_,j)=>j!==i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // Validate
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) { setError(`ข้อ ${i+1}: กรุณาใส่คำถาม`); return; }
      const choices = q.choices.filter(c => c.trim());
      if (choices.length < 2) { setError(`ข้อ ${i+1}: ต้องมีตัวเลือกอย่างน้อย 2 ตัว`); return; }
      if (!q.correct_answer) { setError(`ข้อ ${i+1}: กรุณาเลือกคำตอบที่ถูกต้อง`); return; }
    }
    setSaving(true);
    try {
      const payload = {
        ...meta,
        questions: questions.map(q => ({ ...q, choices: q.choices.filter(c => c.trim()) })),
      };
      await api.post('/quiz', payload);
      navigate('/quiz');
    } catch (err) {
      setError(err.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <div className="fixed top-0 right-0 w-80 h-80 rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(80px)' }} />
      <nav className="px-6 py-4 flex items-center gap-3 border-b border-white/10 sticky top-0 z-20" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
        <button onClick={() => navigate('/quiz')} className="text-white/60 hover:text-white text-sm">← กลับ</button>
        <span className="text-white/30">|</span>
        <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">✏️ สร้างแบบฝึกหัด</h1>
        <button onClick={() => setShowAIPanel(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white border border-purple-500/40 hover:bg-purple-500/20 transition-all">
          🤖 นำเข้าจาก AI
        </button>
      </nav>

      {showAIPanel && <AIImportPanel onImport={handleAIImport} onClose={() => setShowAIPanel(false)} />}

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {error && <div className="p-3 rounded-xl text-sm text-red-300 bg-red-500/10 border border-red-500/30">{error}</div>}

        {/* Quiz metadata */}
        <div className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
          <h2 className="font-semibold text-white mb-4">ข้อมูลแบบฝึกหัด</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">ชื่อแบบฝึกหัด *</label>
              <input value={meta.title} onChange={e => setMeta({...meta, title:e.target.value})} required
                placeholder="เช่น คณิตศาสตร์บทที่ 3"
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">คำอธิบาย</label>
              <textarea value={meta.description} onChange={e => setMeta({...meta, description:e.target.value})} rows={2}
                placeholder="รายละเอียดเพิ่มเติม..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400 resize-none" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">⏱ เวลา (วินาที)</label>
                <input type="number" value={meta.time_limit} onChange={e => setMeta({...meta, time_limit:parseInt(e.target.value)||0})} min="0"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400" />
                <p className="text-xs text-white/20 mt-1">0 = ไม่จำกัด</p>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">🔁 จำนวนครั้ง</label>
                <input type="number" value={meta.max_attempts} onChange={e => setMeta({...meta, max_attempts:parseInt(e.target.value)||0})} min="0"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400" />
                <p className="text-xs text-white/20 mt-1">0 = ไม่จำกัด</p>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">🏆 แต้ม/ข้อ</label>
                <input type="number" value={meta.points_per_q} onChange={e => setMeta({...meta, points_per_q:parseInt(e.target.value)||1})} min="1"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-white">ข้อที่ {i + 1}</span>
                {questions.length > 1 && (
                  <button type="button" onClick={() => removeQ(i)} className="text-red-400/50 hover:text-red-400 text-xs transition-colors">ลบข้อนี้</button>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-xs text-white/50 mb-1.5">คำถาม *</label>
                <textarea value={q.question_text} onChange={e => setQ(i,'question_text',e.target.value)} rows={2} required
                  placeholder="พิมพ์คำถามที่นี่..."
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400 resize-none" />
              </div>

              <label className="block text-xs text-white/50 mb-2">ตัวเลือก (เลือกข้อที่ถูกต้อง 1 ข้อ) *</label>
              <div className="space-y-2 mb-3">
                {q.choices.map((c, ci) => {
                  const letter = ['A','B','C','D','E','F'][ci];
                  const isCorrect = q.correct_answer === c && c.trim() !== '';
                  return (
                    <div key={ci} className="flex items-center gap-2">
                      <button type="button" onClick={() => c.trim() && setQ(i,'correct_answer',c)}
                        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border-2 transition-all"
                        style={{
                          background: isCorrect ? '#10b981' : 'transparent',
                          borderColor: isCorrect ? '#10b981' : 'rgba(255,255,255,0.2)',
                          color: isCorrect ? '#fff' : 'rgba(255,255,255,0.4)',
                        }}>
                        {isCorrect ? '✓' : letter}
                      </button>
                      <input value={c} onChange={e => setChoice(i,ci,e.target.value)}
                        placeholder={`ตัวเลือก ${letter}`}
                        className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400"
                        style={isCorrect ? { borderColor: '#10b981', background: 'rgba(16,185,129,0.1)' } : {}} />
                      {q.choices.length > 2 && (
                        <button type="button" onClick={() => removeChoice(i,ci)} className="text-white/20 hover:text-red-400 transition-colors text-sm px-1">✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
              {q.choices.length < 6 && (
                <button type="button" onClick={() => addChoice(i)}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                  + เพิ่มตัวเลือก
                </button>
              )}
              {!q.correct_answer && <p className="text-xs text-yellow-400/60 mt-2">⚠️ กรุณาคลิกวงกลมหน้าตัวเลือกที่ถูกต้อง</p>}
            </div>
          ))}
        </div>

        <button type="button" onClick={addQ}
          className="w-full py-3 rounded-2xl border border-dashed border-white/20 text-white/40 hover:text-white/70 hover:border-white/30 text-sm transition-all">
          + เพิ่มคำถาม ({questions.length} ข้อ)
        </button>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/quiz')} className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">ยกเลิก</button>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 rounded-xl font-semibold text-white text-sm disabled:opacity-50 hover:scale-[1.02] transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}>
            {saving ? 'กำลังสร้าง...' : `✨ สร้างแบบฝึกหัด (${questions.length} ข้อ)`}
          </button>
        </div>
      </form>
    </div>
  );
};
export default CreateQuiz;
