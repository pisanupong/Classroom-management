import React, { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';

/* ════════════════════════════════════════════════
   STICKMAN SVG FIGHTER
════════════════════════════════════════════════ */
const Stickman = ({ color='#a78bfa', state='idle', flip=false, hp=100, maxHp=100, name='', combo=0 }) => {
  const hpPct = Math.max(0, hp / maxHp * 100);
  const hpColor = hpPct > 60 ? '#10b981' : hpPct > 30 ? '#f59e0b' : '#ef4444';

  const bodyStyle = {
    filter: state==='hit' ? 'brightness(2) hue-rotate(0deg)' : state==='dead' ? 'grayscale(1) opacity(0.4)' : 'none',
    animation: state==='idle' ? 'smIdle 2s ease-in-out infinite'
      : state==='attack' ? 'smAttack 0.4s ease-out'
      : state==='hit'    ? 'smHit 0.35s ease-out'
      : state==='win'    ? 'smWin 0.6s ease-in-out infinite alternate'
      : 'none',
  };

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,minWidth:160}}>
      {/* Name + Combo */}
      <div style={{textAlign:'center'}}>
        <p style={{fontFamily:'"Press Start 2P",monospace',fontSize:9,color:'#ffe000',marginBottom:3,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</p>
        {combo >= 2 && (
          <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:8,color:'#ff6600',
            animation:'comboFlash 0.3s ease-out',
            textShadow:'0 0 10px #ff6600'}}>
            🔥 {combo}x COMBO!
          </div>
        )}
      </div>

      {/* HP Bar */}
      <div style={{width:140,height:12,background:'rgba(0,0,0,0.5)',borderRadius:6,border:'2px solid rgba(255,255,255,0.1)',overflow:'hidden',position:'relative'}}>
        <div style={{height:'100%',width:`${hpPct}%`,background:hpColor,transition:'width 0.5s ease',borderRadius:4}}/>
        <span style={{position:'absolute',top:0,left:0,right:0,textAlign:'center',fontFamily:'"Press Start 2P",monospace',fontSize:6,color:'#fff',lineHeight:'12px'}}>{hp}/{maxHp}</span>
      </div>

      {/* Stickman SVG */}
      <div style={{transform:flip?'scaleX(-1)':'none', ...bodyStyle}}>
        <svg width={90} height={140} viewBox="0 0 90 140" style={{overflow:'visible'}}>
          {/* Shadow */}
          <ellipse cx={45} cy={136} rx={22} ry={5} fill="rgba(0,0,0,0.3)"/>

          {/* Body glow when attacking */}
          {state==='attack' && <ellipse cx={45} cy={70} rx={35} ry={50} fill={`${color}22`}/>}

          {/* Head */}
          <circle cx={45} cy={20} r={16} fill="none" stroke={color} strokeWidth={4}/>
          {/* Eyes */}
          <circle cx={40} cy={18} r={2.5} fill={state==='dead'?'#666':color}/>
          <circle cx={50} cy={18} r={2.5} fill={state==='dead'?'#666':color}/>
          {/* Mouth */}
          {state==='dead'
            ? <path d="M 39 25 Q 45 22 51 25" stroke={color} strokeWidth={2} fill="none"/>
            : state==='win'
            ? <path d="M 38 24 Q 45 30 52 24" stroke={color} strokeWidth={2} fill="none"/>
            : state==='hit'
            ? <path d="M 40 26 L 50 26" stroke={color} strokeWidth={2}/>
            : <path d="M 38 25 Q 45 28 52 25" stroke={color} strokeWidth={2} fill="none"/>}

          {/* Neck + Body */}
          <line x1={45} y1={36} x2={45} y2={80} stroke={color} strokeWidth={4} strokeLinecap="round"/>

          {/* Arms — attack pose vs idle */}
          {state==='attack' ? (
            <>
              <line x1={45} y1={50} x2={75} y2={30} stroke={color} strokeWidth={4} strokeLinecap="round"/>
              <line x1={75} y1={30} x2={85} y2={18} stroke={color} strokeWidth={3} strokeLinecap="round"/>
              <line x1={45} y1={50} x2={20} y2={68} stroke={color} strokeWidth={4} strokeLinecap="round"/>
            </>
          ) : state==='hit' ? (
            <>
              <line x1={45} y1={50} x2={18} y2={34} stroke={color} strokeWidth={4} strokeLinecap="round"/>
              <line x1={45} y1={50} x2={22} y2={72} stroke={color} strokeWidth={4} strokeLinecap="round"/>
            </>
          ) : state==='win' ? (
            <>
              <line x1={45} y1={50} x2={15} y2={28} stroke={color} strokeWidth={4} strokeLinecap="round"/>
              <line x1={15} y1={28} x2={8} y2={16} stroke={color} strokeWidth={3} strokeLinecap="round"/>
              <line x1={45} y1={50} x2={72} y2={64} stroke={color} strokeWidth={4} strokeLinecap="round"/>
            </>
          ) : (
            <>
              <line x1={45} y1={50} x2={18} y2={62} stroke={color} strokeWidth={4} strokeLinecap="round"/>
              <line x1={45} y1={50} x2={72} y2={62} stroke={color} strokeWidth={4} strokeLinecap="round"/>
            </>
          )}

          {/* Legs */}
          {state==='attack' ? (
            <>
              <line x1={45} y1={80} x2={28} y2={112} stroke={color} strokeWidth={4} strokeLinecap="round"/>
              <line x1={28} y1={112} x2={20} y2={132} stroke={color} strokeWidth={4} strokeLinecap="round"/>
              <line x1={45} y1={80} x2={65} y2={108} stroke={color} strokeWidth={4} strokeLinecap="round"/>
              <line x1={65} y1={108} x2={75} y2={128} stroke={color} strokeWidth={4} strokeLinecap="round"/>
            </>
          ) : (
            <>
              <line x1={45} y1={80} x2={30} y2={110} stroke={color} strokeWidth={4} strokeLinecap="round"/>
              <line x1={30} y1={110} x2={22} y2={132} stroke={color} strokeWidth={4} strokeLinecap="round"/>
              <line x1={45} y1={80} x2={60} y2={110} stroke={color} strokeWidth={4} strokeLinecap="round"/>
              <line x1={60} y1={110} x2={68} y2={132} stroke={color} strokeWidth={4} strokeLinecap="round"/>
            </>
          )}

          {/* Hit spark */}
          {state==='hit' && (
            <g>
              {[0,45,90,135,180,225,270,315].map((deg,i) => (
                <line key={i}
                  x1={45} y1={70}
                  x2={45 + Math.cos(deg*Math.PI/180)*28}
                  y2={70 + Math.sin(deg*Math.PI/180)*28}
                  stroke="#ff6600" strokeWidth={2} opacity={0.8}/>
              ))}
            </g>
          )}

          {/* Stars when dead */}
          {state==='dead' && [0,1,2].map(i => (
            <text key={i} x={25+i*20} y={8} fontSize={12} style={{animation:`floatStar ${0.8+i*0.3}s ease-out infinite`}}>⭐</text>
          ))}
        </svg>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════
   DAMAGE FLOAT TEXT
