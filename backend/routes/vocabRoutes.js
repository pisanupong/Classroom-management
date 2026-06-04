const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getWords, getCategories, createWord, bulkCreateWords, updateWord, deleteWord,
  getStats, getMyBattles, getPendingBattles, createBattle, respondBattle, getBattle, getPlayers,
} = require('../controllers/vocabController');

router.use(protect);

// Words
router.get('/words',             getWords);
router.get('/categories',        getCategories);
router.post('/words',            restrictTo('CLASS_ADMIN', 'TEACHER'), createWord);
router.post('/words/bulk',       restrictTo('CLASS_ADMIN', 'TEACHER'), bulkCreateWords);
router.put('/words/:id',         restrictTo('CLASS_ADMIN', 'TEACHER'), updateWord);
router.delete('/words/:id',      restrictTo('CLASS_ADMIN', 'TEACHER'), deleteWord);

// Players
router.get('/players',           getPlayers);

// Stats
router.get('/stats',             getStats);
router.get('/battles/my',        getMyBattles);
router.get('/battles/pending',   getPendingBattles);

// Battles
router.post('/battles',          createBattle);
router.get('/battles/:id',       getBattle);
router.put('/battles/:id/respond', respondBattle);

module.exports = router;
