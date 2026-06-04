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

app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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

// ── VOCAB BATTLE state ────────────────────────────────────────────────────────
const battleRooms = {}; // { battleId: { players:{socketId→userId}, ready:Set, combo:{userId:n}, questionIdx:n, words:[], answered:bool } }
const shuffle = arr => { const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]; } return a; };
const normalize = s => s?.toLowerCase().trim().replace(/\s+/g,' ');

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
    socket.to(room).emit('battle:player_joined', { userId });

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

    // When both players joined → start
    const playerCount = Object.keys(state.players).length;
    if (playerCount >= 2 && !state.started) {
      state.started = true;
      setTimeout(() => sendQuestion(battleId), 1500);
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
    const word   = state.words[state.questionIdx];
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

server.listen(port, () => console.log(`Server is running on port ${port}`));

function sendQuestion(battleId) {
  const state = battleRooms[battleId];
  if (!state || state.questionIdx >= state.words.length) return;
  const word = state.words[state.questionIdx];
  if (!word) return;
  state.answered = false;
  // Randomly ask word→translate or translate→word
  const askWord = Math.random() > 0.5;
  io.to(`battle:${battleId}`).emit('battle:question', {
    questionIdx: state.questionIdx,
    total:       state.words.length,
    question:    askWord ? word.word : word.translation,
    questionType: askWord ? 'translate' : 'word',
    hint:        word.hint,
  });
  state.questionIdx++;
}
