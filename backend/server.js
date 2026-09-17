const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const prisma = require('./config/db');

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ['GET', 'POST'] },
});

const port = process.env.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json());
app.use((req, res, next) => { console.log(`[REQ] ${req.method} ${req.path}`); next(); });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later' },
});
app.use('/api/users/login', loginLimiter);

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: 'Too many accounts created, please try again later' },
});
app.use('/api/users/register', registerLimiter);

// บันทึกประวัติการใช้งาน — ต้องอยู่ก่อน routes เพื่อให้ res.on('finish') เห็น req.user ที่ protect ใส่ไว้
const { activityLogger } = require('./middleware/activityLogger');
app.use('/api', activityLogger);

// Routes
app.use('/api/users',          require('./routes/userRoutes'));
app.use('/api/assignments',    require('./routes/assignmentRoutes'));
app.use('/api/events',         require('./routes/eventRoutes'));
app.use('/api/daily-homework', require('./routes/dailyHomeworkRoutes'));
app.use('/api/admin',          require('./routes/adminRoutes'));
app.use('/api/dashboard',      require('./routes/dashboardRoutes'));
app.use('/api/quiz',           require('./routes/quizRoutes'));
app.use('/api/chat',           require('./routes/chatRoutes'));
app.use('/api/treasury',       require('./routes/treasuryRoutes'));
app.use('/api/rewards',        require('./routes/rewardRoutes'));
app.use('/api/vocab',          require('./routes/vocabRoutes'));
app.use('/api/subjects',       require('./routes/subjectRoutes'));
app.use('/api/settings',      require('./routes/settingRoutes'));
app.use('/api/upload',        require('./routes/uploadRoutes'));
app.use('/api/line',          require('./routes/lineRoutes'));
app.use('/api/pet',           require('./routes/petRoutes'));
app.use('/api/game',          require('./routes/gameRoutes'));
app.use('/api/python',        require('./routes/pythonRoutes'));
app.use('/api/activity',      require('./routes/activityRoutes'));
app.use('/api/practice',      require('./routes/practiceRoutes'));
app.use('/api/bingo',         require('./routes/bingoRoutes'));

// Serve uploaded files as static assets
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.get('/', (req, res) => res.send('Classroom Management API is running...'));
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ── Socket.io realtime chat ──────────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, role: true, character_data: true },
    }).then(user => {
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    }).catch(next);
  } catch { next(new Error('Invalid token')); }
});

const onlineUsers = new Map(); // socketId → user

// ── QUIZ RUMBLE state ─────────────────────────────────────────────────────────
const gameRooms = {}; // roomId → GameRoom
let gameRoomCounter = 1;

function makeRoomId() { return `gr${gameRoomCounter++}`; }

function broadcastRoomList() {
  const list = Object.values(gameRooms)
    .filter(r => r.status === 'waiting')
    .map(r => ({
      id: r.id, name: r.name, host: r.host.name,
      playerCount: r.players.length, maxPlayers: r.maxPlayers,
      quizTitle: r.quizTitle, timeLimit: r.timeLimit,
    }));
  io.emit('game:rooms_updated', list);
}

// ── ของวิเศษ (เลือกได้ 1 อย่างก่อนเริ่มเกม) ──
const MAX_HP = 250;
const GR_ITEMS = {
  potion: { key: 'potion', label: 'ยาเพิ่มเลือด', emoji: '🧪', uses: 2, heal: 70,
            desc: 'ฟื้น HP 70 · ใช้ได้ 2 ครั้ง' },
  shield: { key: 'shield', label: 'เกราะป้องกัน', emoji: '🛡️', uses: 2,
            desc: 'กันการโจมตีทั้งหมด 2 ครั้ง (อัตโนมัติ)' },
  power:  { key: 'power',  label: 'ศิลาพลังโจมตี', emoji: '⚔️', uses: 0, dmgMul: 1.4,
            desc: 'ดาเมจ +40% ตลอดทั้งเกม' },
};

function pubPlayer(p) {
  return {
    id: p.id, name: p.name, hp: p.hp, maxHp: MAX_HP, energy: p.energy, character: p.character,
    item: p.item || null, itemUses: p.itemUses ?? 0, shieldUp: (p.item === 'shield' && (p.itemUses ?? 0) > 0),
  };
}

function getRoomPublic(r) {
  return {
    id: r.id, name: r.name, host: r.host,
    players: r.players.map(pubPlayer),
    maxPlayers: r.maxPlayers, status: r.status, quizTitle: r.quizTitle, quizId: r.quizId, timeLimit: r.timeLimit,
    currentQuestion: r.currentQuestion, questionIdx: r.questionIdx, totalQuestions: r.questions?.length || 0,
    scores: r.scores, phase: r.phase, maxHp: MAX_HP,
  };
}

const DEFAULT_TIME_LIMIT = 12;      // วินาทีต่อข้อ (host ตั้งได้ตอนสร้างห้อง)
const TIME_LIMIT_MIN = 5;
const TIME_LIMIT_MAX = 60;

async function grStartQuestion(roomId) {
  const room = gameRooms[roomId];
  if (!room || room.questionIdx >= room.questions.length) {
    // Game over
    grEndGame(roomId);
    return;
  }
  const q = room.questions[room.questionIdx];
  room.currentQuestion = { id: q.id, question: q.question_text, choices: q.choices };
  room.phase = 'question';
  room.answers = {}; // clear answers
  const timeLimit = room.timeLimit || DEFAULT_TIME_LIMIT;
  io.to(`game:${roomId}`).emit('game:question', {
    questionIdx: room.questionIdx,
    total: room.questions.length,
    question: q.question_text,
    choices: q.choices,
    timeLimit,
  });

  // Auto-timeout
  if (room.questionTimer) clearTimeout(room.questionTimer);
  room.questionTimer = setTimeout(() => grRevealAnswer(roomId), timeLimit * 1000 + 500);
}

