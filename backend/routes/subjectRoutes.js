const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { getSubjects, createSubject, updateSubject, deleteSubject, getTeachers } = require('../controllers/subjectController');

router.use(protect);
router.get('/',           getSubjects);
router.get('/teachers',   getTeachers);
router.post('/',          restrictTo('TEACHER'), createSubject);
router.put('/:id',        restrictTo('TEACHER'), updateSubject);
router.delete('/:id',     restrictTo('TEACHER'), deleteSubject);

module.exports = router;
