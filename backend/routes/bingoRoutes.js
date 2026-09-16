const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  createRoom, getRooms, getRoom,
  joinRoom, updateRounds, deleteRoom,
} = require('../controllers/bingoController');

// All routes require login except join (players may not have accounts)
router.get('/rooms',                    protect, getRooms);
router.post('/rooms',                   protect, restrictTo('TEACHER', 'ADMIN', 'SUPER_USER'), createRoom);
router.get('/rooms/:id',                getRoom);          // public — player page needs it
router.post('/rooms/:id/join',          joinRoom);         // public
router.put('/rooms/:id/rounds',         protect, restrictTo('TEACHER', 'ADMIN', 'SUPER_USER'), updateRounds);
router.delete('/rooms/:id',             protect, restrictTo('TEACHER', 'ADMIN', 'SUPER_USER'), deleteRoom);

module.exports = router;