async function grRevealAnswer(roomId) {
  const room = gameRooms[roomId];
  if (!room || room.phase !== 'question') return;
  clearTimeout(room.questionTimer);

  const q = room.questions[room.questionIdx];
  room.phase = 'eval';

  // Compute results for each player
  const playerResults = {};
  room.players.forEach(p => {
    const ans = room.answers[p.id];
    const correct = ans?.choice === q.correct_answer;
    const tl = room.timeLimit || DEFAULT_TIME_LIMIT;
    const responseTime = ans ? ans.time : tl;
    const norm = Math.max(0, Math.min(1, (tl - responseTime) / (tl - 0.8)));
    const mult = correct ? parseFloat((0.6 + norm * 1.4).toFixed(2)) : 0;
    const baseDmg = correct ? Math.max(1, Math.floor(10 * mult)) : 0;
    playerResults[p.id] = { correct, mult, baseDmg, responseTime: parseFloat(responseTime.toFixed(2)) };

    if (correct) {
      room.scores[p.id] = (room.scores[p.id] || 0) + Math.round(mult * 100);
      p.energy = Math.min(5, (p.energy || 0) + 1);
    }
  });
  room.evalResults = playerResults;
  const anyCorrectPre = Object.values(playerResults).some(r => r.correct);

  io.to(`game:${roomId}`).emit('game:eval', {
    correctAnswer: q.correct_answer,
    correctIndex: q.choices.indexOf(q.correct_answer),
    playerResults,
    scores: room.scores,
    revealMs: anyCorrectPre ? 4500 : 4000,
  });

  // โชว์เฉลยให้อ่านทัน แล้วค่อยเข้าช่วงเลือกท่า
  setTimeout(() => grStartAction(roomId), anyCorrectPre ? 4500 : 4000);
}

function grStartAction(roomId) {
  const room = gameRooms[roomId];
  if (!room) return;
  room.phase = 'action';
  room.actionsCast = {};

  io.to(`game:${roomId}`).emit('game:action_phase', {
    evalResults: room.evalResults,
    players: room.players.map(pubPlayer),
    scores: room.scores,
  });

  // Auto-resolve — ถ้าไม่มีใครตอบถูกเลย ไม่ต้องรอครบ 8 วิ ข้ามไปเลย
  const casters = Object.values(room.evalResults || {}).filter(r => r.correct && r.baseDmg > 0).length;
  if (room.actionTimer) clearTimeout(room.actionTimer);
  room.actionTimer = setTimeout(() => grResolveActions(roomId), casters ? 8000 : 1200);
}

function grResolveActions(roomId) {
  const room = gameRooms[roomId];
  if (!room || room.phase !== 'action') return;
  clearTimeout(room.actionTimer);
  room.phase = 'result';

  const ABILITY_POWER = [1.4, 1.1, 0, 1.3, 1.6, 0.9];
  const COMBO_BONUS = 1.8;

  // Calculate damage for each player that answered correctly
  const actionResults = [];
  room.players.forEach(p => {
    const evalRes = room.evalResults?.[p.id];
    if (!evalRes?.correct || evalRes.baseDmg === 0) return;

    const cast = room.actionsCast[p.id];
    const abilityIdx = cast?.abilityIdx ?? 0;
    const abilityPower = ABILITY_POWER[abilityIdx] || 1.0;
    if (abilityPower === 0) return; // Mana Surge — no damage

    // Auto-target: if no target chosen, pick first enemy
    let targetId = cast?.targetId || null;
    if (!targetId) {
      const enemy = room.players.find(x => x.id !== p.id && x.hp > 0);
      if (enemy) targetId = enemy.id;
    }

    const comboMult = COMBO_BONUS;
    const itemMul = p.item === 'power' ? GR_ITEMS.power.dmgMul : 1;   // ศิลาพลังโจมตี
    const finalDmg = Math.max(1, Math.floor(evalRes.baseDmg * abilityPower * comboMult * itemMul));

    // Apply damage to target — เกราะกันได้เต็มจำนวน
    let blocked = false;
    let dealt = finalDmg;
    if (targetId) {
      const target = room.players.find(x => x.id === targetId);
      if (target) {
        if (target.item === 'shield' && target.itemUses > 0) {
          target.itemUses -= 1;
          blocked = true;
          dealt = 0;
        } else {
          target.hp = Math.max(0, target.hp - finalDmg);
        }
      }
    }
    actionResults.push({
      casterId: p.id, targetId, damage: dealt, rawDamage: finalDmg, blocked,
      abilityPower, comboMult, itemMul, abilityIdx, empowered: itemMul > 1,
    });
  });

  io.to(`game:${roomId}`).emit('game:result', {
    actionResults,
    players: room.players.map(pubPlayer),
    scores: room.scores,
  });

  room.questionIdx++;

  // Check elimination or question limit
  const alive = room.players.filter(p => p.hp > 0);
  const gameOver = alive.length <= 1 || room.questionIdx >= room.questions.length;

  setTimeout(() => {
    if (gameOver) grEndGame(roomId);
    else grStartQuestion(roomId);
  }, actionResults.length ? 3000 : 1600);
}

function grEndGame(roomId) {
  const room = gameRooms[roomId];
  if (!room) return;
  room.phase = 'ended';

  // Winner = most score or last standing
  const sorted = [...room.players].sort((a, b) =>
    (b.hp > 0 ? 1 : 0) - (a.hp > 0 ? 1 : 0) || (room.scores[b.id] || 0) - (room.scores[a.id] || 0)
  );
  const winner = sorted[0];

  io.to(`game:${roomId}`).emit('game:ended', {
    winner: { id: winner.id, name: winner.name },
    players: room.players.map(p => ({ ...pubPlayer(p), score: room.scores[p.id] || 0 })),
    scores: room.scores,
    ranking: sorted.map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, score: room.scores[p.id] || 0, hp: p.hp })),
  });

  // Award points
  prisma.user.update({ where: { id: winner.id }, data: { total_points: { increment: 50 } } }).catch(() => {});

  // บันทึกสถิติ ชนะ/แพ้ (ใช้ตาราง BattleStats ร่วมกับ VOCAB BATTLE)
  room.players.forEach(p => {
    const won = p.id === winner.id;
    prisma.battleStats.upsert({
      where: { user_id: p.id },
      create: { user_id: p.id, wins: won ? 1 : 0, losses: won ? 0 : 1 },
      update: won ? { wins: { increment: 1 } } : { losses: { increment: 1 } },
    }).catch(() => {});
  });

  setTimeout(() => { delete gameRooms[roomId]; broadcastRoomList(); }, 30000);
}

