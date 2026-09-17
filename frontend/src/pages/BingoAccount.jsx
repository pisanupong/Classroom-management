/**
 * BingoAccount — หน้าบัญชีรายรับ-รายจ่าย Bingo
 * Protected page (ต้อง login)
 * URL: /bingo/account/:id
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const fmt = (n) =>
  n === 0 ? '฿0' : `฿${Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const PATTERN_LABEL = {
  line:    'เส้นตรง',
  full:    'เต็มบอร์ด',
  corners: '4 มุม',
  T:       'ตัว T',
  L:       'ตัว L',
};

export default function BingoAccount() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [room,         setRoom]         = useState(null);
  const [rounds,       setRounds]       = useState([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading,      setLoading]      = useState(true);

  // Editable states
  const [editTicket,   setEditTicket]   = useState(false);
  const [ticketDraft,  setTicketDraft]  = useState('');
  const [saving,       setSaving]       = useState(false);

  // prize_value editing (per round)
  const [editPrize,    setEditPrize]    = useState(false);
  const [prizeDraft,   setPrizeDraft]   = useState([]);

  useEffect(() => {
    api.get(`/bingo/rooms/${id}`).then(r => {
      setRoom(r.data);
      setRounds(r.data.rounds || []);
      setTotalPlayers(r.data._count?.cards || 0);
      setTicketDraft(String(r.data.ticket_price || 0));
      setPrizeDraft((r.data.rounds || []).map(rnd => ({
        id:          rnd.id,
        prize_value: String(rnd.prize_value || 0),
      })));
    }).finally(() => setLoading(false));
  }, [id]);

  const saveTicketPrice = async () => {
    setSaving(true);
    try {
      const r = await api.patch(`/bingo/rooms/${id}`, { ticket_price: parseFloat(ticketDraft) || 0 });
      setRoom(r.data);
      setEditTicket(false);
    } catch {} finally { setSaving(false); }
  };

  const savePrizeValues = async () => {
    setSaving(true);
    try {
      await api.put(`/bingo/rooms/${id}/rounds`, {
        rounds: prizeDraft.map(p => ({ id: p.id, prize_value: parseFloat(p.prize_value) || 0 })),
      });
      // Update local rounds
      setRounds(prev => prev.map(r => {
        const d = prizeDraft.find(p => p.id === r.id);
        return d ? { ...r, prize_value: parseFloat(d.prize_value) || 0 } : r;
      }));
      setEditPrize(false);
    } catch {} finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      <div style={{ fontSize: '20px' }}>⏳ กำลังโหลด...</div>
    </div>
  );

  if (!room) return (
    <div style={{ minHeight: '100dvh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      <div>ไม่พบข้อมูล</div>
    </div>
  );

  const ticketPrice = room.ticket_price || 0;

  // Compute per-round financials
  const roundData = rounds.map(rnd => {
    const winnersCount = rnd.winners?.length || 0;
    const prizeValue   = rnd.prize_value || 0;
    const revenue      = ticketPrice * totalPlayers;     // revenue same across rounds (one-time ticket)
    const payout       = prizeValue * winnersCount;
    return { ...rnd, winnersCount, prizeValue, revenue, payout };
  });

  const totalRevenue = ticketPrice * totalPlayers;       // total ticket revenue for the whole game
  const totalPayout  = roundData.reduce((s, r) => s + r.payout, 0);
  const netProfit    = totalRevenue - totalPayout;

  const FF = "'Segoe UI',sans-serif";
  const BG = 'linear-gradient(135deg,#0f172a,#1e1b4b)';

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: '#fff', fontFamily: FF }}>

      {/* ── Header ── */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px',
        background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate(`/bingo/host/${id}`)}
            style={{ color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
            ← กลับ
          </button>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span style={{ fontWeight: 700, fontSize: '16px' }}>💰 บัญชี — {room.name}</span>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
          {totalPlayers} ผู้เล่นลงทะเบียน
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px 16px' }}>

        {/* ── Ticket price setting ── */}
        <div style={{ borderRadius: '16px', padding: '16px 20px', marginBottom: '16px',
          border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p style={{ margin: '0 0 2px', fontSize: '12px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ราคาบัตรต่อใบ
            </p>
            {editTicket ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.5)' }}>฿</span>
                <input
                  type="number" min="0" step="0.5" value={ticketDraft}
                  onChange={e => setTicketDraft(e.target.value)}
                  autoFocus
                  style={{ width: '120px', padding: '6px 10px', borderRadius: '10px', fontSize: '20px', fontWeight: 700,
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff', outline: 'none' }}
                />
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '28px', fontWeight: 900, color: '#34d399' }}>
                {fmt(ticketPrice)}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {editTicket ? (
              <>
                <button onClick={saveTicketPrice} disabled={saving}
                  style={{ padding: '8px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '14px',
                    background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', color: '#fff', cursor: 'pointer' }}>
                  {saving ? 'บันทึก...' : 'บันทึก'}
                </button>
                <button onClick={() => { setEditTicket(false); setTicketDraft(String(ticketPrice)); }}
                  style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '14px',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                  ยกเลิก
                </button>
              </>
            ) : (
              <button onClick={() => setEditTicket(true)}
                style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                ✏️ แก้ไขราคา
              </button>
            )}
          </div>
        </div>

        {/* ── Rounds table ── */}
        <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '20px', background: 'rgba(255,255,255,0.03)' }}>

          {/* Table header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>รายละเอียดแต่ละรอบ</p>
            {editPrize ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={savePrizeValues} disabled={saving}
                  style={{ padding: '5px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                    background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399', cursor: 'pointer' }}>
                  {saving ? '...' : 'บันทึก'}
                </button>
                <button onClick={() => setEditPrize(false)}
                  style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button onClick={() => setEditPrize(true)}
                style={{ padding: '5px 14px', borderRadius: '8px', fontSize: '12px',
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                ✏️ แก้ไขมูลค่ารางวัล
              </button>
            )}
          </div>

          {/* Column headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: '50px 1fr 110px 90px 110px 90px 110px',
            padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: '11px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            <div>รอบ</div>
            <div>รางวัล / รูปแบบ</div>
            <div style={{ textAlign: 'right' }}>มูลค่ารางวัล</div>
            <div style={{ textAlign: 'center' }}>ผู้เล่น</div>
            <div style={{ textAlign: 'right' }}>ยอดขายบัตร</div>
            <div style={{ textAlign: 'center' }}>ผู้ชนะ</div>
            <div style={{ textAlign: 'right' }}>จ่ายรางวัล</div>
          </div>

          {/* Rows */}
          {roundData.map((rnd, i) => (
            <div key={rnd.id} style={{
              display: 'grid', gridTemplateColumns: '50px 1fr 110px 90px 110px 90px 110px',
              padding: '12px 16px', alignItems: 'center',
              borderBottom: i < roundData.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
            }}>
              {/* Round # */}
              <div style={{ fontWeight: 800, fontSize: '16px', color: '#c4b5fd' }}>
                {i + 1}{rnd.is_golden ? ' ⚡' : ''}
              </div>

              {/* Prize / pattern */}
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: rnd.prize ? '#fff' : 'rgba(255,255,255,0.25)',
                  fontStyle: rnd.prize ? 'normal' : 'italic' }}>
                  {rnd.prize || 'ยังไม่ตั้งรางวัล'}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                  {PATTERN_LABEL[rnd.pattern] || rnd.pattern}
                </p>
              </div>

              {/* Prize value */}
              <div style={{ textAlign: 'right' }}>
                {editPrize ? (
                  <input
                    type="number" min="0" step="0.5"
                    value={prizeDraft[i]?.prize_value || '0'}
                    onChange={e => setPrizeDraft(prev => prev.map((p, j) =>
                      j === i ? { ...p, prize_value: e.target.value } : p
                    ))}
                    style={{ width: '90px', padding: '4px 8px', borderRadius: '8px', textAlign: 'right',
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff', fontSize: '14px', outline: 'none' }}
                  />
                ) : (
                  <span style={{ fontWeight: 700, fontSize: '15px',
                    color: rnd.prizeValue > 0 ? '#f87171' : 'rgba(255,255,255,0.2)' }}>
                    {fmt(rnd.prizeValue)}
                  </span>
                )}
              </div>

              {/* Players */}
              <div style={{ textAlign: 'center', fontWeight: 600, fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                {totalPlayers} <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>คน</span>
              </div>

              {/* Revenue */}
              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '15px',
                color: rnd.revenue > 0 ? '#34d399' : 'rgba(255,255,255,0.2)' }}>
                {fmt(rnd.revenue)}
              </div>

              {/* Winners */}
              <div style={{ textAlign: 'center' }}>
                {rnd.winnersCount > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px',
                    padding: '2px 10px', borderRadius: '999px', fontSize: '13px', fontWeight: 700,
                    background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
                    🏆 {rnd.winnersCount}
                  </span>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>—</span>
                )}
              </div>

              {/* Payout */}
              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '15px',
                color: rnd.payout > 0 ? '#fb923c' : 'rgba(255,255,255,0.2)' }}>
                {fmt(rnd.payout)}
              </div>
            </div>
          ))}
        </div>

        {/* ── Summary cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px', marginBottom: '16px' }}>

          {/* Total revenue */}
          <div style={{ borderRadius: '16px', padding: '18px 20px', textAlign: 'center',
            border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.07)' }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'rgba(52,211,153,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              💰 ยอดรายรับสะสม
            </p>
            <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
              ({totalPlayers} คน × {fmt(ticketPrice)})
            </p>
            <p style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: '#34d399' }}>
              {fmt(totalRevenue)}
            </p>
          </div>

          {/* Total payout */}
          <div style={{ borderRadius: '16px', padding: '18px 20px', textAlign: 'center',
            border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.07)' }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'rgba(251,146,60,0.6)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              💸 ยอดรางจ่ายทั้งหมด
            </p>
            <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
              ({roundData.filter(r => r.winnersCount > 0).length} รอบที่มีผู้ชนะ)
            </p>
            <p style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: '#fb923c' }}>
              {fmt(totalPayout)}
            </p>
          </div>

          {/* Net profit */}
          <div style={{
            borderRadius: '16px', padding: '18px 20px', textAlign: 'center',
            border: `1px solid ${netProfit >= 0 ? 'rgba(167,139,250,0.4)' : 'rgba(248,113,113,0.4)'}`,
            background: netProfit >= 0 ? 'rgba(124,58,237,0.1)' : 'rgba(239,68,68,0.08)',
          }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px',
              color: netProfit >= 0 ? 'rgba(167,139,250,0.7)' : 'rgba(248,113,113,0.7)' }}>
              📊 กำไรสุทธิ
            </p>
            <p style={{ margin: '0 0 2px', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
              (รายรับ − รางจ่าย)
            </p>
            <p style={{ margin: 0, fontSize: '32px', fontWeight: 900,
              color: netProfit >= 0 ? '#c4b5fd' : '#f87171' }}>
              {netProfit >= 0 ? '' : '−'}{fmt(Math.abs(netProfit))}
            </p>
          </div>
        </div>

        {/* ── Winners detail ── */}
        {rounds.some(r => r.winners?.length > 0) && (
          <div style={{ borderRadius: '16px', padding: '16px 20px',
            border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: '14px' }}>🏆 รายชื่อผู้ชนะ</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {rounds.flatMap((rnd, ri) =>
                (rnd.winners || []).map((w, wi) => (
                  <div key={`${ri}-${wi}`} style={{ display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '6px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.05)', fontSize: '13px' }}>
                    <span style={{ color: '#c4b5fd', fontWeight: 700, minWidth: '44px' }}>รอบ {ri + 1}</span>
                    <span style={{ color: '#fbbf24', fontWeight: 700 }}>🏆</span>
                    <span style={{ fontWeight: 600, flex: 1 }}>{w.alias}</span>
                    {rnd.prize && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{rnd.prize}</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
