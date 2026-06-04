const express = require('express');
const router = express.Router();
const { getSummary, getMyTransactions, createTransaction, updateTransaction, deleteTransaction, getPending, approveTransaction } = require('../controllers/treasuryController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/',               restrictTo('CLASS_ADMIN', 'TEACHER'), getSummary);
router.get('/my',             getMyTransactions);
router.get('/pending',        restrictTo('TEACHER'), getPending);
router.post('/',              restrictTo('CLASS_ADMIN', 'TEACHER'), createTransaction);
router.put('/:id/approve',    restrictTo('TEACHER'), approveTransaction);
router.put('/:id',            restrictTo('TEACHER'), updateTransaction);
router.delete('/:id',         restrictTo('TEACHER'), deleteTransaction);

module.exports = router;
