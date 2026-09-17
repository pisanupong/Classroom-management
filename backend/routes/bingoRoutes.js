const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  createRoom, getRooms, getRoom,
  joinRoom, updateRoom, updateRounds, deleteRoom,
  getPrizes, createPrize, updatePrize, deletePrize,
  getAccountingSummary,
} = require('../controllers/bingoController');

// All routes require login except join (players may not have accounts)
router.get('/rooms',                    protect, getRooms);
router.post('/rooms',                   protect, restrictTo('TEACHER', 'ADMIN', 'SUPER_USER'), createRoom);
router.get('/rooms/:id',                getRoom);          // public — player page needs it
router.patch('/rooms/:id',              protect, restrictTo('TEACHER', 'ADMIN', 'SUPER_USER'), updateRoom);
router.post('/rooms/:id/join',          joinRoom);         // public
router.put('/rooms/:id/rounds',         protect, restrictTo('TEACHER', 'ADMIN', 'SUPER_USER'), updateRounds);
router.delete('/rooms/:id',             protect, restrictTo('TEACHER', 'ADMIN', 'SUPER_USER'), deleteRoom);

// Accounting summary
router.get('/accounting',               protect, restrictTo('TEACHER', 'ADMIN', 'SUPER_USER'), getAccountingSummary);

// Prize inventory
router.get('/prizes',                   protect, restrictTo('TEACHER', 'ADMIN', 'SUPER_USER'), getPrizes);
router.post('/prizes',                  protect, restrictTo('TEACHER', 'ADMIN', 'SUPER_USER'), createPrize);
router.put('/prizes/:prizeId',          protect, restrictTo('TEACHER', 'ADMIN', 'SUPER_USER'), updatePrize);
router.delete('/prizes/:prizeId',       protect, restrictTo('TEACHER', 'ADMIN', 'SUPER_USER'), deletePrize);

module.exports = router;
