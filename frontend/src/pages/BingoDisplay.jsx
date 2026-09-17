/**
 * BingoDisplay — หน้าโฆษณา/โปรเจกเตอร์ สำหรับแสดงให้นักเรียนในห้องเห็น
 * Public page (ไม่ต้อง login) — เปิดบนจอโปรเจกเตอร์ควบคู่กับ BingoHost
 * URL: /bingo/display/:id
 */
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

const BINGO_COL = ['B', 'I', 'N', 'G', 'O'];
const colOf = (n) => {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
};

const COL_COLOR = { B: '#60a5fa', I: '#34d399', N: '#fbbf24', G: '#f87171', O: '#c084fc' };

const PATTERN_LABEL = {
  line:    'เส้นตรง',
  full:    'เต็มบอร์ด',
  corners: '4 มุม',
  T:       'ตัว T',
  L:       'ตัว L',
};

/* ─ tiny keyframe injection ─ */
const STYLES = `
@keyframes popIn {
  0%   { transform: scale(0.4) rotate(-8deg); opacity: 0; }
  70%  { transform: scale(1.15) rotate(2deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); }
}
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ticker {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 30px rgba(167,139,250,0.4); }
  50%       { box-shadow: 0 0 60px rgba(167,139,250,0.8), 0 0 100px rgba(124,58,237,0.4); }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
`;