// ── PET ARENA (PvP ผลัดกันโจมตี) ──────────────────────────────────────────────
const arenaRooms = {};        // roomId → ArenaRoom
let arenaCounter = 1;

const PET_STAGE_POWER = [
  { minXp: 0,    power: 0,   short: 'ไข่' },
  { minXp: 40,   power: 5,   short: 'แรกเกิด' },
  { minXp: 110,   power: 12,  short: 'เตาะแตะ' },
  { minXp: 230,  power: 24,  short: 'วัยเด็ก' },
  { minXp: 430,  power: 40,  short: 'รุ่นต้น' },
  { minXp: 760,  power: 65,  short: 'วัยรุ่น' },
  { minXp: 1300,  power: 95,  short: 'หนุ่มสาว' },
  { minXp: 2150, power: 140, short: 'โตเต็มวัย' },
  { minXp: 3500, power: 210, short: 'เชี่ยวชาญ' },
  { minXp: 5600, power: 320, short: 'ตำนาน' },
];
function petStage(xp) {
  for (let i = PET_STAGE_POWER.length - 1; i >= 0; i--) if (xp >= PET_STAGE_POWER[i].minXp) return PET_STAGE_POWER[i];
  return PET_STAGE_POWER[0];
}

// ตารางธาตุ: attacker → defender → ตัวคูณดาเมจ
const ELEM_CHART = {
  FIRE:  { GRASS: 1.5, WATER: 0.7, FIRE: 1, LIGHT: 1, DARK: 1 },
  WATER: { FIRE: 1.5, GRASS: 0.7, WATER: 1, LIGHT: 1, DARK: 1 },
  GRASS: { WATER: 1.5, FIRE: 0.7, GRASS: 1, LIGHT: 1, DARK: 1 },
  LIGHT: { DARK: 1.5, LIGHT: 0.8, FIRE: 1, WATER: 1, GRASS: 1 },
  DARK:  { LIGHT: 1.5, DARK: 0.8, FIRE: 1, WATER: 1, GRASS: 1 },
};
function elemMul(a, d) {
  if (!a || !d) return 1;
  return ELEM_CHART[a]?.[d] ?? 1;
}

const ARENA_MOVES = {
  strike: { key: 'strike', label: 'โจมตีปกติ',  emoji: '⚔️', mul: 1.0, acc: 0.95, desc: 'แม่นยำสูง เสียหายมาตรฐาน' },
  heavy:  { key: 'heavy',  label: 'ทุ่มพลัง',   emoji: '💥', mul: 1.85, acc: 0.62, desc: 'เสียหายสูงมาก แต่พลาดง่าย' },
  guard:  { key: 'guard',  label: 'ตั้งการ์ด',  emoji: '🛡️', mul: 0,   acc: 1,    desc: 'ลดดาเมจครั้งถัดไป 60% + ฟื้น HP' },
};
const ARENA_TURN_MS = 20000;

function arenaFighter(state, user) {
  const st = petStage(state?.xp || 0);
  const atkLv = state?.atk_lv || 1;
  const defLv = state?.def_lv || 1;
  const evaLv = state?.eva_lv || 1;
  const maxHp = 140 + Math.floor((state?.xp || 0) / 12) + atkLv * 10 + (defLv - 1) * 14;
  return {
    id: user.id,
    name: user.name,
    petName: state?.pet_name || 'สัตว์เลี้ยง',
    petType: state?.pet_type || 'CAT',
    element: state?.element || '',
    xp: state?.xp || 0,
    stage: st.short,
    atkLv, defLv, evaLv,
    basePower: Math.max(8, st.power) + atkLv * 6,
    // ป้องกัน: ลดดาเมจที่รับ (เพดาน 45%) · หลบหลีก: โอกาสหลบ (เพดาน 30%)
    defRate: Math.min(0.45, (defLv - 1) * 0.022),
    evaRate: Math.min(0.30, (evaLv - 1) * 0.014),
    maxHp, hp: maxHp,
    guard: false,
  };
}

function arenaPublic(r) {
  return {
    id: r.id, name: r.name, status: r.status,
    host: r.host, guest: r.guest,
    turn: r.turn, turnEndsAt: r.turnEndsAt,
    round: r.round, log: r.log.slice(-14),
    winner: r.winner || null,
  };
}

function arenaBroadcastList() {
  const list = Object.values(arenaRooms)
    .filter(r => r.status === 'waiting')
    .map(r => ({
      id: r.id, name: r.name,
      host: r.host.name, petName: r.host.petName,
      petType: r.host.petType, element: r.host.element,
      atkLv: r.host.atkLv, stage: r.host.stage,
    }));
  io.emit('arena:rooms_updated', list);
}

function arenaClearTimer(r) { if (r.timer) { clearTimeout(r.timer); r.timer = null; } }

function arenaStartTurn(roomId) {
  const r = arenaRooms[roomId];
  if (!r || r.status !== 'fighting') return;
  arenaClearTimer(r);
  r.turnEndsAt = Date.now() + ARENA_TURN_MS;
  io.to(`arena:${roomId}`).emit('arena:updated', arenaPublic(r));
  r.timer = setTimeout(() => {
    // หมดเวลา → โจมตีปกติอัตโนมัติ
    arenaResolve(roomId, r.turn, 'strike', true);
  }, ARENA_TURN_MS + 400);
}

