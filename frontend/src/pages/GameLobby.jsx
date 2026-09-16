import React, { useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const css = `
.gl-root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:#0A0F1A;color:#F8FAFC;min-height:100vh;}
.gl-topbar{display:flex;align-items:center;gap:12px;padding:14px 20px;background:#111827;border-bottom:1px solid #1F2937;position:sticky;top:0;z-index:20;}
.gl-logo{font-weight:800;font-size:18px;letter-spacing:1px;color:#FBBF24;}
.gl-back{background:none;border:none;cursor:pointer;color:#94A3B8;font-family:inherit;font-size:13px;}
.gl-body{max-width:900px;margin:0 auto;padding:24px 16px 40px;display:grid;grid-template-columns:1fr 320px;gap:20px;}
@media(max-width:700px){.gl-body{grid-template-columns:1fr;}}
.gl-card{background:#111827;border-radius:16px;padding:20px;border:1px solid #1F2937;}
.gl-h2{font-size:16px;font-weight:700;margin:0 0 16px;color:#FBBF24;}
.gl-input{width:100%;padding:10px 12px;background:#1F2937;border:1px solid #374151;border-radius:10px;color:#F8FAFC;font-family:inherit;font-size:13px;box-sizing:border-box;}
.gl-input:focus{outline:none;border-color:#FBBF24;}
.gl-btn{display:block;width:100%;padding:12px;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:.15s;}
.gl-btn-gold{background:linear-gradient(135deg,#FBBF24,#F59E0B);color:#0A0F1A;}
.gl-btn-gold:hover{box-shadow:0 4px 16px rgba(251,191,36,.4);}
.gl-btn-outline{background:transparent;border:1px solid #374151;color:#94A3B8;margin-bottom:8px;}
.gl-btn-outline:hover{border-color:#FBBF24;color:#F8FAFC;}
.gl-room{background:#1F2937;border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;border:1px solid #374151;cursor:pointer;transition:.15s;}
.gl-room:hover{border-color:#FBBF24;background:#263340;}
.gl-room-icon{font-size:24px;flex-shrink:0;}
.gl-room-info{flex:1;min-width:0;}
.gl-room-name{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.gl-room-sub{font-size:12px;color:#94A3B8;margin-top:2px;}
.gl-badge{font-size:11px;padding:3px 8px;border-radius:999px;font-weight:600;}
.gl-badge-green{background:#14532D;color:#4ADE80;}
.gl-badge-red{background:#450A0A;color:#EF4444;}
.gl-online-item{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1F2937;}
.gl-online-item:last-child{border-bottom:none;}
.gl-avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;flex-shrink:0;}
.gl-inv-btn{background:#1F2937;border:1px solid #374151;color:#94A3B8;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;transition:.15s;font-family:inherit;}
.gl-inv-btn:hover{border-color:#FBBF24;color:#FBBF24;}
.gl-toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#111827;border:1px solid #FBBF24;color:#FBBF24;padding:10px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:100;pointer-events:none;opacity:0;transition:opacity .25s;}
.gl-toast.show{opacity:1;}
.gl-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px;}
.gl-modal{background:#111827;border-radius:20px;padding:24px;width:100%;max-width:420px;border:1px solid #374151;}
.gl-label{font-size:12px;color:#94A3B8;font-weight:500;margin-bottom:6px;display:block;}
.gl-select{width:100%;padding:10px 12px;background:#1F2937;border:1px solid #374151;border-radius:10px;color:#F8FAFC;font-family:inherit;font-size:13px;margin-bottom:14px;}
.gl-select:focus{outline:none;border-color:#FBBF24;}
.gl-inv-notif{position:fixed;bottom:80px;right:16px;background:#111827;border:2px solid #FBBF24;border-radius:16px;padding:16px;min-width:280px;z-index:60;box-shadow:0 8px 32px rgba(0,0,0,.6);}
`;

const HUES = [210,280,330,155,22,240,0,40,170,310];
function tint(i){ return `hsl(${HUES[i%HUES.length]} 60% 45%)`; }
function initials(n){ return (n||'?').slice(0,2).toUpperCase(); }

export default function GameLobby() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [rooms, setRooms] = useState([]);
  const [onlineList, setOnlineList] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', quizId: '', maxPlayers: 4, timeLimit: 12 });
  const [invitation, setInvitation] = useState(null);
  const [toast, setToast] = useState('');
  const [leaderboard, setLeaderboard] = useState(null);
  const socketRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const sock = io(SOCKET_URL, { auth: { token } });
    socketRef.current = sock;

    sock.on('connect', () => sock.emit('game:get_rooms'));
    sock.on('game:rooms_updated', setRooms);
    sock.on('online_users', (list) => setOnlineList(list.filter(u => u.id !== user?.id)));
    sock.on('game:invitation', (inv) => setInvitation(inv));
    sock.on('game:room_joined', (room) => {
      navigate('/game/play', { state: { room, socketId: sock.id } });
    });
    sock.on('game:error', (msg) => showToast(msg));

    api.get('/game/quizzes').then(r => setQuizzes(r.data)).catch(() => {});
    api.get('/game/leaderboard').then(r => setLeaderboard(r.data)).catch(() => {});

    return () => sock.disconnect();
  }, []);

  const handleCreate = () => {
    if (!createForm.quizId) return showToast('กรุณาเลือกชุดคำถาม');
    socketRef.current?.emit('game:create_room', {
      name: createForm.name || `ห้องของ${user?.name}`,
      quizId: parseInt(createForm.quizId),
      maxPlayers: parseInt(createForm.maxPlayers),
      timeLimit: parseInt(createForm.timeLimit),
    });
    setShowCreate(false);
  };

  const handleJoin = (roomId) => {
    socketRef.current?.emit('game:join_room', { roomId });
  };

  const handleInvite = (targetUserId) => {
    if (!rooms.length) return showToast('สร้างห้องก่อน');
    socketRef.current?.emit('game:invite_user', { roomId: rooms.find(r => r.host === user?.name)?.id, targetUserId });
    showToast('ส่งคำเชิญแล้ว');
  };

  const handleAcceptInv = () => {
    if (invitation) socketRef.current?.emit('game:join_room', { roomId: invitation.roomId });
    setInvitation(null);
  };

  return (
    <div className="gl-root">
      <style>{css}</style>
      <div id="gl-toast" className={`gl-toast${toast?' show':''}`}>{toast}</div>

      <div className="gl-topbar">
        <button className="gl-back" onClick={() => navigate('/dashboard')}>← กลับ</button>
        <div className="gl-logo">⚔️ QUIZ RUMBLE</div>
        <div style={{flex:1}}/>
        <span style={{fontSize:12,color:'#94A3B8'}}>🟢 {onlineList.length + 1} ออนไลน์</span>
      </div>

      <div className="gl-body">
        {/* Left: room list */}
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <h2 style={{margin:0,fontSize:18,fontWeight:700}}>ห้องที่เปิดอยู่</h2>
            <button className="gl-btn gl-btn-gold" style={{width:'auto',padding:'10px 20px'}} onClick={() => setShowCreate(true)}>
              + สร้างห้อง
            </button>
          </div>

          {rooms.length === 0 ? (
            <div style={{textAlign:'center',padding:'48px 20px',color:'#94A3B8',fontSize:13}}>
              ยังไม่มีห้องที่เปิดอยู่<br/>
              <button className="gl-btn gl-btn-gold" style={{width:'auto',padding:'10px 24px',marginTop:16}} onClick={() => setShowCreate(true)}>
                สร้างห้องแรก
              </button>
            </div>
          ) : (
            rooms.map(room => (
              <div key={room.id} className="gl-room" onClick={() => handleJoin(room.id)}>
                <div className="gl-room-icon">🏟️</div>
                <div className="gl-room-info">
                  <div className="gl-room-name">{room.name}</div>
                  <div className="gl-room-sub">โดย {room.host} · {room.quizTitle} · ⏱️ {room.timeLimit || 12}s</div>
                </div>
                <span className={`gl-badge ${room.playerCount >= room.maxPlayers ? 'gl-badge-red' : 'gl-badge-green'}`}>
                  {room.playerCount}/{room.maxPlayers}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Right: online users */}
        <div>
          <div className="gl-card">
            <div className="gl-h2">👥 ผู้เล่นออนไลน์</div>
            {onlineList.length === 0 ? (
              <div style={{color:'#94A3B8',fontSize:12,textAlign:'center',padding:'16px 0'}}>ไม่มีผู้เล่นอื่นออนไลน์</div>
            ) : (
              onlineList.map((u, i) => (
                <div key={u.id} className="gl-online-item">
                  <div className="gl-avatar" style={{background:tint(i)}}>{initials(u.name)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600}}>{u.name}</div>
                    <div style={{fontSize:11,color:'#94A3B8'}}>{u.role}</div>
                  </div>
                  <button className="gl-inv-btn" onClick={() => handleInvite(u.id)}>เชิญ</button>
                </div>
              ))
            )}
          </div>

          {/* อันดับ + อัตราชนะ/แพ้ */}
          <div className="gl-card" style={{marginTop:14}}>
            <div className="gl-h2">🏆 อันดับนักสู้</div>
            {leaderboard?.me && (
              <div style={{
                display:'flex',alignItems:'center',gap:8,background:'rgba(251,191,36,.1)',
                border:'1px solid rgba(251,191,36,.3)',borderRadius:10,padding:'8px 10px',marginBottom:10,
              }}>
                <span style={{fontSize:13,fontWeight:800,color:'#FBBF24'}}>
                  {leaderboard.me.rank ? `#${leaderboard.me.rank}` : '—'}
                </span>
                <span style={{flex:1,fontSize:12,fontWeight:600}}>คุณ</span>
                <span style={{fontSize:11,color:'#94A3B8'}}>
                  <b style={{color:'#22C55E'}}>{leaderboard.me.wins}</b>
                  {' / '}
                  <b style={{color:'#EF4444'}}>{leaderboard.me.losses}</b>
                </span>
                <span style={{fontSize:11,fontWeight:800,color:'#FBBF24',fontFamily:'Consolas,monospace'}}>
                  {leaderboard.me.winRate}%
                </span>
              </div>
            )}
            {!leaderboard?.rows?.length ? (
              <div style={{color:'#94A3B8',fontSize:12,textAlign:'center',padding:'16px 0'}}>ยังไม่มีสถิติการแข่งขัน</div>
            ) : leaderboard.rows.slice(0,8).map((r, i) => (
              <div key={r.userId} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0'}}>
                <span style={{width:24,fontSize:12,fontWeight:800,color:r.rank<=3?'#FBBF24':'#64748B',flexShrink:0}}>
                  {r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':`#${r.rank}`}
                </span>
                <div className="gl-avatar" style={{background:tint(i),width:26,height:26,fontSize:10}}>{initials(r.name)}</div>
                <div style={{flex:1,minWidth:0,fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {r.name}
                </div>
                <span style={{fontSize:11,color:'#94A3B8',flexShrink:0}}>
                  <b style={{color:'#22C55E'}}>{r.wins}</b>{' / '}<b style={{color:'#EF4444'}}>{r.losses}</b>
                </span>
                <span style={{
                  fontSize:11,fontWeight:800,flexShrink:0,minWidth:36,textAlign:'right',
                  fontFamily:'Consolas,monospace',
                  color: r.winRate>=60?'#4ADE80':r.winRate>=40?'#FBBF24':'#F87171',
                }}>{r.winRate}%</span>
              </div>
            ))}
          </div>

          <div className="gl-card" style={{marginTop:14}}>
            <div className="gl-h2">📖 วิธีเล่น</div>
            <ul style={{margin:0,paddingLeft:18,color:'#94A3B8',fontSize:12,lineHeight:1.9}}>
              <li>สร้างห้องและเลือกชุดคำถาม</li>
              <li>เชิญเพื่อนหรือรอให้มี 2+ คน</li>
              <li>ตอบคำถามเร็วยิ่งได้ multiplier สูง</li>
              <li>เลือกท่าโจมตีใส่คู่ต่อสู้</li>
              <li>ใครเลือด HP หมดก่อนแพ้!</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Create room modal */}
      {showCreate && (
        <div className="gl-modal-bg" onClick={() => setShowCreate(false)}>
          <div className="gl-modal" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <h2 style={{margin:0,fontSize:16,fontWeight:700}}>⚔️ สร้างห้องใหม่</h2>
              <button onClick={() => setShowCreate(false)} style={{background:'none',border:'none',color:'#94A3B8',cursor:'pointer',fontSize:18}}>✕</button>
            </div>

            <label className="gl-label">ชื่อห้อง</label>
            <input className="gl-input" style={{marginBottom:14}} placeholder={`ห้องของ${user?.name}`}
              value={createForm.name} onChange={e => setCreateForm(f => ({...f, name: e.target.value}))}/>

            <label className="gl-label">ชุดคำถาม *</label>
            <select className="gl-select" value={createForm.quizId}
              onChange={e => setCreateForm(f => ({...f, quizId: e.target.value}))}>
              <option value="">-- เลือกชุดคำถาม --</option>
              {quizzes.map(q => (
                <option key={q.id} value={q.id}>{q.title} ({q._count.questions} ข้อ)</option>
              ))}
            </select>

            <label className="gl-label">จำนวนผู้เล่นสูงสุด</label>
            <select className="gl-select" value={createForm.maxPlayers}
              onChange={e => setCreateForm(f => ({...f, maxPlayers: e.target.value}))}>
              <option value="2">2 คน</option>
              <option value="3">3 คน</option>
              <option value="4">4 คน</option>
            </select>

            <label className="gl-label">⏱️ เวลาตอบต่อข้อ</label>
            <select className="gl-select" value={createForm.timeLimit}
              onChange={e => setCreateForm(f => ({...f, timeLimit: e.target.value}))}>
              <option value="5">5 วินาที (โหดมาก)</option>
              <option value="10">10 วินาที (เร็ว)</option>
              <option value="12">12 วินาที (มาตรฐาน)</option>
              <option value="20">20 วินาที (สบาย ๆ)</option>
              <option value="30">30 วินาที (คิดนาน)</option>
              <option value="60">60 วินาที (ไม่เร่ง)</option>
            </select>

            <button className="gl-btn gl-btn-gold" onClick={handleCreate}>สร้างห้องและรอผู้เล่น</button>
            <button className="gl-btn gl-btn-outline" style={{marginTop:8}} onClick={() => setShowCreate(false)}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Invitation notification */}
      {invitation && (
        <div className="gl-inv-notif">
          <div style={{fontWeight:700,marginBottom:6}}>📨 คำเชิญจาก {invitation.fromUser}</div>
          <div style={{fontSize:13,color:'#94A3B8',marginBottom:12}}>{invitation.roomName}</div>
          <div style={{display:'flex',gap:8}}>
            <button className="gl-btn gl-btn-gold" style={{padding:'8px 0'}} onClick={handleAcceptInv}>ตอบรับ</button>
            <button className="gl-btn gl-btn-outline" style={{padding:'8px 0',margin:0}} onClick={() => setInvitation(null)}>ปฏิเสธ</button>
          </div>
        </div>
      )}
    </div>
  );
}
