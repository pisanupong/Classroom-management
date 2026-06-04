const express = require('express');
const router = express.Router();
const { getCalendarData, getEvents, createEvent, deleteEvent, getUpcoming } = require('../controllers/eventController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/calendar',  getCalendarData);
router.get('/upcoming',  getUpcoming);
router.route('/').get(getEvents).post(restrictTo('TEACHER'), createEvent);
router.delete('/:id',    restrictTo('TEACHER'), deleteEvent);

module.exports = router;