function arenaResolve(roomId, actorId, moveKey, timedOut = false) {
  const r = arenaRooms[roomId];
  if (!r || r.status !== 'fighting' || r.turn !== actorId) return;
  const move = ARENA_MOVES[moveKey] || ARENA_MOVES.strike;
  arenaClearTimer(r);

  const me = r.host.id === actorId ? r.host : r.guest;
  const foe = r.host.id === actorId ? r.guest : r.host;
  if (!me || !foe) return;

  let event;
  if (move.key === 'guard') {
    me.guard = true;
    const healed = Math.min(me.maxHp - me.hp, Math.round(me.maxHp * 0.09));
    me.hp += healed;
    event = { type: 'guard', actorId, move: move.key, healed, timedOut };
    r.log.push(`🛡️ ${me.petName} ตั้งการ์ด${healed ? ` และฟื้น ${healed} HP` : ''}`);
  } else {
    const hit = Math.random() < move.acc;
    const dodged = hit && Math.random() < (foe.evaRate || 0);
    if (!hit || dodged) {
      event = { type: dodged ? 'dodge' : 'miss', actorId, targetId: foe.id, move: move.key, timedOut };
      r.log.push(dodged
        ? `💨 ${foe.petName} หลบ${move.label}ของ ${me.petName} ได้!`
        : `💨 ${me.petName} ใช้${move.label} แต่พลาด!`);
    } else {
      const em = elemMul(me.element, foe.element);
      const variance = 0.85 + Math.random() * 0.3;
      const crit = Math.random() < 0.12 + me.atkLv * 0.004;
      let dmg = Math.round(me.basePower * move.mul * em * variance * (crit ? 1.6 : 1));
      // ทักษะป้องกันของฝ่ายรับลดดาเมจลง
      const defCut = foe.defRate || 0;
      if (defCut > 0) dmg = Math.round(dmg * (1 - defCut));
      let blocked = false;
      if (foe.guard) { dmg = Math.round(dmg * 0.4); blocked = true; foe.guard = false; }
      dmg = Math.max(1, dmg);
      foe.hp = Math.max(0, foe.hp - dmg);
      event = { type: 'hit', actorId, targetId: foe.id, move: move.key, damage: dmg, crit, blocked, defCut, elemMul: em, timedOut };
      const tag = em > 1 ? ' (ธาตุได้เปรียบ!)' : em < 1 ? ' (ธาตุเสียเปรียบ)' : '';
      const dTag = defCut > 0 ? ` (เกราะ -${Math.round(defCut * 100)}%)` : '';
      r.log.push(`${move.emoji} ${me.petName} ใช้${move.label} → ${dmg} ดาเมจ${crit ? ' CRITICAL!' : ''}${blocked ? ' (ถูกการ์ด)' : ''}${dTag}${tag}`);
    }
    me.guard = false;
  }

  io.to(`arena:${roomId}`).emit('arena:action', event);

  if (foe.hp <= 0) return arenaEnd(roomId, me, foe);

  r.turn = foe.id;
  r.round += 1;
  setTimeout(() => arenaStartTurn(roomId), 900);
}

function arenaEnd(roomId, winner, loser) {
  const r = arenaRooms[roomId];
  if (!r) return;
  arenaClearTimer(r);
  r.status = 'ended';
  r.winner = { id: winner.id, name: winner.name, petName: winner.petName };
  r.log.push(`🏆 ${winner.petName} ชนะการประลอง!`);

  io.to(`arena:${roomId}`).emit('arena:ended', {
    winner: r.winner,
    host: r.host, guest: r.guest,
    log: r.log.slice(-14),
  });

  prisma.petState.update({ where: { user_id: winner.id }, data: { pvp_wins: { increment: 1 }, xp: { increment: 40 } } }).catch(() => {});
  // แพ้การประลอง → บาดเจ็บ (อาการบาดเจ็บเกิดจากการประลองเท่านั้น)
  prisma.petState.update({
    where: { user_id: loser.id },
    data: { pvp_losses: { increment: 1 }, xp: { increment: 12 }, health: 'injured' },
  }).catch(() => {});
  prisma.user.update({ where: { id: winner.id }, data: { total_points: { increment: 20 } } }).catch(() => {});

  setTimeout(() => { delete arenaRooms[roomId]; arenaBroadcastList(); }, 25000);
  arenaBroadcastList();
}

// ── VOCAB BATTLE state ────────────────────────────────────────────────────────
const battleRooms = {}; // { battleId: { players:{socketId→userId}, ready:Set, combo:{userId:n}, questionIdx:n, words:[], answered:bool } }
const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]; } return a; };
const normalize = s => {
  if (!s) return '';
  const base = s.toLowerCase().trim().replace(/\s+/g,' ');
  // strip common English plural/verb suffixes for flexible matching
  return base.replace(/ies$/, 'y').replace(/es$/, '').replace(/s$/, '');
};

