const express = require('express');
const router = express.Router();
const { getQuizzes, getQuiz, createQuiz, updateQuiz, toggleQuiz, deleteQuiz, submitQuiz, getQuizLeaderboard, getMyAttempts } = require('../controllers/quizController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/').get(getQuizzes).post(restrictTo('TEACHER'), createQuiz);
router.get('/:id', getQuiz);
router.put('/:id', restrictTo('TEACHER'), updateQuiz);
router.put('/:id/toggle', restrictTo('TEACHER'), toggleQuiz);
router.delete('/:id', restrictTo('TEACHER'), deleteQuiz);
router.post('/:id/submit', submitQuiz);
router.get('/:id/leaderboard', getQuizLeaderboard);
router.get('/:id/my-attempts', getMyAttempts);

module.exports = router;
