const express = require('express');
const router = express.Router();
const {
  getAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
} = require('../controllers/assignmentController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect); // All assignment routes require login

router.route('/')
  .get(getAssignments)
  .post(restrictTo('TEACHER'), createAssignment);

router.route('/:id')
  .get(getAssignmentById)
  .put(restrictTo('TEACHER'), updateAssignment)
  .delete(restrictTo('TEACHER'), deleteAssignment);

// CLASS_ADMIN สามารถส่งงานได้เหมือน STUDENT
router.post('/:id/submit', submitAssignment);
// CLASS_ADMIN ตรวจดูสถานะการส่งงานได้ (read-only) — grading ยังเป็น TEACHER เท่านั้น
router.put('/:id/submissions/:submissionId/grade', restrictTo('TEACHER'), gradeSubmission);

module.exports = router;
