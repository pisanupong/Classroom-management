const express = require('express');
const router = express.Router();
const { getChannels, createChannel, deleteChannel, getMessages, deleteMessage } = require('../controllers/chatController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/channels', getChannels);
router.post('/channels', restrictTo('TEACHER'), createChannel);
router.delete('/channels/:id', restrictTo('TEACHER'), deleteChannel);

router.get('/channels/:id/messages', getMessages);
router.delete('/channels/:id/messages/:msgId', restrictTo('CLASS_ADMIN'), deleteMessage);

module.exports = router;