io.on('connection', (socket) => {
  const user = socket.user;
  onlineUsers.set(socket.id, { id: user.id, name: user.name, role: user.role });
  io.emit('online_users', Array.from(onlineUsers.values()));

  // Join channel room
  socket.on('join_channel', (channelId) => {
    // Leave previous rooms except own socket room
    Array.from(socket.rooms).forEach(r => { if (r !== socket.id) socket.leave(r); });
    socket.join(`channel:${channelId}`);
  });

  // ── PET ARENA events ──────────────────────────────────────────────────────

  socket.on('arena:get_rooms', () => {
    socket.emit('arena:rooms_updated', Object.values(arenaRooms)
      .filter(r => r.status === 'waiting')
      .map(r => ({
        id: r.id, name: r.name, host: r.host.name, petName: r.host.petName,
        petType: r.host.petType, element: r.host.element, atkLv: r.host.atkLv, stage: r.host.stage,
      })));
  });

  socket.on('arena:create', async ({ name } = {}) => {
    try {
      const state = await prisma.petState.findUnique({ where: { user_id: user.id } });
      if (!state || !state.pet_type) return socket.emit('arena:error', 'ต้องมีสัตว์เลี้ยงก่อนจึงจะประลองได้');
      if ((state.xp || 0) < 40) return socket.emit('arena:error', 'สัตว์เลี้ยงต้องฟักออกจากไข่ก่อน (EXP 40)');
      if (state.health !== 'healthy') return socket.emit('arena:error', 'น้องยังไม่แข็งแรงพอจะประลอง');

      // ออกจากห้องเดิมถ้ามี
      Object.values(arenaRooms).forEach(r => {
        if (r.status === 'waiting' && r.host.id === user.id) { delete arenaRooms[r.id]; }
      });

      const id = `ar${arenaCounter++}`;
      const room = {
        id,
        name: (name || `สนามของ${user.name}`).slice(0, 40),
        status: 'waiting',
        host: arenaFighter(state, user),
        guest: null,
        turn: null, turnEndsAt: 0, round: 1,
        log: [], timer: null, winner: null,
      };
      arenaRooms[id] = room;
      socket.join(`arena:${id}`);
      socket.emit('arena:joined', arenaPublic(room));
      arenaBroadcastList();
    } catch (e) {
      socket.emit('arena:error', 'สร้างสนามไม่สำเร็จ');
    }
  });

  socket.on('arena:join', async ({ roomId }) => {
    try {
      const room = arenaRooms[roomId];
      if (!room) return socket.emit('arena:error', 'ไม่พบสนามนี้');
      if (room.status !== 'waiting') return socket.emit('arena:error', 'สนามนี้เริ่มไปแล้ว');
      if (room.host.id === user.id) return socket.emit('arena:error', 'คุณเป็นเจ้าของสนามนี้อยู่แล้ว');

      const state = await prisma.petState.findUnique({ where: { user_id: user.id } });
      if (!state || !state.pet_type) return socket.emit('arena:error', 'ต้องมีสัตว์เลี้ยงก่อนจึงจะประลองได้');
      if ((state.xp || 0) < 40) return socket.emit('arena:error', 'สัตว์เลี้ยงต้องฟักออกจากไข่ก่อน (EXP 40)');
      if (state.health !== 'healthy') return socket.emit('arena:error', 'น้องยังไม่แข็งแรงพอจะประลอง');

      room.guest = arenaFighter(state, user);
      room.status = 'fighting';
      // ใครพลังต่ำกว่าได้เริ่มก่อน (ชดเชยความเสียเปรียบ)
      room.turn = room.guest.basePower < room.host.basePower ? room.guest.id : room.host.id;
      room.log.push(`⚔️ ${room.host.petName} ปะทะ ${room.guest.petName}!`);

      socket.join(`arena:${roomId}`);
      io.to(`arena:${roomId}`).emit('arena:joined', arenaPublic(room));
      arenaBroadcastList();
      setTimeout(() => arenaStartTurn(roomId), 1200);
    } catch (e) {
      socket.emit('arena:error', 'เข้าสนามไม่สำเร็จ');
    }
  });

  socket.on('arena:attack', ({ roomId, move }) => {
    const room = arenaRooms[roomId];
    if (!room || room.status !== 'fighting') return;
    if (room.turn !== user.id) return socket.emit('arena:error', 'ยังไม่ถึงตาคุณ');
    arenaResolve(roomId, user.id, move);
  });

  socket.on('arena:leave', ({ roomId }) => {
    const room = arenaRooms[roomId];
    if (!room) return;
    socket.leave(`arena:${roomId}`);
    if (room.status === 'waiting' && room.host.id === user.id) {
      delete arenaRooms[roomId];
      return arenaBroadcastList();
    }
    if (room.status === 'fighting' && (room.host.id === user.id || room.guest?.id === user.id)) {
      // ยอมแพ้
      const winner = room.host.id === user.id ? room.guest : room.host;
      const loser = room.host.id === user.id ? room.host : room.guest;
      room.log.push(`🚪 ${loser.petName} ออกจากสนาม`);
      arenaEnd(roomId, winner, loser);
    }
  });

  // ── QUIZ RUMBLE events ────────────────────────────────────────────────────

  socket.on('game:get_rooms', () => {
    const list = Object.values(gameRooms)
      .filter(r => r.status === 'waiting')
      .map(r => ({ id: r.id, name: r.name, host: r.host.name, playerCount: r.players.length, maxPlayers: r.maxPlayers, quizTitle: r.quizTitle }));
    socket.emit('game:rooms_updated', list);
    socket.emit('online_users', Array.from(onlineUsers.values()));
  });

  socket.on('game:create_room', async ({ name, quizId, maxPlayers = 4, timeLimit }) => {
    try {
      const quiz = await prisma.quiz.findUnique({
        where: { id: parseInt(quizId) },
        include: { questions: { select: { id: true, question_text: true, choices: true, correct_answer: true } } },
      });
      if (!quiz) return socket.emit('game:error', 'ไม่พบชุดคำถาม');

      const roomId = makeRoomId();
      const room = {
        id: roomId, name: name || `ห้องของ${user.name}`,
        host: { id: user.id, name: user.name },
        players: [{
          id: user.id, name: user.name, hp: MAX_HP, energy: 0,
          character: user.character_data,
          item: null, itemUses: 0,
        }],
        maxPlayers: Math.min(maxPlayers, 4),
        timeLimit: Math.max(TIME_LIMIT_MIN, Math.min(TIME_LIMIT_MAX,
          Math.floor(Number(timeLimit)) || DEFAULT_TIME_LIMIT)),
        status: 'waiting',
        quizId: quiz.id, quizTitle: quiz.title,
        questions: shuffle([...quiz.questions]),
        questionIdx: 0, currentQuestion: null,
        scores: { [user.id]: 0 },
        answers: {}, evalResults: {}, actionsCast: {},
        phase: 'lobby',
        socketMap: { [user.id]: socket.id },
      };
      gameRooms[roomId] = room;
      socket.join(`game:${roomId}`);
      socket.emit('game:room_joined', getRoomPublic(room));
      broadcastRoomList();
    } catch (e) { socket.emit('game:error', e.message); }
  });

  socket.on('game:join_room', ({ roomId }) => {
    const room = gameRooms[roomId];
    if (!room) return socket.emit('game:error', 'ห้องไม่มีอยู่');

    const alreadyIn = room.players.find(p => p.id === user.id);

    if (alreadyIn) {
      // Reconnect (e.g. after navigating from lobby → gameplay)
      room.socketMap[user.id] = socket.id;
      socket.join(`game:${roomId}`);
      socket.emit('game:room_joined', getRoomPublic(room));
      // If game already started, catch up the reconnecting player
      if (room.status === 'playing') {
        socket.emit('game:started', getRoomPublic(room));
        if (room.phase === 'question' && room.currentQuestion) {
          socket.emit('game:question', {
            questionIdx: room.questionIdx - 1,
            total: room.questions.length,
            question: room.currentQuestion.question_text || room.currentQuestion.question,
            choices: room.currentQuestion.choices,
            timeLimit: room.timeLimit || DEFAULT_TIME_LIMIT,
          });
        } else if (room.phase === 'action' || room.phase === 'eval') {
          socket.emit('game:action_phase', {
            evalResults: room.evalResults,
            players: room.players.map(pubPlayer),
            scores: room.scores,
          });
        }
      }
      return;
    }

    if (room.status !== 'waiting') return socket.emit('game:error', 'เกมเริ่มแล้ว');
    if (room.players.length >= room.maxPlayers) return socket.emit('game:error', 'ห้องเต็ม');

    room.players.push({ id: user.id, name: user.name, hp: MAX_HP, energy: 0, character: user.character_data, item: null, itemUses: 0 });
    room.scores[user.id] = 0;
    room.socketMap[user.id] = socket.id;
    socket.join(`game:${roomId}`);
    socket.emit('game:room_joined', getRoomPublic(room));
    io.to(`game:${roomId}`).emit('game:room_updated', getRoomPublic(room));
    broadcastRoomList();
  });

  socket.on('game:invite_user', ({ roomId, targetUserId }) => {
    // Find target socket
    const targetSocketId = [...onlineUsers.entries()].find(([, u]) => u.id === targetUserId)?.[0];
    if (!targetSocketId) return socket.emit('game:error', 'ผู้ใช้ออฟไลน์');
    const room = gameRooms[roomId];
    if (!room) return;
    io.to(targetSocketId).emit('game:invitation', {
      roomId, roomName: room.name, fromUser: user.name,
    });
  });

  // เลือกของวิเศษก่อนเริ่มเกม (เปลี่ยนใจได้จนกว่าจะกดเริ่ม)
  socket.on('game:pick_item', ({ roomId, itemKey }) => {
    const room = gameRooms[roomId];
    if (!room || room.status !== 'waiting') return;
    const item = GR_ITEMS[itemKey];
    if (!item) return socket.emit('game:error', 'ไม่พบของวิเศษชิ้นนี้');
    const p = room.players.find(x => x.id === user.id);
    if (!p) return;
    p.item = item.key;
    p.itemUses = item.uses;
    io.to(`game:${roomId}`).emit('game:room_updated', getRoomPublic(room));
  });

  // ใช้ยาเพิ่มเลือดระหว่างช่วงเลือกท่า
  socket.on('game:use_item', ({ roomId }) => {
    const room = gameRooms[roomId];
    if (!room || room.phase !== 'action') return;
    const p = room.players.find(x => x.id === user.id);
    if (!p || p.item !== 'potion' || p.itemUses <= 0 || p.hp <= 0) return;
    p.itemUses -= 1;
    const before = p.hp;
    p.hp = Math.min(MAX_HP, p.hp + GR_ITEMS.potion.heal);
    io.to(`game:${roomId}`).emit('game:item_used', {
      userId: p.id, item: 'potion', healed: p.hp - before,
      players: room.players.map(pubPlayer),
    });
  });

  socket.on('game:start_game', ({ roomId }) => {
    const room = gameRooms[roomId];
    if (!room) return;
    if (room.host.id !== user.id) return socket.emit('game:error', 'เฉพาะเจ้าบ้านเท่านั้น');
    if (room.players.length < 2) return socket.emit('game:error', 'ต้องการผู้เล่นอย่างน้อย 2 คน');
    // ใครยังไม่เลือกของวิเศษ ให้ยาเพิ่มเลือดเป็นค่าเริ่มต้น
    room.players.forEach(p => {
      if (!GR_ITEMS[p.item]) { p.item = 'potion'; p.itemUses = GR_ITEMS.potion.uses; }
    });
    room.status = 'playing';
    io.to(`game:${roomId}`).emit('game:started', getRoomPublic(room));
    broadcastRoomList();
    setTimeout(() => grStartQuestion(roomId), 1500);
  });

  socket.on('game:answer', ({ roomId, choiceIdx, responseTime }) => {
    const room = gameRooms[roomId];
    if (!room || room.phase !== 'question') return;
    if (room.answers[user.id]) return; // already answered
    room.answers[user.id] = {
      choice: room.currentQuestion?.choices?.[choiceIdx],
      time: responseTime ?? (room.timeLimit || DEFAULT_TIME_LIMIT),
    };

    // If all players answered, reveal early
    const answeredCount = Object.keys(room.answers).length;
    if (answeredCount >= room.players.length) {
      clearTimeout(room.questionTimer);
      grRevealAnswer(roomId);
    } else {
      socket.emit('game:answer_received', { choiceIdx });
    }
  });

  socket.on('game:cast_action', ({ roomId, targetId, abilityIdx }) => {
    const room = gameRooms[roomId];
    if (!room || room.phase !== 'action') return;
    room.actionsCast[user.id] = { targetId, abilityIdx };

    // If all answered-correct players have cast, resolve early
    const correctPlayers = Object.entries(room.evalResults || {})
      .filter(([, r]) => r.correct).map(([id]) => id);
    const castCount = correctPlayers.filter(id => room.actionsCast[id]).length;
    if (castCount >= correctPlayers.length && correctPlayers.length > 0) {
      clearTimeout(room.actionTimer);
      grResolveActions(roomId);
    }
  });

  socket.on('game:leave_room', ({ roomId }) => {
    const room = gameRooms[roomId];
    if (!room) return;
    socket.leave(`game:${roomId}`);
    room.players = room.players.filter(p => p.id !== user.id);
    delete room.socketMap[user.id];
    if (room.players.length === 0) {
      delete gameRooms[roomId];
    } else if (room.host.id === user.id && room.players[0]) {
      room.host = { id: room.players[0].id, name: room.players[0].name };
    }
    io.to(`game:${roomId}`).emit('game:room_updated', room.players.length ? getRoomPublic(room) : null);
    broadcastRoomList();
  });

  // Send message
  socket.on('send_message', async ({ channelId, content }) => {
    if (!content?.trim() || !channelId) return;
    try {
      const channel = await prisma.channel.findUnique({ where: { id: channelId, is_active: true } });
      if (!channel) return;

      // ANNOUNCEMENT: only teacher+ can send
      if (channel.type === 'ANNOUNCEMENT') {
        const { ROLE_LEVEL } = require('./middleware/authMiddleware');
        if ((ROLE_LEVEL[user.role] ?? 0) < ROLE_LEVEL['TEACHER']) return;
      }

      const message = await prisma.message.create({
        data: { channel_id: channelId, user_id: user.id, content: content.trim() },
        include: {
          user: { select: { id: true, name: true, role: true, character_data: true } },
        },
      });

      io.to(`channel:${channelId}`).emit('new_message', message);
    } catch (err) { console.error('send_message error:', err.message); }
  });

  // Delete message (realtime notify)
  socket.on('delete_message', async ({ channelId, messageId }) => {
    const { ROLE_LEVEL } = require('./middleware/authMiddleware');
    const actorLevel = ROLE_LEVEL[user.role] ?? 0;
    try {
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg) return;
      if (msg.user_id !== user.id && actorLevel < ROLE_LEVEL['TEACHER']) return;
      await prisma.message.update({
        where: { id: messageId },
        data: { deleted: true, deleted_by: user.id },
      });
      io.to(`channel:${channelId}`).emit('message_deleted', { messageId });
    } catch (err) { console.error('delete_message error:', err.message); }
  });

  // Typing indicator
  socket.on('typing', ({ channelId, isTyping }) => {
    socket.to(`channel:${channelId}`).emit('user_typing', { userId: user.id, name: user.name, isTyping });
  });

  // ── VOCAB BATTLE events ───────────────────────────────────────────────────

  // ── join battle room ──
  socket.on('battle:join', async ({ battleId, userId }) => {
    const room = `battle:${battleId}`;
    socket.join(room);
    if (!battleRooms[battleId]) {
      battleRooms[battleId] = { players: {}, ready: new Set(), combo: {}, questionIdx: 0, words: [], answered: false };
    }
    battleRooms[battleId].players[socket.id] = userId;

    // Load words if not loaded
    const state = battleRooms[battleId];
    if (!state.words.length) {
      try {
        const battle = await prisma.vocabBattle.findUnique({ where: { id: parseInt(battleId) } });
        if (battle) {
          const words = await prisma.vocabWord.findMany({
            where: battle.category ? { category: battle.category } : {},
          });
          state.words = shuffle(words).slice(0, battle.max_rounds);
          state.maxRounds = battle.max_rounds;
          state.challengerId = battle.challenger_id;
          state.opponentId = battle.opponent_id;
        }
      } catch(e) { console.error('battle:join error', e.message); }
    }

    // When both players joined → notify ALL and start
    const playerCount = Object.keys(state.players).length;
    if (playerCount >= 2 && !state.started) {
      state.started = true;
      io.to(room).emit('battle:player_joined', { userId }); // notify both players
      setTimeout(() => sendQuestion(battleId), 1500);
    } else {
      socket.to(room).emit('battle:player_joined', { userId }); // notify existing player only
    }
  });

  // ── player ready ──
  socket.on('battle:ready', ({ battleId }) => {
    const state = battleRooms[battleId];
    if (!state) return;
    const userId = state.players[socket.id];
    state.ready.add(userId);
    if (state.ready.size >= 2 && !state.started) {
      state.started = true;
      setTimeout(() => sendQuestion(battleId), 800);
    }
  });

  // ── answer submitted ──
  socket.on('battle:answer', async ({ battleId, answer }) => {
    const state = battleRooms[battleId];
    if (!state || state.answered || state.questionIdx >= state.words.length) return;

    const userId = state.players[socket.id];
    const word   = state.currentWord;
    if (!word) return;

    const correct = normalize(answer) === normalize(word.translation) ||
                    normalize(answer) === normalize(word.word);

    if (correct) {
      state.answered = true;
      if (!state.combo[userId]) state.combo[userId] = 0;
      state.combo[userId]++;

      const isChallenger = userId === state.challengerId;
      const combo        = state.combo[userId];
      const baseDmg      = 12;
      const comboBonus   = Math.min(combo - 1, 5) * 3;
      const damage       = baseDmg + comboBonus;

      // Reset opponent combo
      const opponentId = isChallenger ? state.opponentId : state.challengerId;
      state.combo[opponentId] = 0;

      // Update HP
      try {
        const battle = await prisma.vocabBattle.findUnique({ where: { id: parseInt(battleId) } });
        if (!battle) return;

        const hpField  = isChallenger ? 'opponent_hp'   : 'challenger_hp';
        const winsField= isChallenger ? 'challenger_wins': 'opponent_wins';
        const newHp    = Math.max(0, battle[hpField] - damage);
        const newRound = battle.rounds_played + 1;
        const isOver   = newHp <= 0 || newRound >= state.maxRounds;

        const updateData = {
          [hpField]:      newHp,
          [winsField]:    battle[winsField] + 1,
          rounds_played:  newRound,
        };
        if (isOver) {
          updateData.status     = 'FINISHED';
          updateData.winner_id  = newHp <= 0 ? userId : (battle.challenger_hp > battle.opponent_hp ? battle.challenger_id : battle.opponent_id);
          updateData.finished_at = new Date();
        }

        const updated = await prisma.vocabBattle.update({ where: { id: parseInt(battleId) }, data: updateData });

        // Emit round result
        io.to(`battle:${battleId}`).emit('battle:round_result', {
          winnerId:   userId,
          answer:     word.translation,
          word:       word.word,
          damage,
          combo,
          challengerHp: isChallenger ? battle.challenger_hp : newHp,
          opponentHp:   isChallenger ? newHp : battle.opponent_hp,
        });

        if (isOver) {
          // Update stats
          const winnerId  = updateData.winner_id;
          const loserId   = winnerId === state.challengerId ? state.opponentId : state.challengerId;
          await Promise.all([
            prisma.battleStats.upsert({ where: { user_id: winnerId }, create: { user_id: winnerId, wins: 1, best_combo: state.combo[winnerId] || 1 }, update: { wins: { increment: 1 }, best_combo: { set: Math.max((await prisma.battleStats.findUnique({ where: { user_id: winnerId } }))?.best_combo || 0, state.combo[winnerId] || 1) } } }),
            prisma.battleStats.upsert({ where: { user_id: loserId }, create: { user_id: loserId, losses: 1 }, update: { losses: { increment: 1 } } }),
          ]).catch(() => {});
          io.to(`battle:${battleId}`).emit('battle:end', { winnerId, battle: updated });
          delete battleRooms[battleId];
        } else {
          // Next question after delay
          setTimeout(() => sendQuestion(battleId), 2500);
        }
      } catch(e) { console.error('battle:answer error', e.message); }
    } else {
      // Wrong — notify only the answering player
      socket.emit('battle:wrong', { userId });
    }
  });

  // ── BINGO socket events ─────────────────────────────────────────────────
  socket.on('bingo:join_room', async ({ roomId, alias }) => {
    socket.join(`bingo:${roomId}`);
    socket.data.bingo_alias = alias; // store for counting
    // Count only non-HOST sockets
    const roomSockets = io.sockets.adapter.rooms.get(`bingo:${roomId}`);
    let count = 0;
    if (roomSockets) {
      for (const sid of roomSockets) {
        const s = io.sockets.sockets.get(sid);
        if (s && !String(s.data.bingo_alias || '').startsWith('HOST:')) count++;
      }
    }
    io.to(`bingo:${roomId}`).emit('bingo:player_count', { count });
  });

  socket.on('bingo:draw_number', async ({ roomId, number }) => {
    try {
      // Update drawn_numbers in DB
      const room = await prisma.bingoRoom.findUnique({ where: { id: roomId } });
      if (!room) return;
      if (room.drawn_numbers.includes(number)) return;
      const drawn = [...room.drawn_numbers, number];
      await prisma.bingoRoom.update({ where: { id: roomId }, data: { drawn_numbers: drawn, status: 'playing' } });
      // Also update current active round
      const activeRound = await prisma.bingoRound.findFirst({
        where: { room_id: roomId, status: 'active' },
      });
      if (activeRound) {
        await prisma.bingoRound.update({
          where: { id: activeRound.id },
          data: { drawn_numbers: [...activeRound.drawn_numbers, number] },
        });
      }
      io.to(`bingo:${roomId}`).emit('bingo:number_drawn', { number, drawn });
    } catch (e) { console.error('bingo:draw_number error', e.message); }
  });

  socket.on('bingo:start_round', async ({ roomId, roundId }) => {
    try {
      await prisma.bingoRound.update({
        where: { id: roundId },
        data: { status: 'active', started_at: new Date(), drawn_numbers: [] },
      });
      await prisma.bingoRoom.update({
        where: { id: roomId },
        data: { drawn_numbers: [], current_round: roundId },
      });
      const round = await prisma.bingoRound.findUnique({ where: { id: roundId } });
      io.to(`bingo:${roomId}`).emit('bingo:round_started', { round });
    } catch (e) { console.error('bingo:start_round error', e.message); }
  });

  socket.on('bingo:claim', async ({ roomId, roundId, cardId, alias }) => {
    try {
      const [round, card] = await Promise.all([
        prisma.bingoRound.findUnique({ where: { id: roundId } }),
        prisma.bingoCard.findUnique({ where: { id: cardId } }),
      ]);
      if (!round || !card) return;
      // Record winner
      const winner = await prisma.bingoWinner.create({
        data: { round_id: roundId, card_id: cardId, alias },
      });
      // Deduct prize inventory if linked
      if (round.prize_inventory_id) {
        prisma.bingoPrizeInventory.update({
          where: { id: round.prize_inventory_id },
          data: { remaining: { decrement: 1 } },
        }).catch(() => {});
      }
      io.to(`bingo:${roomId}`).emit('bingo:winner', {
        alias, roundId, cardId, pattern: round.pattern, prize: round.prize,
      });
    } catch (e) { console.error('bingo:claim error', e.message); }
  });

  socket.on('bingo:end_round', async ({ roomId, roundId }) => {
    try {
      await prisma.bingoRound.update({
        where: { id: roundId },
        data: { status: 'finished', ended_at: new Date() },
      });
      io.to(`bingo:${roomId}`).emit('bingo:round_ended', { roundId });
    } catch (e) { console.error('bingo:end_round error', e.message); }
  });

  socket.on('bingo:end_game', async ({ roomId }) => {
    try {
      await prisma.bingoRoom.update({ where: { id: roomId }, data: { status: 'finished' } });
      io.to(`bingo:${roomId}`).emit('bingo:game_ended', { roomId });
    } catch (e) { console.error('bingo:end_game error', e.message); }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('online_users', Array.from(onlineUsers.values()));
    Object.keys(battleRooms).forEach(bid => {
      if (battleRooms[bid]?.players?.[socket.id]) {
        delete battleRooms[bid].players[socket.id];
      }
    });
  });
});

