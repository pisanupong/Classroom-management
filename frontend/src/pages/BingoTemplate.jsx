import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const QRCODE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
const BINGO_COL = ['B', 'I', 'N', 'G', 'O'];
const COL_COLOR = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const PATTERN_OPTS = [
  { value: 'line', label: '📏 เส้นตรง' },
  { value: 'full', label: '🟩 เต็มบอร์ด' },
  { value: 'corners', label: '🔲 4 มุม' },
  { value: 'T', label: '🔠 ตัว T' },
  { value: 'L', label: '🔡 ตัว L' },
];
const fmt = n => Number(n).toLocaleString('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 });

function genRows() {
  const ranges = [[1,15],[16,30],[31,45],[46,60],[61,75]];
  const cols = ranges.map(([lo,hi]) => {
    const pool = Array.from({ length: hi-lo+1 }, (_,i) => i+lo);
    for (let i = pool.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [pool[i],pool[j]] = [pool[j],pool[i]];
    }
    return pool.slice(0,5);
  });
  cols[2][2] = 0;
  return Array.from({ length:5 }, (_,r) => Array.from({ length:5 }, (_,c) => cols[c][r]));
}

/* ─── Input helper ─────────────────────────────── */
const Field = ({ label, children }) => (
  <div style={{ marginBottom: '12px' }}>
    <label style={{ display:'block', fontSize:'10px', color:'rgba(255,255,255,0.4)', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
      {label}
    </label>
    {children}
  </div>
);

const TextInput = ({ value, onChange, placeholder, type='text', min, max, step }) => (
  <input
    type={type} value={value} onChange={onChange} placeholder={placeholder}
    min={min} max={max} step={step}
    style={{
      width:'100%', padding:'8px 12px', borderRadius:'10px',
      background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
      color:'#fff', fontSize:'13px', fontWeight:700,
    }}
  />
);

const Slider = ({ label, value, onChange, min, max, step=1, unit='' }) => (
  <Field label={`${label}: ${value}${unit}`}>
    <input type="range" min={min} max={max} step={step} value={value} onChange={onChange}
      style={{ width:'100%', accentColor:'#7c3aed' }} />
  </Field>
);

/* ─── Main component ──────────────────────────── */
const TEMPLATE_PASSWORD = 'Pbc2026';

export default function BingoTemplate() {
  const navigate = useNavigate();

  const [authed,  setAuthed]  = useState(() => sessionStorage.getItem('tpl_auth') === '1');
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);

  const handleLogin = () => {
    if (pwInput === TEMPLATE_PASSWORD) {
      sessionStorage.setItem('tpl_auth', '1');
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  };

  const [tab, setTab] = useState('paper');

  /* ── Data fields ── */
  const [alias,       setAlias]       = useState('TEMPLATE');
  const [seq,         setSeq]         = useState('999');
  const [roomName,    setRoomName]    = useState('ห้อง Bingo');
  const [totalRounds, setTotalRounds] = useState('5');
  const [roundNum,    setRoundNum]    = useState('1');
  const [pattern,     setPattern]     = useState('line');
  const [prize,       setPrize]       = useState('รางวัลพิเศษ');
  const [price,       setPrice]       = useState('40');
  const [isGolden,    setIsGolden]    = useState(false);

  /* ── Layout (paper) ── */
  const [tdHeight,      setTdHeight]      = useState(15); // mm
  const [numFontSize,   setNumFontSize]   = useState(16); // pt
  const [aliasFontSize, setAliasFontSize] = useState(13); // pt
  const [thFontSize,    setThFontSize]    = useState(12); // pt
  const [qrSizeMm,      setQrSizeMm]     = useState(20); // mm

  /* ── Card numbers ── */
  const [rows, setRows] = useState(() => genRows());

  if (!authed) {
    return (
      <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a', fontFamily:"'Segoe UI',sans-serif" }}>
        <div style={{ width:'320px', padding:'32px', background:'rgba(255,255,255,0.05)', borderRadius:'20px', border:'1px solid rgba(255,255,255,0.1)', textAlign:'center' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>🖨️</div>
          <h2 style={{ color:'#fff', margin:'0 0 6px', fontSize:'20px', fontWeight:900 }}>Template พิมพ์ตั๋ว</h2>
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'13px', margin:'0 0 24px' }}>กรอกรหัสผ่านเพื่อเข้าใช้งาน</p>
          <input
            type="password"
            value={pwInput}
            onChange={e => { setPwInput(e.target.value); setPwError(false); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="รหัสผ่าน"
            autoFocus
            style={{
              width:'100%', padding:'12px 16px', borderRadius:'12px', marginBottom:'12px',
              background:'rgba(255,255,255,0.08)', border:`2px solid ${pwError ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
              color:'#fff', fontSize:'16px', fontWeight:700, textAlign:'center', outline:'none',
            }}
          />
          {pwError && <p style={{ color:'#ef4444', fontSize:'12px', margin:'0 0 8px' }}>รหัสผ่านไม่ถูกต้อง</p>}
          <button
            onClick={handleLogin}
            style={{
              width:'100%', padding:'12px', borderRadius:'12px', fontSize:'14px', fontWeight:900,
              border:'none', cursor:'pointer', background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff',
            }}>
            เข้าใช้งาน
          </button>
          <button onClick={() => navigate('/bingo')} style={{ marginTop:'12px', background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:'12px', cursor:'pointer' }}>
            ← กลับ
          </button>
        </div>
      </div>
    );
  }

  /* ─── Print: Paper 90×150mm ─────────────────── */
  const doPrintPaper = () => {
    const patternLabel = PATTERN_OPTS.find(p => p.value === pattern)?.label || pattern;
    const prizeHtml = prize ? `<span class="badge prize">🎁 ${prize}</span>` : '';
    const priceHtml = Number(price) > 0 ? `<span class="badge price">${fmt(Number(price))}</span>` : '';
    const mockQrUrl = `${window.location.origin}/bingo`;
    const safeUrl = mockQrUrl.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const colHeaders = BINGO_COL.map((c,i) => `<th style="background:${COL_COLOR[i]}">${c}</th>`).join('');
    const gridRows = rows.map(row =>
      `<tr>${row.map(n => n === 0 ? '<td class="free">FREE</td>' : `<td>${n}</td>`).join('')}</tr>`
    ).join('');
    const seqVal = parseInt(seq,10) || 999;
    const qrPx = Math.round(qrSizeMm * 3.78);

    const win = window.open('','_blank','width=360,height=660');
    win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Bingo Card #${seqVal} — ${alias}</title>
<script src="${QRCODE_CDN}"><\/script>
<style>
  @page { size: 90mm 150mm; margin: 6mm; }
  @media print { .no-print{display:none!important;} html,body{width:100%;margin:0;padding:0;background:#fff;} .card{width:100%;box-shadow:none;} }
  @media screen { html{background:#94a3b8;padding:8px;} .card{box-shadow:0 4px 24px rgba(0,0,0,0.35);} .btn-wrap{padding:6px 0 2px;text-align:center;} }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body{font-family:'Segoe UI',Tahoma,sans-serif;color:#1e293b;background:#fff;}
  .card{width:78mm;background:#fff;}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2pt solid #7c3aed;padding-bottom:2mm;margin-bottom:2mm;}
  .top-left{flex:1;min-width:0;overflow:hidden;}
  .brand{font-size:10pt;font-weight:900;color:#7c3aed;letter-spacing:1px;}
  .room-name{font-size:6pt;color:#475569;margin-top:0.5mm;}
  .badges{display:flex;flex-wrap:wrap;gap:1mm;margin-top:1.5mm;}
  .badge{font-size:6pt;font-weight:700;padding:0.5mm 2mm;border-radius:1.5mm;white-space:nowrap;max-width:44mm;overflow:hidden;text-overflow:ellipsis;}
  .badge.round{background:#ede9fe;color:#7c3aed;}
  .badge.prize{background:#fef3c7;color:#d97706;}
  .badge.price{background:#ecfdf5;color:#059669;}
  .top-right{display:flex;flex-direction:column;align-items:flex-end;gap:1mm;flex-shrink:0;margin-left:2mm;}
  .seq{font-size:24pt;font-weight:900;color:#1e1b4b;line-height:1;}
  .seq-label{font-size:5.5pt;color:#94a3b8;text-align:right;}
  #qr img,#qr canvas{width:${qrSizeMm}mm!important;height:${qrSizeMm}mm!important;display:block;}
  .alias{font-size:${aliasFontSize}pt;font-weight:900;color:#1e1b4b;text-align:center;margin:1.5mm 0;letter-spacing:1px;}
  table{border-collapse:collapse;width:100%;table-layout:fixed;}
  th,td{border:1.5pt solid #333;text-align:center;padding:0;}
  th{padding:2mm 0;font-size:${thFontSize}pt;font-weight:900;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  td{height:${tdHeight}mm;font-size:${numFontSize}pt;font-weight:800;color:#1e1b4b;}
  .free{background:#fef3c7;color:#d97706;font-size:8pt;font-weight:900;}
  .footer{display:flex;justify-content:space-between;align-items:center;margin-top:2mm;border-top:1px solid #e2e8f0;padding-top:1mm;}
  .footer-url{font-size:4.5pt;color:#94a3b8;word-break:break-all;flex:1;margin-right:2mm;}
  .footer-note{font-size:5pt;color:#475569;text-align:right;flex-shrink:0;}
  .btn{display:block;width:78mm;padding:8px;background:#7c3aed;color:#fff;border:none;border-radius:6px;font-size:12pt;font-weight:700;cursor:pointer;}
</style></head><body>
<div class="card">
  <div class="top">
    <div class="top-left">
      <div class="brand">🎱 BINGO CARD</div>
      <div class="room-name">${roomName}</div>
      <div class="badges">
        <span class="badge round">รอบ ${roundNum} · ${patternLabel}</span>
        ${prizeHtml}${priceHtml}
      </div>
    </div>
    <div class="top-right">
      <div class="seq">#${String(seqVal).padStart(3,'0')}</div>
      <div class="seq-label">ใบที่</div>
      <div id="qr"></div>
    </div>
  </div>
  <div class="alias">${alias}</div>
  <table>
    <thead><tr>${colHeaders}</tr></thead>
    <tbody>${gridRows}</tbody>
  </table>
  <div class="footer">
    <div class="footer-url">${mockQrUrl}</div>
    <div class="footer-note">📱 สแกน QR ติดตามบนมือถือ</div>
  </div>
</div>
<div class="btn-wrap no-print">
  <button class="btn" onclick="window.print()">🖨️ พิมพ์บัตร (90×150mm)</button>
</div>
<script>
(function(){
  try {
    new QRCode(document.getElementById('qr'),{
      text:'${safeUrl}',
      width:${qrPx},height:${qrPx},
      colorDark:'#000000',colorLight:'#ffffff',
      correctLevel:QRCode.CorrectLevel.M
    });
  } catch(e) {
    document.getElementById('qr').innerHTML='<div style="border:1px dashed #ccc;padding:3mm;font-size:5pt;color:#aaa;text-align:center">QR</div>';
  }
})();
<\/script>
</body></html>`);
    win.document.close();
  };

  /* ─── Print: Mobile 80mm ────────────────────── */
  const doPrintMobile = () => {
    const patternLabel = PATTERN_OPTS.find(p => p.value === pattern)?.label || pattern;
    const priceHtml = Number(price) > 0 ? `<div class="price">${fmt(Number(price))}</div>` : '';
    const prizeHtml = prize ? `<div class="prize-badge">🎁 ${prize}</div>` : '';
    const goldenHtml = isGolden
      ? `<div class="row"><span class="row-key">⚡ โกลเด้น รอบ</span><span class="row-val">✓</span></div>` : '';
    const mockQrUrl = `${window.location.origin}/bingo`;
    const safeUrl = mockQrUrl.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const seqVal = parseInt(seq,10) || 999;

    const win = window.open('','_blank','width=360,height=700');
    win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>ตั๋ว Bingo #${seqVal} — ${alias}</title>
<script src="${QRCODE_CDN}"><\/script>
<style>
  @page{size:80mm auto;margin:3mm;}
  @media print{.no-print{display:none!important;}}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Courier New',monospace;width:74mm;background:#fff;color:#1e293b;}
  .brand{text-align:center;padding:4mm 0 3mm;border-bottom:2px solid #1e293b;}
  .brand-name{font-size:20pt;font-weight:900;letter-spacing:3px;color:#7c3aed;}
  .room-name{font-size:8pt;color:#475569;margin-top:1mm;}
  .info{padding:3mm 0;border-bottom:1px dashed #94a3b8;}
  .row{display:flex;justify-content:space-between;font-size:8pt;padding:0.8mm 0;}
  .row-key{color:#64748b;}
  .row-val{font-weight:700;}
  .prize-badge{background:#fef3c7;color:#d97706;font-size:8pt;font-weight:700;text-align:center;padding:1.5mm 3mm;border-radius:2mm;margin:2mm 0;}
  .price{font-size:16pt;font-weight:900;color:#7c3aed;text-align:center;margin:2mm 0;}
  .seq{text-align:center;font-size:38pt;font-weight:900;color:#1e1b4b;line-height:1;padding:3mm 0 1mm;}
  .seq-label{font-size:8pt;color:#94a3b8;text-align:center;margin-bottom:3mm;}
  .alias{font-size:18pt;font-weight:900;color:#1e1b4b;text-align:center;margin:2mm 0 3mm;letter-spacing:2px;border-top:1px dashed #e2e8f0;padding-top:3mm;}
  .qr-wrap{display:flex;justify-content:center;padding:3mm 0 2mm;}
  #qr img,#qr canvas{width:58mm!important;height:58mm!important;display:block;}
  .url{font-size:5.5pt;color:#94a3b8;text-align:center;word-break:break-all;padding:1mm 2mm 2mm;}
  .scan{background:#f0fdf4;border:1px solid #86efac;color:#166534;font-size:8pt;font-weight:700;text-align:center;padding:2mm;margin:2mm 0;border-radius:2mm;}
  .btn{display:block;width:100%;margin:3mm 0 0;padding:3mm;background:#7c3aed;color:#fff;border:none;border-radius:3mm;font-size:10pt;font-weight:700;cursor:pointer;}
</style></head><body>
<div class="brand">
  <div class="brand-name">🎱 BINGO</div>
  <div class="room-name">${roomName}</div>
</div>
<div class="info">
  <div class="row"><span class="row-key">รอบที่:</span><span class="row-val">${roundNum} / ${totalRounds}</span></div>
  <div class="row"><span class="row-key">รูปแบบ:</span><span class="row-val">${patternLabel}</span></div>
  ${goldenHtml}
</div>
${prizeHtml}${priceHtml}
<div class="seq">#${String(seqVal).padStart(3,'0')}</div>
<div class="seq-label">ลำดับใบ</div>
<div class="alias">${alias}</div>
<div class="qr-wrap"><div id="qr"></div></div>
<div class="url">${mockQrUrl}</div>
<div class="scan">📱 สแกน QR เพื่อดูไพ่ Bingo บนมือถือ</div>
<button class="btn no-print" onclick="window.print()">🖨️ พิมพ์ตั๋ว (80mm)</button>
<script>
(function(){
  try{
    new QRCode(document.getElementById('qr'),{text:'${safeUrl}',width:220,height:220,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
  }catch(e){
    document.getElementById('qr').innerHTML='<div style="border:2px dashed #ccc;padding:10mm;text-align:center;font-size:7pt;color:#999">QR</div>';
  }
})();
<\/script>
</body></html>`);
    win.document.close();
  };

  /* ─── Shared input style ────────────────────── */
  const inputSx = {
    width:'100%', padding:'8px 12px', borderRadius:'10px',
    background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
    color:'#fff', fontSize:'13px', fontWeight:700,
  };
  const labelSx = { display:'block', fontSize:'10px', color:'rgba(255,255,255,0.4)', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.5px' };
  const F = ({ label, children }) => (
    <div style={{ marginBottom:'10px' }}>
      <label style={labelSx}>{label}</label>
      {children}
    </div>
  );

  /* ─── UI ──────────────────────────────────────────────── */
  return (
    <div style={{ minHeight:'100dvh', background:'#0f172a', color:'#fff', fontFamily:"'Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)' }}>
        <button onClick={() => navigate('/bingo')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:'14px' }}>← Bingo</button>
        <span style={{ color:'rgba(255,255,255,0.2)' }}>|</span>
        <h1 style={{ margin:0, fontSize:'18px', fontWeight:900 }}>🖨️ Template พิมพ์ตั๋ว</h1>
      </div>

      <div style={{ maxWidth:'900px', margin:'0 auto', padding:'20px 16px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'20px' }}>
          {[
            { key:'paper',  icon:'📄', label:'บัตรกระดาษ', sub:'90×150mm', color:'#34d399' },
            { key:'mobile', icon:'📱', label:'ตั๋วมือถือ',   sub:'80mm',     color:'#60a5fa' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex:1, padding:'12px', borderRadius:'14px', cursor:'pointer', textAlign:'left',
              border:`2px solid ${tab===t.key ? t.color+'99' : 'rgba(255,255,255,0.08)'}`,
              background: tab===t.key ? t.color+'12' : 'rgba(255,255,255,0.03)',
              color: tab===t.key ? t.color : 'rgba(255,255,255,0.4)',
              transition:'all 0.15s',
            }}>
              <span style={{ fontSize:'20px' }}>{t.icon}</span>
              <span style={{ marginLeft:'8px', fontSize:'13px', fontWeight:700 }}>{t.label}</span>
              <span style={{ marginLeft:'6px', fontSize:'11px', opacity:0.6 }}>{t.sub}</span>
            </button>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>

          {/* ── LEFT: ข้อมูลบนตั๋ว ── */}
          <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:'16px', padding:'18px', border:'1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ margin:'0 0 14px', fontSize:'11px', color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.5px' }}>📋 ข้อมูลบนตั๋ว</p>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
              <F label="ชื่อ / Alias">
                <input value={alias} onChange={e=>setAlias(e.target.value)} style={inputSx} />
              </F>
              <F label="ใบที่ #">
                <input type="number" value={seq} onChange={e=>setSeq(e.target.value)} min="1" style={inputSx} />
              </F>
            </div>

            <F label="ชื่อห้อง">
              <input value={roomName} onChange={e=>setRoomName(e.target.value)} style={inputSx} />
            </F>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              <F label="รอบที่">
                <input type="number" value={roundNum} onChange={e=>setRoundNum(e.target.value)} min="1" style={inputSx} />
              </F>
              <F label="รอบทั้งหมด">
                <input type="number" value={totalRounds} onChange={e=>setTotalRounds(e.target.value)} min="1" style={inputSx} />
              </F>
            </div>

            <F label="รูปแบบ Bingo">
              <select value={pattern} onChange={e=>setPattern(e.target.value)} style={{ ...inputSx, appearance:'none' }}>
                {PATTERN_OPTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </F>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              <F label="ของรางวัล">
                <input value={prize} onChange={e=>setPrize(e.target.value)} placeholder="(ว่าง = ไม่แสดง)" style={inputSx} />
              </F>
              <F label="ราคา (฿)">
                <input type="number" value={price} onChange={e=>setPrice(e.target.value)} min="0" style={inputSx} />
              </F>
            </div>

            {tab === 'mobile' && (
              <F label="">
                <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', fontSize:'13px', color:'rgba(255,255,255,0.7)' }}>
                  <input type="checkbox" checked={isGolden} onChange={e=>setIsGolden(e.target.checked)} style={{ width:'16px', height:'16px', accentColor:'#f59e0b' }} />
                  ⚡ โกลเด้น รอบ
                </label>
              </F>
            )}
          </div>

          {/* ── RIGHT: ปรับขนาด + พิมพ์ ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

            {/* Layout controls */}
            <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:'16px', padding:'18px', border:'1px solid rgba(255,255,255,0.07)', flex:1 }}>
              <p style={{ margin:'0 0 14px', fontSize:'11px', color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.5px' }}>⚙️ ปรับขนาดตำแหน่ง</p>

              {tab === 'paper' ? (
                <>
                  <F label={`ความสูงช่องตัวเลข: ${tdHeight} mm`}>
                    <input type="range" min="10" max="20" step="0.5" value={tdHeight} onChange={e=>setTdHeight(e.target.value)}
                      style={{ width:'100%', accentColor:'#7c3aed' }} />
                  </F>
                  <F label={`ขนาดตัวเลขในช่อง: ${numFontSize} pt`}>
                    <input type="range" min="10" max="22" step="1" value={numFontSize} onChange={e=>setNumFontSize(e.target.value)}
                      style={{ width:'100%', accentColor:'#7c3aed' }} />
                  </F>
                  <F label={`ขนาดชื่อ (Alias): ${aliasFontSize} pt`}>
                    <input type="range" min="8" max="20" step="1" value={aliasFontSize} onChange={e=>setAliasFontSize(e.target.value)}
                      style={{ width:'100%', accentColor:'#7c3aed' }} />
                  </F>
                  <F label={`ขนาด B I N G O header: ${thFontSize} pt`}>
                    <input type="range" min="8" max="16" step="1" value={thFontSize} onChange={e=>setThFontSize(e.target.value)}
                      style={{ width:'100%', accentColor:'#7c3aed' }} />
                  </F>
                  <F label={`ขนาด QR บนบัตร: ${qrSizeMm} mm`}>
                    <input type="range" min="12" max="30" step="1" value={qrSizeMm} onChange={e=>setQrSizeMm(e.target.value)}
                      style={{ width:'100%', accentColor:'#7c3aed' }} />
                  </F>
                </>
              ) : (
                <p style={{ color:'rgba(255,255,255,0.3)', fontSize:'12px', margin:0 }}>
                  ตั๋วมือถือ 80mm ปรับขนาดได้จากข้อมูลที่กรอก<br/>ขนาด QR จะพิมพ์เต็มหน้ากระดาษ (58mm)
                </p>
              )}
            </div>

            {/* Card numbers (paper only) */}
            {tab === 'paper' && (
              <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:'16px', padding:'14px', border:'1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                  <p style={{ margin:0, fontSize:'11px', color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.5px' }}>🎲 ตัวเลขบนบัตร</p>
                  <button
                    onClick={() => setRows(genRows())}
                    style={{ padding:'4px 10px', borderRadius:'8px', fontSize:'11px', fontWeight:700, cursor:'pointer', background:'rgba(124,58,237,0.2)', border:'1px solid rgba(124,58,237,0.4)', color:'#a78bfa' }}>
                    🔄 สุ่มใหม่
                  </button>
                </div>
                {/* Mini preview */}
                <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'11px' }}>
                  <thead>
                    <tr>{BINGO_COL.map((c,i) => (
                      <th key={c} style={{ background:COL_COLOR[i], color:'#fff', fontWeight:900, padding:'3px 0', border:'1px solid #333' }}>{c}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row,ri) => (
                      <tr key={ri}>
                        {row.map((n,ci) => (
                          <td key={ci} style={{ border:'1px solid #333', textAlign:'center', padding:'4px 0', color: n===0 ? '#d97706' : '#1e1b4b', background: n===0 ? '#fef3c7' : '#fff', fontWeight:800, fontSize:'12px' }}>
                            {n === 0 ? 'FREE' : n}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Print button */}
        <div style={{ marginTop:'20px' }}>
          <button
            onClick={tab === 'paper' ? doPrintPaper : doPrintMobile}
            style={{
              width:'100%', padding:'16px', borderRadius:'16px', fontSize:'16px', fontWeight:900,
              border:'none', cursor:'pointer',
              background: tab === 'paper'
                ? 'linear-gradient(135deg,#10b981,#059669)'
                : 'linear-gradient(135deg,#3b82f6,#2563eb)',
              color:'#fff', boxShadow:'0 4px 20px rgba(0,0,0,0.3)',
            }}>
            🖨️ พิมพ์ตัวอย่าง {tab === 'paper' ? 'บัตรกระดาษ (90×150mm)' : 'ตั๋วมือถือ (80mm)'}
          </button>
        </div>
      </div>
    </div>
  );
}
