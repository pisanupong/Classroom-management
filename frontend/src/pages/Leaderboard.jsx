import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/* ── constants ── */
const ROW_H = 58, GAP = 8, STEP = ROW_H + GAP;
const HUES = [268,330,200,155,22,290,240,350,180,45,60,310,170,40,280,320];
const TIER = { 1:'#FFC93C', 2:'#D6DCE8', 3:'#E08A4A' };

function tint(idx){ return `hsl(${HUES[idx % HUES.length]} 62% 46%)`; }
function initials(name){ return (name||'?').slice(0,2).toUpperCase(); }

/* ── Laurel SVG (React) ── */
function Laurel({ color, op, size = 100 }) {
  const parts = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 7; i++) {
      const a = side * (38 + i * 17);
      const sz = 5.2 - i * 0.25;
      parts.push(
        <g key={`${side}${i}`} transform={`rotate(${a} 50 50)`}>
          <ellipse cx="50" cy="9" rx={sz} ry={sz * 2.1}
            fill={color} opacity={op} transform={`rotate(${side * 22} 50 9)`}/>
        </g>
      );
    }
  }
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true"
      style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
      {parts}
    </svg>
  );
}

/* ── Medal SVG ── */
function Medal({ color }) {
  return (
    <svg viewBox="0 0 32 32" style={{width:26,height:26,flexShrink:0}} aria-hidden="true">
      <path d="M11 3 L14 14 L18 14 L21 3" stroke={color} strokeWidth="2.4" fill="none" opacity=".55"/>
      <circle cx="16" cy="21" r="8" fill="none" stroke={color} strokeWidth="2.2"/>
      <circle cx="16" cy="21" r="4" fill={color} opacity=".35"/>
    </svg>
  );
}

/* ── Avatar ── */
function Avatar({ name, idx, size = 46, fontSize = 15 }) {
  return (
    <span style={{
      width:size, height:size, borderRadius:'50%',
      background:tint(idx), display:'grid', placeItems:'center',
      fontSize, fontWeight:700, color:'#fff',
      border:'2px solid rgba(255,255,255,0.22)', flexShrink:0,
    }}>
      {initials(name)}
    </span>
  );
}

