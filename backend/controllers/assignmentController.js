const prisma = require('../config/db');

// @desc    Get all assignments
// @route   GET /api/assignments
// @access  Private
const { ROLE_LEVEL } = require('../middleware/authMiddleware');

const getAssignments = async (req, res) => {
  try {
    const isTeacherUp = ROLE_LEVEL[req.user.role] >= ROLE_LEVEL['CLASS_ADMIN'];

    const [assignments, totalStudents, topScorers, submissionCounts] = await Promise.all([
      prisma.assignment.findMany({
        include: {
          teacher:  { select: { id: true, name: true, role: true } },
          subject:  { select: { id: true, name: true } },
          submissions: isTeacherUp
            ? { include: { student: { select: { id: true, name: true, student_number: true } } }, orderBy: { submitted_at: 'asc' } }
            : { where: { student_id: req.user.id }, select: { id: true, status: true, score_given: true, submitted_at: true, file_url: true } },
        },
        orderBy: { due_date: 'asc' },
      }),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      // Top scorer per assignment (highest graded score)
      prisma.submission.findMany({
        where: { status: 'GRADED', score_given: { not: null } },
        select: {
          assignment_id: true,
          score_given:   true,
          student: { select: { id: true, name: true } },
        },
        orderBy: { score_given: 'desc' },
      }),
      // Total submission count per assignment (all roles)
      prisma.submission.groupBy({
        by: ['assignment_id'],
        _count: { id: true },
      }),
    ]);

    // Build topScorer map: assignment_id → first (highest) score entry
    const topScorerMap = {};
    topScorers.forEach(s => {
      if (!topScorerMap[s.assignment_id]) {
        topScorerMap[s.assignment_id] = { name: s.student.name, score: s.score_given };
      }
    });

    // Build submissionCount map: assignment_id → count
    const countMap = {};
    submissionCounts.forEach(c => { countMap[c.assignment_id] = c._count.id; });

    const result = assignments.map(a => ({
      ...a,
      totalStudents,
      submissionCount: countMap[a.id] || 0,
      topScorer:       topScorerMap[a.id] || null,
    }));

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get single assignment
// @route   GET /api/assignments/:id
// @access  Private
const getAssignmentById = async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        teacher: { select: { id: true, name: true } },
        submissions: req.user.role === 'TEACHER'
          ? {
              include: {
                student: { select: { id: true, name: true, student_number: true } },
              },
            }
          : { where: { student_id: req.user.id } },
      },
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    res.json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create assignment (Teacher only)
// @route   POST /api/assignments
// @access  Private (TEACHER)
const VALID_HW_TYPES   = ['แบบฝึกหัด', 'รายงาน', 'โปรเจกต์', 'ชิ้นงาน', 'อื่นๆ'];
const VALID_LOCATIONS  = ['ในห้องเรียน', 'โต๊ะครู', 'ออนไลน์', 'อื่นๆ'];

const createAssignment = async (req, res) => {
  try {
    const { title, description, start_date, due_date, max_score, bonus_points, subject_id, teacher_id, homework_type, submit_location } = req.body;

    if (!title || !due_date || !max_score) {
      return res.status(400).json({ message: 'กรุณากรอกชื่อ กำหนดส่ง และคะแนน' });
    }

    // ถ้ามี teacher_id (ADMIN/SUPER_USER ระบุครูเอง) ให้ใช้ค่านั้น มิฉะนั้นใช้ผู้สร้าง
    const assignedTeacher = teacher_id ? parseInt(teacher_id) : req.user.id;

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description:     description || null,
        start_date:      start_date ? new Date(start_date) : null,
        due_date:        new Date(due_date),
        max_score:       parseInt(max_score),
        bonus_points:    bonus_points ? parseInt(bonus_points) : 0,
        homework_type:   VALID_HW_TYPES.includes(homework_type)  ? homework_type  : null,
        submit_location: VALID_LOCATIONS.includes(submit_location) ? submit_location : null,
        created_by:      assignedTeacher,
        subject_id:      subject_id ? parseInt(subject_id) : null,
      },
      include: {
        teacher: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update assignment (Teacher only)
// @route   PUT /api/assignments/:id
// @access  Private (TEACHER)
const updateAssignment = async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignment.created_by !== req.user.id && ROLE_LEVEL[req.user.role] < ROLE_LEVEL['ADMIN']) {
      return res.status(403).json({ message: 'Not authorized to update this assignment' });
    }

    const { title, description, start_date, due_date, max_score, bonus_points, homework_type, submit_location } = req.body;

    const updated = await prisma.assignment.update({
      where: { id: parseInt(req.params.id) },
      data: {
        title:           title        || assignment.title,
        description:     description  !== undefined ? description  : assignment.description,
        start_date:      start_date === '' ? null : start_date ? new Date(start_date) : assignment.start_date,
        due_date:        due_date     ? new Date(due_date)         : assignment.due_date,
        max_score:       max_score    ? parseInt(max_score)        : assignment.max_score,
        bonus_points:    bonus_points !== undefined ? parseInt(bonus_points) : assignment.bonus_points,
        homework_type:   homework_type   !== undefined ? (VALID_HW_TYPES.includes(homework_type)   ? homework_type   : null) : assignment.homework_type,
        submit_location: submit_location !== undefined ? (VALID_LOCATIONS.includes(submit_location) ? submit_location : null) : assignment.submit_location,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete assignment (Teacher only)
// @route   DELETE /api/assignments/:id
// @access  Private (TEACHER)
const deleteAssignment = async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (assignment.created_by !== req.user.id && ROLE_LEVEL[req.user.role] < ROLE_LEVEL['ADMIN']) {
      return res.status(403).json({ message: 'Not authorized to delete this assignment' });
    }

    // Delete submissions first (cascade)
    await prisma.submission.deleteMany({ where: { assignment_id: assignment.id } });
    await prisma.assignment.delete({ where: { id: assignment.id } });

    res.json({ message: 'Assignment deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Submit assignment (Student only)
// @route   POST /api/assignments/:id/submit
// @access  Private (STUDENT)
const submitAssignment = async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id);

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    // Check if already submitted
    const existing = await prisma.submission.findFirst({
      where: { assignment_id: assignmentId, student_id: req.user.id },
    });

    if (existing) {
      return res.status(400).json({ message: 'Already submitted this assignment' });
    }

    const submission = await prisma.submission.create({
      data: {
        assignment_id: assignmentId,
        student_id: req.user.id,
        file_url: req.body.file_url || null,
        status: 'PENDING',
      },
    });

    res.status(201).json(submission);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Grade submission (Teacher only)
// @route   PUT /api/assignments/:id/submissions/:submissionId/grade
// @access  Private (TEACHER)
const gradeSubmission = async (req, res) => {
  try {
    const { score_given } = req.body;
    const submissionId = parseInt(req.params.submissionId);
    const assignmentId = parseInt(req.params.id);

    if (score_given === undefined || score_given === null) {
      return res.status(400).json({ message: 'Please provide score_given' });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment || assignment.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
    });

    if (!submission || submission.assignment_id !== assignmentId) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        score_given: parseInt(score_given),
        status: 'GRADED',
      },
    });

    // Add points to student
    await prisma.user.update({
      where: { id: submission.student_id },
      data: {
        total_points: { increment: parseInt(score_given) },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAssignments,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  gradeSubmission,
};
