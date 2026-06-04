const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { getSubjects, createSubject, updateSubject, deleteSubject, getTeachers } = require('../controllers/subjectController');

router.use(protect);
router.get('/',           getSubjects);
router.get('/teachers',   getTeachers);
router.post('/',          restrictTo('ADMIN'), createSubject);
router.put('/:id',        restrictTo('ADMIN'), updateSubject);
router.delete('/:id',     restrictTo('ADMIN'), deleteSubject);

module.exports = router;