export default function BingoDisplay() {
  const { id } = useParams();
  const socketRef = useRef(null);

  const [room,        setRoom]        = useState(null);
  const [rounds,      setRounds]      = useState([]);
  const [drawn,       setDrawn]       = useState([]);
  const [lastDrawn,   setLastDrawn]   = useState(null);
  const [activeRound, setActiveRound] = useState(null);
  const [phase,       setPhase]       = useState('waiting'); // waiting | active | round_end | game_end
  const [winners,     setWinners]     = useState([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [animKey,     setAnimKey]     = useState(0); // force re-mount to trigger popIn

  const playerUrl = `${window.location.origin}/bingo/play/${id}`;

  /* ── Load room info ── */
  useEffect(() => {
    api.get(`/bingo/rooms/${id}`).then(r => {
      setRoom(r.data);
      setRounds(r.data.rounds || []);
      const active = (r.data.rounds || []).find(rnd => rnd.status === 'active');
      if (active) {
        setActiveRound(active);
        setDrawn(active.drawn_numbers || []);
        if (active.drawn_numbers?.length > 0) {
          setLastDrawn(active.drawn_numbers[active.drawn_numbers.length - 1]);
          setPhase('active');
        }
      }
    }).catch(console.error);
  }, [id]);

  /* ── Socket (no auth — public display) ── */
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: {}, transports: ['websocket'],
    });
    socketRef.current = socket;
    socket.emit('bingo:join_room', { roomId: id, alias: 'DISPLAY' });

    socket.on('bingo:player_count', ({ count }) => setPlayerCount(count));

    socket.on('bingo:number_drawn', ({ number, drawn: d }) => {
      setDrawn(d);
      setLastDrawn(number);
      setAnimKey(k => k + 1); // re-trigger pop animation
      setPhase('active');
    });

    socket.on('bingo:round_started', ({ round }) => {
      setActiveRound(round);
      setDrawn([]);
      setLastDrawn(null);
      setWinners([]);
      setPhase('active');
    });

    socket.on('bingo:round_ended', () => {
      setPhase('round_end');
    });

    socket.on('bingo:winner', (w) => {
      setWinners(prev => [...prev, w]);
    });

    socket.on('bingo:game_ended', () => {
      setPhase('game_end');
      socket.disconnect();
    });

    return () => socket.disconnect();
  }, [id]);

  /* ── Helpers ── */
  const activeRoundIdx = rounds.findIndex(r => r.id === activeRound?.id);

  /* ══════════════════════════════════════════
     WAITING phase — QR code big on screen
  ══════════════════════════════════════════ */
  if (phase === 'waiting' || !activeRound) {
    const firstRound = rounds[0];
    return (
      <div style={{
        minHeight: '100dvh', background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontFamily: "'Segoe UI',sans-serif", padding: '24px', gap: '0',
        position: 'relative', overflow: 'hidden',
      }}>
        <style>{STYLES}</style>

        {/* Background pattern */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px', pointerEvents: 'none' }} />

        {/* Top: room name */}
        <div style={{ textAlign: 'center', marginBottom: '28px', animation: 'fadeSlideUp 0.6s ease' }}>
          <div style={{ fontSize: 'clamp(40px,6vw,72px)', fontWeight: 900, letterSpacing: '-2px',
            background: 'linear-gradient(90deg,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            BINGO!
          </div>
          {room?.name && (
            <div style={{ fontSize: 'clamp(18px,3vw,32px)', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
              {room.name}
            </div>
          )}
        </div>

        {/* QR Code */}
        <div style={{ padding: '20px', borderRadius: '24px', background: '#fff',
          boxShadow: '0 0 60px rgba(167,139,250,0.5)', marginBottom: '24px',
          animation: 'glowPulse 2s ease-in-out infinite' }}>
          <QRCodeSVG value={playerUrl} size={Math.min(window.innerWidth * 0.35, 280)} />
        </div>

        {/* Scan instruction */}
        <div style={{ textAlign: 'center', animation: 'fadeSlideUp 0.8s ease' }}>
          <p style={{ fontSize: 'clamp(16px,2.5vw,24px)', fontWeight: 700, color: '#c4b5fd', margin: '0 0 4px' }}>
            📱 สแกน QR เพื่อรับใบ Bingo
          </p>
          <p style={{ fontSize: 'clamp(11px,1.5vw,14px)', color: 'rgba(255,255,255,0.3)', margin: 0 }}>{playerUrl}</p>
        </div>

        {/* Round info row */}
        {firstRound && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center',
            marginTop: '28px', animation: 'fadeSlideUp 1s ease' }}>
            <div style={{ padding: '8px 18px', borderRadius: '999px', fontSize: 'clamp(12px,1.8vw,16px)', fontWeight: 700,
              background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.5)' }}>
              รอบ 1/{rounds.length}
            </div>
            <div style={{ padding: '8px 18px', borderRadius: '999px', fontSize: 'clamp(12px,1.8vw,16px)', fontWeight: 700,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {PATTERN_LABEL[firstRound.pattern] || firstRound.pattern}
            </div>
            {firstRound.prize && (
              <div style={{ padding: '8px 18px', borderRadius: '999px', fontSize: 'clamp(12px,1.8vw,16px)', fontWeight: 700,
                background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24' }}>
                🎁 {firstRound.prize}
              </div>
            )}
          </div>
        )}

        {/* Prize image */}
        {firstRound?.prize_image && (
          <div style={{ marginTop: '20px', textAlign: 'center', animation: 'fadeSlideUp 1.2s ease' }}>
            <img src={firstRound.prize_image} alt="รางวัล"
              style={{ maxHeight: '120px', maxWidth: '300px', objectFit: 'contain', borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              onError={e => { e.target.style.display = 'none'; }} />
          </div>
        )}

        {/* Player count */}
        {playerCount > 0 && (
          <div style={{ position: 'absolute', top: '16px', right: '20px',
            padding: '6px 14px', borderRadius: '999px', fontSize: '14px', fontWeight: 700,
            background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399',
            animation: 'blink 2s infinite' }}>
            👥 {playerCount} ออนไลน์
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════
     GAME_END phase
  ══════════════════════════════════════════ */
  if (phase === 'game_end') {
    return (
      <div style={{ minHeight: '100dvh', background: 'linear-gradient(135deg,#0f172a,#1e1b4b)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontFamily: "'Segoe UI',sans-serif", textAlign: 'center', padding: '24px' }}>
        <style>{STYLES}</style>
        <div style={{ fontSize: '80px', marginBottom: '12px' }}>🏆</div>
        <h1 style={{ fontSize: 'clamp(36px,6vw,72px)', fontWeight: 900, margin: '0 0 8px',
          background: 'linear-gradient(90deg,#fbbf24,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          เกมจบแล้ว!
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '20px' }}>ขอบคุณทุกคนที่เข้าร่วม</p>
      </div>
    );
  }

  /* ══════════════════════════════════════════
     ACTIVE / ROUND_END phase — main display
  ══════════════════════════════════════════ */
  const colColor = lastDrawn ? COL_COLOR[colOf(lastDrawn)] : '#a78bfa';

  return (
    <div style={{
      minHeight: '100dvh', background: 'linear-gradient(135deg,#0a0f1e 0%,#1e1b4b 60%,#0a0f1e 100%)',
      color: '#fff', fontFamily: "'Segoe UI',sans-serif",
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <style>{STYLES}</style>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', flexShrink: 0,
      }}>
        {/* Left: room name + round */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 900, fontSize: 'clamp(16px,2.5vw,24px)', color: '#a78bfa' }}>🎱 BINGO</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <span style={{ fontWeight: 600, fontSize: 'clamp(13px,2vw,18px)', color: 'rgba(255,255,255,0.8)' }}>
            {room?.name}
          </span>
        </div>

        {/* Center: round + pattern */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {activeRound?.is_golden && (
            <span style={{ padding: '3px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 800,
              background: 'linear-gradient(90deg,#f59e0b,#ef4444)', animation: 'blink 1s infinite' }}>
              ⚡ รอบทองคำ!
            </span>
          )}
          <span style={{ padding: '4px 14px', borderRadius: '999px', fontSize: 'clamp(12px,1.8vw,16px)', fontWeight: 700,
            background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.5)' }}>
            รอบ {activeRoundIdx + 1}/{rounds.length}
          </span>
          {activeRound?.pattern && (
            <span style={{ padding: '4px 14px', borderRadius: '999px', fontSize: 'clamp(11px,1.5vw,14px)', fontWeight: 600,
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
              {PATTERN_LABEL[activeRound.pattern] || activeRound.pattern}
            </span>
          )}
        </div>

        {/* Right: drawn count + player count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>สุ่มไปแล้ว</p>
            <p style={{ margin: 0, fontSize: 'clamp(16px,2.5vw,22px)', fontWeight: 900, color: '#c4b5fd', lineHeight: 1 }}>
              {drawn.length}<span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>/75</span>
            </p>
          </div>
          {playerCount > 0 && (
            <div style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 700,
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', color: '#34d399' }}>
              👥 {playerCount}
            </div>
          )}
        </div>
      </div>

      {/* ── Main body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Left: Big number + BINGO columns ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '16px', gap: '20px', minWidth: 0 }}>

          {/* Round ended overlay */}
          {phase === 'round_end' && (
            <div style={{ marginBottom: '8px', padding: '10px 28px', borderRadius: '16px',
              background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
              fontSize: 'clamp(16px,2.5vw,24px)', fontWeight: 800, color: '#fbbf24',
              animation: 'blink 1.2s infinite' }}>
              🏁 รอบนี้จบแล้ว
            </div>
          )}

          {/* BIG last drawn number */}
          {lastDrawn ? (
            <div key={animKey} style={{
              textAlign: 'center', animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}>
              <div style={{ fontSize: 'clamp(12px,2vw,18px)', fontWeight: 600, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '4px' }}>
                ตัวเลขล่าสุด
              </div>
              {/* Letter */}
              <div style={{ fontSize: 'clamp(60px,10vw,120px)', fontWeight: 900, lineHeight: 0.85,
                color: colColor, textShadow: `0 0 60px ${colColor}80` }}>
                {colOf(lastDrawn)}
              </div>
              {/* Divider */}
              <div style={{ width: '3px', height: 'clamp(40px,6vw,70px)', background: `linear-gradient(to bottom,transparent,${colColor},transparent)`,
                margin: '4px auto' }} />
              {/* Number */}
              <div style={{ fontSize: 'clamp(80px,14vw,180px)', fontWeight: 900, lineHeight: 0.85,
                color: '#fff', textShadow: `0 0 80px ${colColor}60, 0 4px 30px rgba(0,0,0,0.5)` }}>
                {lastDrawn}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)',
              fontSize: 'clamp(20px,4vw,48px)', fontWeight: 700 }}>
              {phase === 'active' ? '🎲 รอสุ่มตัวเลข...' : '⏳ รอเริ่มรอบ'}
            </div>
          )}

          {/* BINGO column display */}
          <div style={{ display: 'flex', gap: 'clamp(6px,1vw,16px)', marginTop: '8px' }}>
            {BINGO_COL.map(col => {
              const colDrawn = drawn.filter(n => colOf(n) === col);
              return (
                <div key={col} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  minWidth: 'clamp(44px,7vw,80px)',
                }}>
                  <div style={{ fontWeight: 900, fontSize: 'clamp(16px,2.5vw,30px)',
                    color: COL_COLOR[col], marginBottom: '6px' }}>{col}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center', width: '100%' }}>
                    {colDrawn.length === 0
                      ? <div style={{ fontSize: 'clamp(10px,1.4vw,16px)', color: 'rgba(255,255,255,0.12)', padding: '4px 0' }}>—</div>
                      : colDrawn.map(n => (
                        <div key={n} style={{
                          width: '100%', textAlign: 'center', padding: 'clamp(2px,0.4vw,6px) 0',
                          borderRadius: '8px', fontWeight: 800, fontSize: 'clamp(12px,1.8vw,22px)',
                          background: n === lastDrawn ? COL_COLOR[col] : `${COL_COLOR[col]}22`,
                          color: n === lastDrawn ? '#000' : COL_COLOR[col],
                          border: `1px solid ${COL_COLOR[col]}44`,
                          animation: n === lastDrawn ? 'popIn 0.4s ease' : undefined,
                        }}>
                          {n}
                        </div>
                      ))
                    }
                  </div>
                </div>
              );
            })}
          </div>

          {/* Winners section */}
          {winners.length > 0 && (
            <div style={{ padding: '10px 20px', borderRadius: '16px', textAlign: 'center',
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)',
              animation: 'fadeSlideUp 0.5s ease' }}>
              <p style={{ margin: '0 0 6px', fontSize: '14px', color: 'rgba(251,191,36,0.6)' }}>🏆 ผู้ชนะ</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {winners.map((w, i) => (
                  <span key={i} style={{ padding: '4px 14px', borderRadius: '999px', fontWeight: 700,
                    fontSize: 'clamp(14px,2vw,20px)', background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                    🥇 {w.alias}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar: Prize image + QR (small) ── */}
        <div style={{ width: 'clamp(160px,20vw,260px)', flexShrink: 0,
          borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '16px', gap: '16px' }}>

          {/* Prize image */}
          {activeRound?.prize_image ? (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'rgba(251,191,36,0.5)',
                textTransform: 'uppercase', letterSpacing: '1px' }}>🎁 ของรางวัล</p>
              <img src={activeRound.prize_image} alt="รางวัล"
                style={{ maxWidth: '100%', maxHeight: 'clamp(80px,15vw,160px)', objectFit: 'contain',
                  borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                onError={e => { e.target.style.display = 'none'; }} />
              {activeRound.prize && (
                <p style={{ margin: '8px 0 0', fontWeight: 700, fontSize: 'clamp(13px,1.8vw,18px)',
                  color: '#fbbf24', textAlign: 'center' }}>{activeRound.prize}</p>
              )}
            </div>
          ) : activeRound?.prize ? (
            <div style={{ textAlign: 'center', padding: '12px 16px', borderRadius: '14px',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', width: '100%' }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', color: 'rgba(251,191,36,0.5)' }}>🎁 ของรางวัล</p>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 'clamp(14px,2vw,20px)', color: '#fbbf24' }}>
                {activeRound.prize}
              </p>
            </div>
          ) : null}

          {/* Divider */}
          <div style={{ width: '60%', height: '1px', background: 'rgba(255,255,255,0.08)' }} />

          {/* Small QR — for latecomers */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px', fontSize: '10px', color: 'rgba(255,255,255,0.25)',
              textTransform: 'uppercase', letterSpacing: '1px' }}>สแกนเพื่อเล่น</p>
            <div style={{ display: 'inline-block', padding: '8px', borderRadius: '10px', background: '#fff' }}>
              <QRCodeSVG value={playerUrl} size={Math.min(window.innerWidth * 0.1, 100)} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom ticker: drawn numbers in order ── */}
      {drawn.length > 0 && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
          padding: '8px 0', overflow: 'hidden', flexShrink: 0,
        }}>
          {/* Duplicate the list to create seamless loop */}
          <div style={{
            display: 'flex', gap: '12px', alignItems: 'center',
            animation: `ticker ${Math.max(drawn.length * 1.8, 10)}s linear infinite`,
            width: 'max-content',
          }}>
            {[...drawn, ...drawn].map((n, i) => {
              const c = colOf(n);
              return (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  padding: '3px 12px', borderRadius: '999px', fontWeight: 700,
                  fontSize: 'clamp(12px,1.6vw,16px)', whiteSpace: 'nowrap',
                  background: n === lastDrawn && i < drawn.length ? COL_COLOR[c] : `${COL_COLOR[c]}22`,
                  color: n === lastDrawn && i < drawn.length ? '#000' : COL_COLOR[c],
                  border: `1px solid ${COL_COLOR[c]}44`,
                }}>
                  {c}-{n}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