════════════════════════════════════════════════ */
const DmgFloat = ({ dmg, combo, side }) => (
  <div style={{
    position:'absolute', [side==='left'?'left':'right']:20, top:'30%',
    pointerEvents:'none', zIndex:100, textAlign:'center',
    animation:'dmgFloat 1.2s ease-out forwards',
  }}>
    <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:combo>2?22:16,
      color:combo>3?'#ff3300':combo>1?'#ff8800':'#ffcc00',
      textShadow:`0 0 20px ${combo>2?'#ff3300':'#ff8800'}`,
    }}>-{dmg}</div>
    {combo > 1 && <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:9,color:'#ff6600',marginTop:4}}>COMBO×{combo}!</div>}
  </div>
);

/* ════════════════════════════════════════════════
   MAIN BATTLE GAME
════════════════════════════════════════════════ */
const BattleGame = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate  = useNavigate();
  const socketRef = useRef(null);

  const [battle,    setBattle]    = useState(null);
  const [phase,     setPhase]     = useState('loading'); // loading|waiting|fighting|result
  const [question,  setQuestion]  = useState(null);      // { question, questionType, hint, questionIdx, total }
  const [answer,    setAnswer]    = useState('');
  const [feedback,  setFeedback]  = useState(null);      // { correct, answer } shown briefly
  const [roundResult, setRoundResult] = useState(null);  // last round data
  const [myHp,      setMyHp]      = useState(100);
  const [oppHp,     setOppHp]     = useState(100);
  const [myCombo,   setMyCombo]   = useState(0);
  const [oppCombo,  setOppCombo]  = useState(0);
  const [myState,   setMyState]   = useState('idle');
  const [oppState,  setOppState]  = useState('idle');
  const [dmgFloat,  setDmgFloat]  = useState(null);
  const [winner,    setWinner]    = useState(null);
  const [timeLeft,  setTimeLeft]  = useState(null);
  const [opponentName, setOpponentName] = useState('คู่ต่อสู้');
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  const isChallenger = battle?.challenger_id === user?.id;
  const myColor  = isChallenger ? '#a78bfa' : '#34d399';
  const oppColor = isChallenger ? '#34d399' : '#a78bfa';

  // Load battle info
  useEffect(() => {
    api.get(`/vocab/battles/${id}`).then(res => {
      setBattle(res.data);
      const opp = res.data.challenger_id === user?.id ? res.data.opponent : res.data.challenger;
      setOpponentName(opp?.name || 'คู่ต่อสู้');
      setMyHp(isChallenger ? res.data.challenger_hp : res.data.opponent_hp);
      setOppHp(isChallenger ? res.data.opponent_hp : res.data.challenger_hp);
      if (res.data.status === 'FINISHED') {
        setWinner(res.data.winner_id);
        setPhase('result');
      } else {
        setPhase('waiting');
      }
    }).catch(() => navigate('/vocab-battle'));
  }, [id]);

  // Socket.io
  useEffect(() => {
    if (!battle) return;
    const token = localStorage.getItem('token');
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('battle:join', { battleId: parseInt(id), userId: user.id });
    });

    socket.on('battle:player_joined', () => {
      setPhase('starting');
    });

    socket.on('battle:question', (data) => {
      setQuestion(data);
      setPhase('fighting');
      setAnswer('');
      setFeedback(null);
      setRoundResult(null);
      setMyState('idle');
      setOppState('idle');
      // Timer: 15 seconds per question
      setTimeLeft(15);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current); return 0; }
          return t - 1;
        });
      }, 1000);
      setTimeout(() => inputRef.current?.focus(), 100);
    });

    socket.on('battle:round_result', (data) => {
      clearInterval(timerRef.current);
      setRoundResult(data);
      const iWon = data.winnerId === user.id;

      if (iWon) {
        setMyState('attack');
        setOppState('hit');
        setMyCombo(data.combo);
        setOppCombo(0);
        setDmgFloat({ dmg: data.damage, combo: data.combo, side: isChallenger ? 'right' : 'left' });
      } else {
        setOppState('attack');
        setMyState('hit');
        setOppCombo(data.combo);
        setMyCombo(0);
        setDmgFloat({ dmg: data.damage, combo: data.combo, side: isChallenger ? 'left' : 'right' });
      }

      setMyHp(isChallenger ? data.challengerHp : data.opponentHp);
      setOppHp(isChallenger ? data.opponentHp  : data.challengerHp);
      setFeedback({ correct: iWon, answer: data.answer, word: data.word });

      setTimeout(() => setDmgFloat(null), 1200);
      setTimeout(() => { setMyState('idle'); setOppState('idle'); }, 1000);
    });

    socket.on('battle:wrong', () => {
      setFeedback({ correct: false });
      setAnswer('');
      setTimeout(() => setFeedback(null), 600);
    });

    socket.on('battle:end', (data) => {
      setWinner(data.winnerId);
      setPhase('result');
      const iWon = data.winnerId === user.id;
      setMyState(iWon ? 'win' : 'dead');
      setOppState(iWon ? 'dead' : 'win');
      clearInterval(timerRef.current);
    });

    return () => {
      socket.disconnect();
      clearInterval(timerRef.current);
    };
  }, [battle]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!answer.trim() || phase !== 'fighting') return;
    socketRef.current?.emit('battle:answer', { battleId: parseInt(id), answer: answer.trim() });
    setAnswer('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  if (phase === 'loading') return (
    <div className="fixed inset-0 flex items-center justify-center" style={{background:'#0f0c29'}}>
      <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:12,color:'#ffe000',animation:'blink 0.5s infinite'}}>LOADING...</div>
    </div>
  );

  return (
    <div className="fixed inset-0 overflow-hidden" style={{background:'linear-gradient(180deg,#0a0020 0%,#1a0030 30%,#0f0030 60%,#000818 100%)'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        @keyframes smIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes smAttack{0%{transform:translateX(0) scale(1)}30%{transform:translateX(30px) scale(1.15)}60%{transform:translateX(15px)}100%{transform:translateX(0) scale(1)}}
        @keyframes smHit{0%{transform:translateX(0)}20%{transform:translateX(-20px) rotate(-8deg)}60%{transform:translateX(8px)}100%{transform:translateX(0)}}
        @keyframes smWin{0%{transform:translateY(0) rotate(-5deg)}100%{transform:translateY(-12px) rotate(5deg)}}
        @keyframes dmgFloat{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(1.4)}}
        @keyframes floatStar{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-20px)}}
        @keyframes comboFlash{0%{transform:scale(1.4)}100%{transform:scale(1)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes timerPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
        @keyframes bgFight{0%,100%{background-position:0 0}50%{background-position:4px 4px}}
        @keyframes slideIn{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>

      {/* VS Stars Background */}
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 100%,rgba(124,58,237,0.3) 0%,transparent 70%)',pointerEvents:'none'}}/>

      {/* Header */}
      <div style={{position:'relative',zIndex:20,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 16px',background:'rgba(0,0,0,0.6)',borderBottom:'2px solid rgba(124,58,237,0.4)'}}>
        <button onClick={()=>navigate('/vocab-battle')} style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#606080',background:'none',border:'none',cursor:'pointer'}}>◄ ออก</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:10,color:'#ffe000',letterSpacing:2}}>⚔️ VOCAB BATTLE</div>
          {question && <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#8060ff',marginTop:2}}>รอบ {question.questionIdx}/{question.total}</div>}
        </div>
        {/* Timer */}
        {timeLeft !== null && phase === 'fighting' && (
          <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:14,
            color:timeLeft<=5?'#ef4444':'#ffe000',
            animation:timeLeft<=5?'timerPulse 0.5s infinite':'none',
            textShadow:timeLeft<=5?'0 0 10px #ef4444':'none'}}>
            {timeLeft}
          </div>
        )}
      </div>

      {/* Arena */}
      <div style={{position:'relative',flex:1,display:'flex',flexDirection:'column',height:'calc(100% - 120px)'}}>

        {/* Fighters */}
        <div style={{display:'flex',justifyContent:'space-around',alignItems:'flex-end',padding:'20px 10px 10px',flex:1,position:'relative'}}>
          {/* Damage floats */}
          {dmgFloat && <DmgFloat {...dmgFloat}/>}

          {/* My fighter (left) */}
          <Stickman color={myColor} state={myState} flip={false}
            hp={myHp} maxHp={100} name={user?.name||'คุณ'} combo={myCombo}/>

          {/* VS */}
          <div style={{textAlign:'center',flexShrink:0}}>
            {phase==='waiting'||phase==='starting' ? (
              <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:14,color:'#ffe000',animation:'blink 1s infinite'}}>
                {phase==='waiting'?'รอคู่ต่อสู้...':'พร้อม!'}
              </div>
            ) : (
              <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:18,color:'#ef4444',textShadow:'0 0 20px #ef4444'}}>VS</div>
            )}
          </div>

          {/* Opponent (right) */}
          <Stickman color={oppColor} state={oppState} flip={true}
            hp={oppHp} maxHp={100} name={opponentName} combo={oppCombo}/>
        </div>

        {/* Ground line */}
        <div style={{height:3,background:'linear-gradient(90deg,transparent,rgba(124,58,237,0.6),rgba(239,68,68,0.6),transparent)',margin:'0 20px'}}/>

        {/* Question + Input Area */}
        <div style={{padding:'12px 16px',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(10px)',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          {phase==='fighting' && question && (
            <div style={{animation:'slideIn 0.3s ease-out'}}>
              {/* Question type label */}
              <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#8060ff',textAlign:'center',marginBottom:6}}>
                {question.questionType==='translate'?'📖 แปลคำศัพท์นี้':'🔤 คำใดมีความหมายว่า'}
              </div>

              {/* The word */}
              <div style={{textAlign:'center',marginBottom:10}}>
                <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:22,color:'#ffe000',
                  textShadow:'0 0 20px rgba(255,224,0,0.5)',marginBottom:4}}>
                  {question.question}
                </div>
                {question.hint && (
                  <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#606080'}}>
                    💡 {question.hint}
                  </div>
                )}
              </div>

              {/* Round result feedback */}
              {roundResult && (
                <div style={{
                  textAlign:'center',marginBottom:8,
                  fontFamily:'"Press Start 2P",monospace',fontSize:9,
                  color: feedback?.correct ? '#10b981' : '#ef4444',
                  animation:'slideIn 0.2s ease-out',
                }}>
                  {feedback?.correct ? `✅ ถูก! คำตอบ: ${roundResult.answer}` : `❌ ${roundResult.winnerId!==user?.id?`${opponentName} ตอบถูก!`:''} คำตอบ: ${roundResult.answer}`}
                </div>
              )}

              {/* Wrong feedback */}
              {feedback && !feedback.correct && !roundResult && (
                <div style={{textAlign:'center',color:'#ef4444',fontFamily:'"Press Start 2P",monospace',fontSize:9,marginBottom:8}}>❌ ผิด!</div>
              )}

              {/* Input */}
              <div style={{display:'flex',gap:8,maxWidth:500,margin:'0 auto'}}>
                <input ref={inputRef}
                  value={answer} onChange={e=>setAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={question.questionType==='translate'?'พิมพ์คำแปลที่นี่...':'พิมพ์คำศัพท์...'}
                  style={{
                    flex:1,padding:'10px 14px',
                    fontFamily:'"Press Start 2P",monospace',fontSize:11,
                    background: feedback?.correct===false && !roundResult ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
                    border: `2px solid ${feedback?.correct===false && !roundResult ? '#ef4444' : 'rgba(124,58,237,0.4)'}`,
                    borderRadius:8,color:'#fff',outline:'none',
                    transition:'all 0.2s',
                  }}
                  disabled={!!roundResult}
                  autoComplete="off" autoFocus
                />
                <button onClick={handleSubmit} disabled={!answer.trim()||!!roundResult}
                  style={{
                    padding:'10px 20px',fontFamily:'"Press Start 2P",monospace',fontSize:11,
                    background:'linear-gradient(135deg,#7c3aed,#6d28d9)',
                    border:'none',borderRadius:8,color:'#fff',cursor:'pointer',
                    opacity:!answer.trim()||!!roundResult?0.4:1,
                  }}>
                  ⚔️
                </button>
              </div>
            </div>
          )}

          {phase==='waiting' && (
            <div style={{textAlign:'center',padding:20}}>
              <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:10,color:'#8060ff',marginBottom:8,animation:'blink 1.2s infinite'}}>⏳ รอคู่ต่อสู้เข้าร่วม...</div>
              <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:7,color:'#404060'}}>แชร์ลิงก์หน้านี้ให้คู่ต่อสู้</div>
            </div>
          )}
        </div>
      </div>

      {/* Result Overlay */}
      {phase==='result' && (
        <div style={{
          position:'absolute',inset:0,zIndex:100,display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',
          background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',
        }}>
          <div style={{textAlign:'center',animation:'slideIn 0.4s ease-out'}}>
            <div style={{fontSize:64,marginBottom:8}}>
              {winner===user?.id ? '🏆' : '💀'}
            </div>
            <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:20,
              color:winner===user?.id?'#ffe000':'#ef4444',
              textShadow:`0 0 30px ${winner===user?.id?'#ffe000':'#ef4444'}`,
              marginBottom:8, letterSpacing:3}}>
              {winner===user?.id ? 'VICTORY!' : 'DEFEAT...'}
            </div>
            <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:9,color:'#8060ff',marginBottom:24}}>
              {winner===user?.id ? `คุณชนะ ${opponentName}!` : `${opponentName} ชนะ`}
            </div>
            <div style={{display:'flex',gap:12,justifyContent:'center'}}>
              <button onClick={()=>navigate('/vocab-battle')}
                style={{fontFamily:'"Press Start 2P",monospace',fontSize:9,padding:'10px 20px',
                  background:'linear-gradient(135deg,#7c3aed,#6d28d9)',border:'none',
                  borderRadius:8,color:'#fff',cursor:'pointer'}}>
                ← กลับ
              </button>
              <button onClick={()=>window.location.reload()}
                style={{fontFamily:'"Press Start 2P",monospace',fontSize:9,padding:'10px 20px',
                  background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',
                  borderRadius:8,color:'#fff',cursor:'pointer'}}>
                🔄 รีแมทช์
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BattleGame;
