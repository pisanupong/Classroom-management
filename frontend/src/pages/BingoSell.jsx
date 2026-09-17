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

export default function BingoSell() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isTeacher = (ROLE_LEVEL[user?.role] ?? 0) >= ROLE_LEVEL['TEACHER'];

  const [rooms,         setRooms]         = useState([]);
  const [selectedRoom,  setSelectedRoom]  = useState(null);
  const [selectedRound, setSelectedRound] = useState(null);
  const [roomDetail,    setRoomDetail]    = useState(null);  // full room with cards
  const [loadingRooms,  setLoadingRooms]  = useState(true);
  const [loadingRoom,   setLoadingRoom]   = useState(false);
  const [studentId,     setStudentId]     = useState('');
  const [preview,       setPreview]       = useState(null);  // card preview
  const [selling,       setSelling]       = useState(false);
  const [lastSold,      setLastSold]      = useState(null);  // last card sold
  const inputRef = useRef(null);

  // Load all non-finished rooms
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
      // default to first round
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

  // Count unique aliases for selected round
  const roundCards = (roomDetail?.cards || []).filter(c =>
    selectedRound ? c.round_id === selectedRound.id : c.round_id === null
  );
  const uniqueAliases = [...new Set(roundCards.map(c => c.alias))].sort();
  const soldCount = uniqueAliases.length;
  const seqNum = soldCount + 1;  // next card sequence number

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

  // Check if this alias already has a card for this round
  const alreadySold = selectedRound
    ? uniqueAliases.includes(studentId.trim())
    : false;

  // Which sequence number does this alias hold?
  const existingSeq = selectedRound
    ? uniqueAliases.indexOf(studentId.trim()) + 1
    : 0;

  const doPrint = (cardData, alias) => {
    if (!cardData) return;
    const numbers = cardData.numbers;
    const rows = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => numbers[r * 5 + c])
    );
    const seq = alreadySold ? existingSeq : soldCount;  // sold count refreshed after generatePreview
    const room  = selectedRoom;
    const round = selectedRound;
    const win = window.open('', '_blank', 'width=400,height=650');
    win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>Bingo #${seq} — ${alias}</title>
    <style>
      @page { size: 100mm 180mm; margin: 4mm; }
      @media print { .no-print { display:none!important; } html,body { width:100mm; height:180mm; } }
      * { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:'Segoe UI',Tahoma,sans-serif; background:#fff; width:100mm; padding:3mm; }
      .hd { text-align:center; border-bottom:1.5pt solid #333; padding-bottom:3mm; margin-bottom:3mm; }
      .room  { font-size:9pt; color:#555; }
      .round { font-size:8.5pt; color:#d97706; font-weight:700; margin:1.5mm 0; line-height:1.3 }
      .seq   { display:inline-block; background:#1e1b4b; color:#fff; font-size:8pt; font-weight:900;
               padding:1mm 3mm; border-radius:4mm; margin:1mm 0; }
      .price { font-size:9pt; color:#059669; font-weight:700; margin:1mm 0; }
      .alias { font-size:26pt; font-weight:900; color:#1e1b4b; line-height:1.1; margin:2mm 0; letter-spacing:1px; }
      table  { border-collapse:collapse; width:100%; margin-top:3mm; }
      th,td  { border:1.5pt solid #222; text-align:center; padding:0; }
      th     { padding:2mm 1mm; font-size:14pt; font-weight:900; color:#fff; }
      td     { height:17mm; font-size:17pt; font-weight:800; color:#1e1b4b; }
      .free  { background:#fef3c7; color:#d97706; font-size:9pt; font-weight:900; }
      .btn   { display:block; width:100%; margin:3mm 0 0; padding:2.5mm;
               background:#7c3aed; color:#fff; border:none; border-radius:3mm;
               font-size:11pt; font-weight:700; cursor:pointer; }
    </style></head><body>
    <div class="hd">
      <div class="room">🎱 ${room.name}</div>
      <div class="round">รอบที่ ${round.round_number}${round.prize ? ` — 🎁 ${round.prize}` : ''}${round.is_golden ? ' ⚡' : ''}</div>
      <div class="round">${PATTERN_LABEL[round.pattern] || round.pattern}</div>
      <div class="seq">ใบที่ ${seq}</div>
      ${room.ticket_price > 0 ? `<div class="price">${fmt(room.ticket_price)}</div>` : ''}
      <div class="alias">${alias}</div>
    </div>
    <button class="btn no-print" onclick="window.print()">🖨️ พิมพ์บัตร (100×180mm)</button>
    <table>
      <thead><tr>${BINGO_COL.map((c,i)=>`<th style="background:${COL_COLOR[i]}">${c}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row=>`<tr>${row.map(n=>n===0?'<td class="free">FREE</td>':`<td>${n}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    </body></html>`);
    win.document.close();
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
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'#0f172a', color:'#fff', fontFamily:"'Segoe UI',sans-serif" }}>
      <p>ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
    </div>
  );

  // ── Preview card component ─────────────────────────────────────
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

          {/* Sold summary for selected round */}
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
                      background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff',
                      opacity: !studentId.trim() || selling ? 0.4 : 1,
                    }}>
                    {selling ? '⏳ กำลังสร้าง...' : '🖨️ ขาย & พิมพ์'}
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
                <button
                  onClick={() => doPrint(preview.card, preview.alias)}
                  style={{ padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.12)', color: '#fbbf24', cursor: 'pointer' }}>
                  🖨️ พิมพ์อีกครั้ง
                </button>
              </div>
              <CardPreview card={preview.card} alias={preview.alias} seq={alreadySold ? existingSeq : soldCount} />
            </div>
          )}

          {/* Sold list for selected round (full) */}
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