// Global error handler (Express 5 requires 4-arg signature)
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

// Start cron jobs
const { startDeadlineReminder } = require('./jobs/deadlineReminder');
startDeadlineReminder();

server.listen(port, () => console.log(`Server is running on port ${port}`));

function sendQuestion(battleId) {
  const state = battleRooms[battleId];
  if (!state || state.questionIdx >= state.words.length) return;
  const word = state.words[state.questionIdx];
  if (!word) return;
  state.answered = false;

  // Clear any previous timeout
  if (state.timeoutId) { clearTimeout(state.timeoutId); state.timeoutId = null; }

  const askWord = Math.random() > 0.5;
  state.currentWord = word;
  io.to(`battle:${battleId}`).emit('battle:question', {
    questionIdx: state.questionIdx,
    total:       state.words.length,
    question:    askWord ? word.word : word.translation,
    questionType: askWord ? 'translate' : 'word',
    hint:        word.hint,
  });
  state.questionIdx++;

  // Server-side timeout: 12s — reveal answer then move on
  state.timeoutId = setTimeout(() => {
    if (!state || state.answered) return;
    state.answered = true;
    io.to(`battle:${battleId}`).emit('battle:timeout_reveal', {
      answer: word.translation,
      word:   word.word,
    });
    setTimeout(() => sendQuestion(battleId), 2500);
  }, 12000);
}