/* ── Podium ── */
function Podium({ players }) {
  if (!players.length) return null;
  const slots  = [players[1], players[0], players[2]];
  const places = [2, 1, 3];
  const hts    = [128, 150, 118];
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1.1fr 1fr',gap:8,alignItems:'end',margin:'0 2px 22px'}}>
      {slots.map((p, k) => {
        if (!p) return <div key={k}/>;
        const pl = places[k];
        const c  = TIER[pl];
        const hi = hts[pl - 1];
        const idx = players.indexOf(p);
        return (
          <div key={k} style={{
            height:hi, borderRadius:18, padding:'12px 8px 14px',
            textAlign:'center', display:'flex', flexDirection:'column',
            alignItems:'center', gap:6,
            background: pl===1
              ? 'linear-gradient(180deg,#4A2680 0%,#341A61 100%)'
              : 'rgba(51,25,95,.85)',
            border:`1px solid ${pl===1?'rgba(255,201,60,.45)':'rgba(255,255,255,.08)'}`,
          }}>
            {/* crest */}
            <span style={{position:'relative',width:74,height:74,display:'grid',placeItems:'center'}}>
              <Laurel color={c} op={pl===1?.95:.6}/>
              <span style={{position:'relative',zIndex:1}}>
                <Avatar name={p.name} idx={idx} size={pl===1?52:46} fontSize={pl===1?17:15}/>
                <span style={{
                  position:'absolute',bottom:-4,left:'50%',transform:'translateX(-50%)',
                  minWidth:20,height:20,padding:'0 6px',borderRadius:999,
                  fontSize:10.5,fontWeight:700,display:'grid',placeItems:'center',
                  color:'#2A1550',background:c,border:'2px solid #33195F',
                }}>{pl}</span>
              </span>
            </span>
            <span style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100%'}}>
              {(p.name||'').split(' ')[0]}
            </span>
            <span style={{fontSize:12.5,fontWeight:700,color:TIER[1],letterSpacing:'.01em'}}>
              {p.total_points} pt
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Animated Row ── */
function LeaderRow({ player, rank, idx, prev, total, highlight }) {
  const moved = prev !== undefined ? prev - rank : 0;
  const pct   = total > 0 ? Math.round(player.total_points / total * 100) : 0;
  const medalC = TIER[rank + 1] || '#6D5A96';

  return (
    <button
      style={{
        position:'absolute', left:2, right:2,
        height:ROW_H, transform:`translateY(${rank * STEP}px)`,
        display:'flex', alignItems:'center', gap:11,
        padding:'0 12px 0 10px', borderRadius:18,
        background: highlight ? 'rgba(74,222,128,.10)' : 'rgba(51,25,95,.85)',
        border: highlight ? '1px solid rgba(74,222,128,.5)' : '1px solid rgba(255,255,255,.08)',
        cursor:'default', font:'inherit', color:'inherit',
        textAlign:'left', width:'calc(100% - 4px)', overflow:'hidden',
        transition:'transform .6s cubic-bezier(.2,.85,.25,1),background .4s,border-color .4s',
      }}>
      {/* progress fill */}
      <span style={{
        position:'absolute',left:0,top:0,bottom:0,
        width:`${pct}%`,background:'rgba(139,92,246,.18)',
        transition:'width .6s cubic-bezier(.2,.85,.25,1)',
        pointerEvents:'none',
      }}/>
      {/* rank number */}
      <span style={{
        position:'relative',flexShrink:0,width:20,textAlign:'center',
        fontSize:12,fontWeight:600,color:'rgba(124,103,168,.9)',
      }}>{rank + 1}</span>
      {/* avatar */}
      <Avatar name={player.name} idx={idx} size={38} fontSize={13}/>
      {/* name + score */}
      <span style={{flex:1,minWidth:0,position:'relative'}}>
        <b style={{display:'block',fontSize:12.5,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {player.name}
        </b>
        <i style={{display:'block',fontStyle:'normal',fontSize:11,fontWeight:600,color:TIER[1],marginTop:1}}>
          {player.total_points} pt
        </i>
      </span>
      {/* rank change */}
      <span style={{
        flexShrink:0,fontSize:10.5,fontWeight:600,width:30,textAlign:'right',
        color: moved > 0 ? '#4ADE80' : moved < 0 ? '#FB7185' : 'rgba(124,103,168,.7)',
      }}>
        {moved === 0 ? '–' : (moved > 0 ? `↑${moved}` : `↓${Math.abs(moved)}`)}
      </span>
      {/* medal */}
      <Medal color={medalC}/>
    </button>
  );
}

/* ── Congrats Card ── */
function CongratsCard({ winner, winnerIdx }) {
  if (!winner) return (
    <div style={{textAlign:'center',padding:'40px 20px',color:'rgba(164,143,208,.6)',fontSize:13}}>
      ยังไม่มีข้อมูล
    </div>
  );
  return (
    <div style={{textAlign:'center',padding:'8px 6px 0'}}>
      <div style={{fontSize:30,lineHeight:1,marginBottom:-10,position:'relative',zIndex:2}}>👑</div>
      {/* hero circle */}
      <div style={{position:'relative',width:150,height:150,margin:'0 auto 18px',display:'grid',placeItems:'center'}}>
        <Laurel color="#FFC93C" op={0.95}/>
        <span style={{
          position:'relative',zIndex:1,
          width:96,height:96,borderRadius:'50%',background:tint(winnerIdx),
          display:'grid',placeItems:'center',fontSize:32,fontWeight:700,color:'#fff',
          border:'3px solid rgba(255,255,255,.22)',
        }}>
          {initials(winner.name)}
        </span>
      </div>
      <h2 style={{margin:'0 0 6px',fontSize:20,fontWeight:700}}>Congratulation!</h2>
      <p style={{fontSize:14,fontWeight:600,margin:'0 0 4px',color:'rgba(238,232,255,.9)'}}>
        {winner.name}
      </p>
      <p style={{fontSize:22,fontWeight:700,color:'#FFC93C',margin:'0 0 2px'}}>
        {winner.total_points} pt
      </p>
      <p style={{fontSize:11.5,color:'#4ADE80',margin:'0 0 22px',fontWeight:500}}>ผู้นำคนปัจจุบัน</p>
      <button style={{
        display:'block',width:'100%',fontSize:13,fontWeight:600,padding:'13px 0',
        borderRadius:999,border:0,cursor:'pointer',marginBottom:10,color:'#fff',
        background:'linear-gradient(90deg,#8B5CF6,#E94FA1)',fontFamily:'inherit',
      }}>กลับหน้าหลัก</button>
      <button style={{
        display:'block',width:'100%',fontSize:13,fontWeight:600,padding:'13px 0',
        borderRadius:999,cursor:'pointer',marginBottom:0,color:'rgba(164,143,208,.8)',
        background:'transparent',border:'1px solid rgba(255,255,255,.16)',fontFamily:'inherit',
      }}>แชร์ผลอันดับ</button>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════ */
const Leaderboard = () => {
  const navigate = useNavigate();
  const [players, setPlayers]   = useState([]);
  const [prevRanks, setPrevRanks] = useState({});
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState(0);
  const [highlight, setHighlight] = useState(null);
  const prevPtsRef = useRef({});

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/leaderboard');
      const sorted = [...res.data].sort((a, b) => b.total_points - a.total_points);

      // track rank changes
      setPlayers(prev => {
        const oldRanks = {};
        prev.forEach((p, i) => { oldRanks[p.id] = i; });
        setPrevRanks(oldRanks);
        return sorted;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15000);
    return () => clearInterval(t);
  }, [fetchData]);

  const maxPts = players.length ? players[0].total_points : 1;
  const winner = players[0] || null;

  const css = `
    .lb-root{--void:#1B0E33;--deep:#2A1550;--card:rgba(51,25,95,.85);--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.16);--ink:#FFFFFF;--dim:#A48FD0;--brass:#FFC93C;--hot:#E94FA1;--violet:#8B5CF6;--lime:#4ADE80;font-family:"Poppins","Noto Sans Thai",system-ui,sans-serif;color:var(--ink);min-height:100vh;background:radial-gradient(120% 90% at 50% 0%,#4B2A7A 0%,#241143 55%,#160A2B 100%);padding:0;}
    .lb-topbar{display:flex;align-items:center;gap:16px;padding:14px 22px;border-bottom:1px solid var(--line);background:rgba(27,14,51,.9);position:sticky;top:0;z-index:20;backdrop-filter:blur(8px);}
    .lb-back{background:none;border:none;cursor:pointer;color:var(--dim);font-family:inherit;font-size:13px;}
    .lb-back:hover{color:#fff;}
    .lb-title{flex:1;text-align:center;font-size:16px;font-weight:700;background:linear-gradient(90deg,var(--violet),var(--hot));-webkit-background-clip:text;background-clip:text;color:transparent;}
    .lb-refresh{background:none;border:1px solid var(--line);color:var(--dim);font-family:inherit;font-size:12px;padding:6px 14px;border-radius:999px;cursor:pointer;}
    .lb-refresh:hover{border-color:var(--line2);color:#fff;}
    .lb-stage{display:flex;gap:26px;justify-content:center;align-items:flex-start;flex-wrap:wrap;padding:28px 20px 40px;max-width:900px;margin:0 auto;}
    .lb-phone{width:340px;background:linear-gradient(180deg,#33195F 0%,#22103F 40%,#1B0E33 100%);border-radius:38px;padding:14px 14px 20px;border:1px solid var(--line2);box-shadow:0 30px 70px rgba(0,0,0,.5);flex:none;}
    .lb-status{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--dim);padding:2px 8px 12px;font-weight:500;}
    .lb-nav{display:flex;align-items:center;justify-content:space-between;padding:0 6px 16px;}
    .lb-nav h1{margin:0;font-size:15px;font-weight:600;}
    .lb-icn{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.07);border:1px solid var(--line);display:grid;place-items:center;color:var(--dim);font-size:13px;}
    .lb-tabs{display:flex;gap:6px;background:rgba(0,0,0,.28);padding:5px;border-radius:999px;margin:0 4px 20px;}
    .lb-tab{flex:1;font:inherit;font-size:12px;font-weight:500;padding:9px 0;border:0;border-radius:999px;background:transparent;color:var(--dim);cursor:pointer;transition:background .25s,color .25s;}
    .lb-tab.on{background:var(--hot);color:#fff;box-shadow:0 6px 18px rgba(233,79,161,.4);}
    .lb-seclabel{display:flex;justify-content:space-between;align-items:center;padding:0 6px;margin-bottom:10px;}
    .lb-seclabel span{font-size:12px;font-weight:600;}
    .lb-seclabel em{font-style:normal;font-size:11px;color:var(--dim);}
    @media(max-width:760px){.lb-phone{width:100%;max-width:360px}}
  `;

  return (
    <div className="lb-root">
      <style>{css}</style>

      {/* Topbar */}
      <div className="lb-topbar">
        <button className="lb-back" onClick={() => navigate('/dashboard')}>← Dashboard</button>
        <div className="lb-title">🏆 Leaderboard</div>
        <button className="lb-refresh" onClick={fetchData}>↻ รีเฟรช</button>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:'80px 20px',color:'var(--dim)'}}>กำลังโหลด...</div>
      ) : (
        <div className="lb-stage">

          {/* ── Left: Congrats card ── */}
          <div className="lb-phone">
            <div className="lb-status"><span>9:41</span><span>▮▮▮ ▮</span></div>
            <CongratsCard winner={winner} winnerIdx={0}/>
          </div>

          {/* ── Right: Leaderboard ── */}
          <div className="lb-phone">
            <div className="lb-status"><span>9:41</span><span>▮▮▮ ▮</span></div>
            <div className="lb-nav">
              <div className="lb-icn">‹</div>
              <h1>Leaderboard</h1>
              <div className="lb-icn">≡</div>
            </div>

            {/* Tabs */}
            <div className="lb-tabs" role="tablist">
              {['ห้องเรียน','ชั้นปี','ทั้งโรงเรียน'].map((label, i) => (
                <button key={i} role="tab" className={`lb-tab${tab===i?' on':''}`}
                  onClick={() => setTab(i)}>{label}</button>
              ))}
            </div>

            {/* Podium */}
            <Podium players={players.slice(0, 3)}/>

            {/* Section label */}
            <div className="lb-seclabel">
              <span>อันดับทั้งหมด</span>
              <em>ทั้งหมด {players.length} คน</em>
            </div>

            {/* Animated list */}
            <div style={{
              position:'relative',
              height: players.length * STEP - GAP,
              margin:'0 2px',
            }}>
              {players.map((p, i) => (
                <LeaderRow
                  key={p.id}
                  player={p}
                  rank={i}
                  idx={i}
                  prev={prevRanks[p.id]}
                  total={maxPts}
                  highlight={highlight === p.id}
                />
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default Leaderboard;
