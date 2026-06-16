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

// Comments
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await require('../config/db').assignmentComment.findMany({
      where: { assignment_id: parseInt(req.params.id) },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { created_at: 'asc' },
    });
    res.json(comments);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: 'กรุณากรอกข้อความ' });
    const comment = await require('../config/db').assignmentComment.create({
      data: { assignment_id: parseInt(req.params.id), user_id: req.user.id, content: content.trim() },
      include: { user: { select: { id: true, name: true, role: true } } },
    });
    res.status(201).json(comment);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/:id/comments/:commentId', async (req, res) => {
  try {
    const { ROLE_LEVEL } = require('../middleware/authMiddleware');
    const prisma = require('../config/db');
    const comment = await prisma.assignmentComment.findUnique({ where: { id: parseInt(req.params.commentId) } });
    if (!comment) return res.status(404).json({ message: 'ไม่พบ comment' });
    const isOwner = comment.user_id === req.user.id;
    const isAdmin = ROLE_LEVEL[req.user.role] >= ROLE_LEVEL['TEACHER'];
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'ไม่มีสิทธิ์ลบ' });
    await prisma.assignmentComment.delete({ where: { id: parseInt(req.params.commentId) } });
    res.json({ message: 'ลบสำเร็จ' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
