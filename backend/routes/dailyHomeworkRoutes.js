const express = require('express');
const router = express.Router();
const { getHomework, createHomework, updateHomework, toggleDone, deleteHomework, getSummary, getAllStudentsHomework } = require('../controllers/dailyHomeworkController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/summary', getSummary);
router.get('/all', restrictTo('CLASS_ADMIN', 'TEACHER'), getAllStudentsHomework); // CLASS_ADMIN ดูทุกคน
router.route('/').get(getHomework).post(createHomework);
router.patch('/:id/toggle', toggleDone);
router.put('/:id', restrictTo('CLASS_ADMIN'), updateHomework);  // นักเรียนแก้ไขไม่ได้
router.delete('/:id', deleteHomework);

module.exports = router;
