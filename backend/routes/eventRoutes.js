const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { getCalendarData, getEvents, createEvent, updateEvent, deleteEvent, getUpcoming, importHolidays } = require('../controllers/eventController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.use(protect);

router.get('/calendar',   getCalendarData);
router.get('/upcoming',   getUpcoming);
router.get('/',           getEvents);
router.post('/',          createEvent);                                         // CLASS_ADMIN+ (หรือ NOTE สำหรับทุกคน) — ตรวจใน controller
router.put('/:id',        updateEvent);                                         // เจ้าของ หรือ ADMIN+
router.delete('/:id',     deleteEvent);                                         // เจ้าของ หรือ ADMIN+
router.post('/import-csv', restrictTo('CLASS_ADMIN'), upload.single('file'), importHolidays); // CLASS_ADMIN+

module.exports = router;
