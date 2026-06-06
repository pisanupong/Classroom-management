const express = require('express');
const router  = express.Router();
const {
  getHomework, createHomework, updateHomework, toggleDone, deleteHomework,
  getSummary, getAllStudentsHomework,
  getHomeworkDetail, submitHomework, updateSubmissionStatus,
} = require('../controllers/dailyHomeworkController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/summary',             getSummary);
router.get('/all',   restrictTo('CLASS_ADMIN'), getAllStudentsHomework);
router.get('/',      getHomework);
router.post('/',     createHomework);

router.get('/:id/detail',                    getHomeworkDetail);
router.post('/:id/submit',                   submitHomework);
router.patch('/:id/submission-status', restrictTo('CLASS_ADMIN'), updateSubmissionStatus);
router.patch('/:id/toggle',                  toggleDone);
router.put('/:id',   restrictTo('CLASS_ADMIN'), updateHomework);
router.delete('/:id',                        deleteHomework);

module.exports = router;
