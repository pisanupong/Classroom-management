import React, { useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const BINGO_COL = ['B', 'I', 'N', 'G', 'O'];
const COL_COLOR = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const PATTERN_LABEL = {
  line: '📏 เส้นตรง', full: '🟩 เต็มบอร์ด',
  corners: '🔲 4 มุม', T: '🔠 ตัว T', L: '🔡 ตัว L',
};
const ROLE_LEVEL = { STUDENT: 0, TEACHER: 1, ADMIN: 2, SUPER_USER: 3 };
const fmt = (n) => `฿${Number(n || 0).toLocaleString('th-TH')}`;

/* ── QR Code library URL ──────────────────────────────────────────── */
const QRCODE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

export default function BingoSell() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isTeacher = (ROLE_LEVEL[user?.role] ?? 0) >= ROLE_LEVEL['TEACHER'];

  const [rooms,         setRooms]         = useState([]);
  const [selectedRoom,  setSelectedRoom]  = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);
  const [roomDetail,    setRoomDetail]    = useState(null);
  const [loadingRooms,  setLoadingRooms]  = useState(true);
  const [loadingRoom,   setLoadingRoom]   = useState(false);
  const [studentId,     setStudentId]     = useState('');
  const [preview,       setPreview]       = useState(null);
  const [selling,       setSelling]       = useState(false);
  const [lastSold,      setLastSold]      = useState(null);
  const [printType,     setPrintType]     = useState('paper'); // 'mobile' | 'paper'
  const inputRef = useRef(null);

  useEffect(() => {
    setLoadingRooms(true);
    api.get('/bingo/rooms')
      .then(r => {
        setRooms(r.data);
        if (r.data.length > 0) selectRoom(r.data[0]);
      })
      .catch(() => {})
      .finally(() => setLoadingRooms(false));
  }, []);

  const selectRoom = async (room) => {
    setSelectedRoom(room);
    setSelectedRound(null);
    setPreview(null);
    setLastSold(null);
    setLoadingRoom(true);
    try {
      const r = await api.get(`/bingo/rooms/${room.id}`);
      setRoomDetail(r.data);
      if (r.data.rounds?.length > 0) setSelectedRound(r.data.rounds[0]);
    } catch {}
    finally { setLoadingRoom(false); }
  };

  const refreshRoom = async () => {
    if (!selectedRoom) return;
    try {
      const r = await api.get(`/bingo/rooms/${selectedRoom.id}`);
      setRoomDetail(r.data);
    } catch {}
  };

  const roundCards = (roomDetail?.cards || []).filter(c =>
    selectedRound ? c.round_id === selectedRound.id : c.round_id === null
  );
  const uniqueAliases = [...new Set(roundCards.map(c => c.alias))].sort();
  const soldCount = uniqueAliases.length;
  const seqNum = soldCount + 1;

  const generatePreview = async () => {
    if (!studentId.trim() || !selectedRoom || !selectedRound) return;
    setSelling(true);
    try {
      const r = await api.post(`/bingo/rooms/${selectedRoom.id}/join`, {
        alias: studentId.trim(),
        roundId: selectedRound.id,
      });
      setPreview({ card: r.data.card, alias: studentId.trim() });
      await refreshRoom();
    } catch (e) {
      alert(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setSelling(false); }
  };

  const alreadySold = selectedRound
    ? uniqueAliases.includes(studentId.trim())
    : false;

  const existingSeq = selectedRound
    ? uniqueAliases.indexOf(studentId.trim()) + 1
    : 0;

  /* ── Build QR URL pointing to player join page ───────────────────── */
  const buildQrUrl = (roomId, roundId, alias) => {
    const base = window.location.origin;
    return `${base}/bingo/play/${roomId}?round=${roundId}&alias=${encodeURIComponent(alias)}`;
  };

  /* ── Print: Type 1 — 80mm mobile receipt (no grid) ──────────────── */
  const doPrintMobile = ({ rows, seq, room, round, alias, qrUrl }) => {
    const patternLabel = PATTERN_LABEL[round.pattern] || round.pattern;
    const priceHtml = room.ticket_price > 0
      ? `<div class="price">${fmt(room.ticket_price)}</div>` : '';
    const prizeHtml = round.prize
      ? `<div class="prize-badge">🎁 ${round.prize}</div>` : '';
    const goldenHtml = round.is_golden
      ? `<div class="row"><span class="row-key">⚡ โกลเด้น รอบ</span><span class="row-val">✓</span></div>` : '';
    const safeUrl = qrUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    const win = window.open('', '_blank', 'width=360,height=700');
    win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>ตั๋ว Bingo #${seq} — ${alias}</title>
<script src="${QRCODE_CDN}"><\/script>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  @media print { .no-print { display:none!important; } }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Courier New',monospace; width:74mm; background:#fff; color:#1e293b; }
  .brand { text-align:center; padding:4mm 0 3mm; border-bottom:2px solid #1e293b; }
  .brand-name { font-size:20pt; font-weight:900; letter-spacing:3px; color:#7c3aed; }
  .room-name { font-size:8pt; color:#475569; margin-top:1mm; }
  .info { padding:3mm 0; border-bottom:1px dashed #94a3b8; }
  .row { display:flex; justify-content:space-between; font-size:8pt; padding:0.8mm 0; }
  .row-key { color:#64748b; }
  .row-val { font-weight:700; }
  .prize-badge { background:#fef3c7; color:#d97706; font-size:8pt; font-weight:700; text-align:center; padding:1.5mm 3mm; border-radius:2mm; margin:2mm 0; }
  .price { font-size:16pt; font-weight:900; color:#7c3aed; text-align:center; margin:2mm 0; }
  .seq { text-align:center; font-size:38pt; font-weight:900; color:#1e1b4b; line-height:1; padding:3mm 0 1mm; }
  .seq-label { font-size:8pt; color:#94a3b8; text-align:center; margin-bottom:3mm; }
  .alias { font-size:18pt; font-weight:900; color:#1e1b4b; text-align:center; margin:2mm 0 3mm; letter-spacing:2px; border-top:1px dashed #e2e8f0; padding-top:3mm; }
  .qr-wrap { display:flex; justify-content:center; padding:3mm 0 2mm; }
  #qr img, #qr canvas { width:58mm!important; height:58mm!important; display:block; }
  .url { font-size:5.5pt; color:#94a3b8; text-align:center; word-break:break-all; padding:1mm 2mm 2mm; }
  .scan { background:#f0fdf4; border:1px solid #86efac; color:#166534; font-size:8pt; font-weight:700; text-align:center; padding:2mm; margin:2mm 0; border-radius:2mm; }
  .btn { display:block; width:100%; margin:3mm 0 0; padding:3mm; background:#7c3aed; color:#fff; border:none; border-radius:3mm; font-size:10pt; font-weight:700; cursor:pointer; }
</style></head><body>
<div class="brand">
  <div class="brand-name">🎱 BINGO</div>
  <div class="room-name">${room.name}</div>
</div>
<div class="info">
  <div class="row"><span class="row-key">รอบที่:</span><span class="row-val">${round.round_number} / ${room.total_rounds}</span></div>
  <div class="row"><span class="row-key">รูปแบบ:</span><span class="row-val">${patternLabel}</span></div>
  ${goldenHtml}
</div>
${prizeHtml}
${priceHtml}
<div class="seq">#${String(seq).padStart(3, '0')}</div>
<div class="seq-label">ลำดับใบ</div>
<div class="alias">${alias}</div>
<div class="qr-wrap"><div id="qr"></div></div>
<div class="url">${qrUrl}</div>
<div class="scan">📱 สแกน QR เพื่อดูไพ่ Bingo บนมือถือ</div>
<button class="btn no-print" onclick="window.print()">🖨️ พิมพ์ตั๋ว (80mm)</button>
<script>
(function() {
  try {
    new QRCode(document.getElementById('qr'), {
      text: '${safeUrl}',
      width: 220, height: 220,
      colorDark: '#000000', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch(e) {
    document.getElementById('qr').innerHTML = '<div style="border:2px dashed #ccc;padding:10mm;text-align:center;font-size:7pt;color:#999">QR ไม่พร้อมใช้งาน<br><small>' + e.message + '</small></div>';
  }
})();
<\/script>
</body></html>`);
    win.document.close();
  };

  /* ── Print: Type 2 — 100×150mm paper Bingo card (with grid) ─────── */
  const doPrintPaper = ({ rows, seq, room, round, alias, qrUrl }) => {
    const patternLabel = PATTERN_LABEL[round.pattern] || round.pattern;
    const prizeHtml = round.prize ? `<span class="badge prize">🎁 ${round.prize}</span>` : '';
    const priceHtml = room.ticket_price > 0 ? `<span class="badge price">${fmt(room.ticket_price)}</span>` : '';
    const safeUrl = qrUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const gridRows = rows.map(row =>
      `<tr>${row.map(n => n === 0
        ? '<td class="free">FREE</td>'
        : `<td>${n}</td>`
      ).join('')}</tr>`
    ).join('');
    const colHeaders = BINGO_COL.map((c, i) =>
      `<th style="background:${COL_COLOR[i]}">${c}</th>`
    ).join('');

    const win = window.open('', '_blank', 'width=420,height=620');
    win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Bingo Card #${seq} — ${alias}</title>
<script src="${QRCODE_CDN}"><\/script>
<style>
  @page { size: 100mm 150mm; margin: 6mm; }
  @media print { .no-print { display:none!important; } html,body { width:88mm; height:138mm; overflow:hidden; } }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Tahoma,sans-serif; background:#fff; width:88mm; color:#1e293b; }
  .top { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2pt solid #7c3aed; padding-bottom:2mm; margin-bottom:2mm; }
  .top-left { flex:1; min-width:0; }
  .brand { font-size:11pt; font-weight:900; color:#7c3aed; letter-spacing:1px; }
  .room-name { font-size:6.5pt; color:#475569; margin-top:0.5mm; }
  .badges { display:flex; flex-wrap:wrap; gap:1mm; margin-top:1.5mm; }
  .badge { font-size:6.5pt; font-weight:700; padding:0.5mm 2mm; border-radius:1.5mm; white-space:nowrap; }
  .badge.round { background:#ede9fe; color:#7c3aed; }
  .badge.prize { background:#fef3c7; color:#d97706; }
  .badge.price { background:#ecfdf5; color:#059669; }
  .top-right { display:flex; flex-direction:column; align-items:flex-end; gap:1mm; flex-shrink:0; margin-left:2mm; }
  .seq { font-size:28pt; font-weight:900; color:#1e1b4b; line-height:1; }
  .seq-label { font-size:6pt; color:#94a3b8; text-align:right; }
  #qr img, #qr canvas { width:22mm!important; height:22mm!important; display:block; }
  .alias { font-size:14pt; font-weight:900; color:#1e1b4b; text-align:center; margin:1.5mm 0; letter-spacing:1px; }
  table { border-collapse:collapse; width:100%; }
  th,td { border:1.5pt solid #222; text-align:center; padding:0; }
  th { padding:2mm 1mm; font-size:13pt; font-weight:900; color:#fff; }
  td { height:16mm; font-size:17pt; font-weight:800; color:#1e1b4b; }
  .free { background:#fef3c7; color:#d97706; font-size:8pt; font-weight:900; }
  .footer { display:flex; justify-content:space-between; align-items:center; margin-top:2mm; border-top:1px solid #e2e8f0; padding-top:1.5mm; }
  .footer-url { font-size:5pt; color:#94a3b8; word-break:break-all; flex:1; margin-right:3mm; }
  .footer-note { font-size:5.5pt; color:#475569; text-align:right; flex-shrink:0; }
  .btn { display:block; width:100%; margin:3mm 0 0; padding:2.5mm; background:#7c3aed; color:#fff; border:none; border-radius:3mm; font-size:11pt; font-weight:700; cursor:pointer; }
</style></head><body>
<div class="top">
  <div class="top-left">
    <div class="brand">🎱 BINGO CARD</div>
    <div class="room-name">${room.name}</div>
    <div class="badges">
      <span class="badge round">รอบ ${round.round_number} · ${patternLabel}</span>
      ${prizeHtml}
      ${priceHtml}
    </div>
  </div>
  <div class="top-right">
    <div class="seq">#${String(seq).padStart(3, '0')}</div>
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
  <div class="footer-url">${qrUrl}</div>
  <div class="footer-note">📱 สแกน QR เพื่อติดตามบนมือถือ</div>
</div>
<button class="btn no-print" onclick="window.print()">🖨️ พิมพ์บัตร (100×150mm)</button>
<script>
(function() {
  try {
    new QRCode(document.getElementById('qr'), {
      text: '${safeUrl}',
      width: 84, height: 84,
      colorDark: '#000000', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch(e) {}
})();
<\/script>
</body></html>`);
    win.document.close();
  };

  /* ── Dispatch to correct print format ───────────────────────────── */
  const doPrint = (cardData, alias, type) => {
    if (!cardData || !selectedRoom || !selectedRound) return;
    const numbers = cardData.numbers;
    const rows = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => numbers[r * 5 + c])
    );
    const seq = alreadySold ? existingSeq : soldCount;
    const qrUrl = buildQrUrl(selectedRoom.id, selectedRound.id, alias);
    const args = { rows, seq, room: selectedRoom, round: selectedRound, alias, qrUrl };
    const t = type || printType;
    if (t === 'mobile') doPrintMobile(args);
    else doPrintPaper(args);
  };

  const handleSell = async () => {
    if (!studentId.trim()) { inputRef.current?.focus(); return; }
    setSelling(true);
    try {
      const r = await api.post(`/bingo/rooms/${selectedRoom.id}/join`, {
        alias: studentId.trim(),
        roundId: selectedRound.id,
      });
      await refreshRoom();
      const alias = studentId.trim();
      setLastSold({ card: r.data.card, alias });
      setPreview({ card: r.data.card, alias });
      doPrint(r.data.card, alias);
      setStudentId('');
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (e) {
      alert(e.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally { setSelling(false); }
  };

  if (!isTeacher) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f172a', color: '#fff', fontFamily: "'Segoe UI',sans-serif" }}>
      <p>ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
    </div>
  );

  /* ── Card preview (inline) ────────────────────────────────────────── */
  const CardPreview = ({ card, alias, seq }) => {
    if (!card) return null;
    const numbers = card.numbers;
    const rows = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => numbers[r * 5 + c])
    );
    return (
      <div style={{ background: '#fff', borderRadius: '12px', padding: '12px', color: '#1e1b4b', width: '100%', maxWidth: '260px' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '11px', color: '#555' }}>🎱 {selectedRoom?.name}</div>
          {selectedRound && (
            <div style={{ fontSize: '10px', color: '#d97706', fontWeight: 700, margin: '2px 0' }}>
              รอบที่ {selectedRound.round_number}{selectedRound.prize ? ` — ${selectedRound.prize}` : ''}
            </div>
          )}
          <span style={{ display: 'inline-block', background: '#1e1b4b', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '2px 8px', borderRadius: '99px', margin: '2px 0' }}>
            ใบที่ {seq}
          </span>
          {selectedRoom?.ticket_price > 0 && (
            <div style={{ fontSize: '10px', color: '#059669', fontWeight: 700 }}>{fmt(selectedRoom.ticket_price)}</div>
          )}
          <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '4px' }}>{alias}</div>
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>{BINGO_COL.map((c, i) => (
              <th key={c} style={{ background: COL_COLOR[i], color: '#fff', fontWeight: 900, fontSize: '12px', padding: '4px 0', border: '1.5px solid #333' }}>{c}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((n, ci) => (
                  <td key={ci} style={{
                    border: '1.5px solid #333', textAlign: 'center', padding: '5px 2px',
                    fontSize: n === 0 ? '8px' : '13px', fontWeight: 700,
                    background: n === 0 ? '#fef3c7' : '#fff',
                    color: n === 0 ? '#d97706' : '#1e1b4b',
                  }}>{n === 0 ? 'FREE' : n}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100dvh', color: '#fff', background: 'linear-gradient(135deg,#0f172a,#1e1b4b)', fontFamily: "'Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate('/bingo')} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>← Bingo</button>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 900 }}>🎫 ขายบัตร Bingo</h1>
        </div>
        <button onClick={refreshRoom} style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px' }}>
          🔄 รีโหลด
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', padding: '16px', maxWidth: '1000px', margin: '0 auto' }}>

        {/* ── LEFT: Controls ── */}
        <div style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Room selector */}
          <div style={{ borderRadius: '16px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
            <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏠 เลือกห้อง</p>
            {loadingRooms ? (
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>⏳ กำลังโหลด...</p>
            ) : rooms.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>ไม่มีห้องที่เปิดอยู่</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {rooms.map(room => (
                  <div key={room.id}
                    onClick={() => selectRoom(room)}
                    style={{
                      padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
                      border: `1px solid ${selectedRoom?.id === room.id ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.07)'}`,
                      background: selectedRoom?.id === room.id ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.03)',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{room.name}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                      {room.total_rounds} รอบ
                      {room.ticket_price > 0 && <span style={{ color: '#fbbf24', marginLeft: '8px' }}>{fmt(room.ticket_price)}/ใบ</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Round selector */}
          {roomDetail && (
            <div style={{ borderRadius: '16px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🎯 เลือกรอบ</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {roomDetail.rounds?.map(rnd => {
                  const rndCards = (roomDetail.cards || []).filter(c => c.round_id === rnd.id);
                  const rndCount = [...new Set(rndCards.map(c => c.alias))].length;
                  const isSelected = selectedRound?.id === rnd.id;
                  return (
                    <div key={rnd.id}
                      onClick={() => { setSelectedRound(rnd); setPreview(null); }}
                      style={{
                        padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
                        border: `1px solid ${isSelected ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.07)'}`,
                        background: isSelected ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                        transition: 'all 0.15s',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>
                          รอบ {rnd.round_number} {rnd.is_golden ? '⚡' : ''}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: rndCount > 0 ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
                          {rndCount} ใบ
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                        {PATTERN_LABEL[rnd.pattern] || rnd.pattern}
                        {rnd.prize && <span style={{ color: '#fbbf24', marginLeft: '6px' }}>🎁 {rnd.prize}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sold summary */}
          {selectedRound && roomDetail && (
            <div style={{ borderRadius: '16px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 ใบที่ขายแล้ว</p>
                <span style={{ fontSize: '14px', fontWeight: 900, color: '#34d399' }}>{soldCount} ใบ</span>
              </div>
              {soldCount > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                  {uniqueAliases.map((alias, i) => (
                    <span key={alias} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      #{i + 1} {alias}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', margin: 0 }}>ยังไม่มีใบที่ขาย</p>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Sell form + Preview ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Sell form */}
          <div style={{ borderRadius: '16px', padding: '20px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>

            {/* Print type selector */}
            <div style={{ marginBottom: '14px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🖨️ รูปแบบการพิมพ์
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Paper card option */}
                <button
                  onClick={() => setPrintType('paper')}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: '12px', cursor: 'pointer',
                    border: `2px solid ${printType === 'paper' ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    background: printType === 'paper' ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.03)',
                    color: printType === 'paper' ? '#34d399' : 'rgba(255,255,255,0.45)',
                    transition: 'all 0.15s', textAlign: 'left',
                  }}>
                  <div style={{ fontSize: '16px', marginBottom: '2px' }}>📄</div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>บัตรกระดาษ</div>
                  <div style={{ fontSize: '10px', opacity: 0.7 }}>100×150mm · มีตาราง Bingo</div>
                </button>
                {/* Mobile ticket option */}
                <button
                  onClick={() => setPrintType('mobile')}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: '12px', cursor: 'pointer',
                    border: `2px solid ${printType === 'mobile' ? 'rgba(96,165,250,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    background: printType === 'mobile' ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.03)',
                    color: printType === 'mobile' ? '#60a5fa' : 'rgba(255,255,255,0.45)',
                    transition: 'all 0.15s', textAlign: 'left',
                  }}>
                  <div style={{ fontSize: '16px', marginBottom: '2px' }}>📱</div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>ตั๋วมือถือ</div>
                  <div style={{ fontSize: '10px', opacity: 0.7 }}>80mm · QR สแกนบนมือถือ</div>
                </button>
              </div>
            </div>

            <p style={{ margin: '0 0 14px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🎫 ขายใบที่ <span style={{ color: '#34d399', fontSize: '16px', fontWeight: 900 }}>#{seqNum}</span>
              {selectedRoom?.ticket_price > 0 && (
                <span style={{ color: '#fbbf24', marginLeft: '10px', fontSize: '14px', fontWeight: 700 }}>{fmt(selectedRoom.ticket_price)}</span>
              )}
            </p>

            {!selectedRoom && (
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>← เลือกห้องก่อน</p>
            )}
            {selectedRoom && !selectedRound && (
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>← เลือกรอบก่อน</p>
            )}

            {selectedRoom && selectedRound && (
              <>
                {alreadySold && studentId.trim() && (
                  <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', marginBottom: '10px', fontSize: '12px', color: '#fbbf24' }}>
                    ⚠️ รหัสนี้มีใบแล้ว (ใบที่ #{existingSeq}) — จะพิมพ์ใบเดิมซ้ำ
                  </div>
                )}
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  รหัสนักเรียน / ชื่อ
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    ref={inputRef}
                    autoFocus
                    value={studentId}
                    onChange={e => setStudentId(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSell()}
                    placeholder="พิมพ์รหัสนักเรียน แล้วกด Enter"
                    style={{
                      flex: 1, padding: '12px 16px', borderRadius: '12px',
                      fontSize: '20px', fontWeight: 800, textAlign: 'center', letterSpacing: '2px',
                      color: '#fff', background: 'rgba(255,255,255,0.08)',
                      border: '2px solid rgba(255,255,255,0.15)', outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={generatePreview}
                    disabled={!studentId.trim() || selling}
                    style={{
                      flex: 1, padding: '11px', borderRadius: '12px', fontSize: '13px', fontWeight: 700,
                      border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)',
                      color: 'rgba(255,255,255,0.7)', cursor: !studentId.trim() || selling ? 'not-allowed' : 'pointer',
                      opacity: !studentId.trim() || selling ? 0.4 : 1,
                    }}>
                    👁️ ดูตัวอย่าง
                  </button>
                  <button
                    onClick={handleSell}
                    disabled={!studentId.trim() || selling || !selectedRound}
                    style={{
                      flex: 2, padding: '11px', borderRadius: '12px', fontSize: '14px', fontWeight: 900,
                      border: 'none', cursor: !studentId.trim() || selling ? 'not-allowed' : 'pointer',
                      background: printType === 'mobile'
                        ? 'linear-gradient(135deg,#3b82f6,#2563eb)'
                        : 'linear-gradient(135deg,#f59e0b,#d97706)',
                      color: '#fff',
                      opacity: !studentId.trim() || selling ? 0.4 : 1,
                    }}>
                    {selling ? '⏳ กำลังสร้าง...' : printType === 'mobile' ? '🖨️ ขาย & พิมพ์ตั๋ว 80mm' : '🖨️ ขาย & พิมพ์บัตร'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Card preview */}
          {preview && (
            <div style={{ borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ตัวอย่างบัตร
                </p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => doPrint(preview.card, preview.alias, 'paper')}
                    style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.1)', color: '#34d399', cursor: 'pointer' }}>
                    📄 100×150
                  </button>
                  <button
                    onClick={() => doPrint(preview.card, preview.alias, 'mobile')}
                    style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.1)', color: '#60a5fa', cursor: 'pointer' }}>
                    📱 80mm
                  </button>
                </div>
              </div>
              <CardPreview card={preview.card} alias={preview.alias} seq={alreadySold ? existingSeq : soldCount} />
            </div>
          )}

          {/* Sold list for selected round */}
          {selectedRound && uniqueAliases.length > 0 && (
            <div style={{ borderRadius: '16px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
              <p style={{ margin: '0 0 10px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                รายชื่อ — รอบที่ {selectedRound.round_number} ({soldCount} ใบ)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '4px' }}>
                {uniqueAliases.map((alias, i) => (
                  <div key={alias} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 8px', borderRadius: '8px', fontSize: '12px',
                    background: lastSold?.alias === alias ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${lastSold?.alias === alias ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', minWidth: '20px' }}>#{i + 1}</span>
                    <span style={{ fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alias}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
