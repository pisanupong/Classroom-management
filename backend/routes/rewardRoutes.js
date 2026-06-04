const express = require('express');
const router = express.Router();
const {
  getRewards, createReward, updateReward, deleteReward,
  redeemReward, getRewardLogs, getMyLogs, claimLog, adjustPoints,
} = require('../controllers/rewardController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/',                          getRewards);
router.post('/',         restrictTo('TEACHER'), createReward);
router.put('/:id',       restrictTo('TEACHER'), updateReward);
router.delete('/:id',    restrictTo('TEACHER'), deleteReward);

router.post('/:id/redeem',               redeemReward);
router.get('/logs',      restrictTo('TEACHER'), getRewardLogs);
router.get('/my-logs',                   getMyLogs);
router.put('/logs/:id/claim', restrictTo('TEACHER'), claimLog);
router.put('/points/:studentId', restrictTo('TEACHER'), adjustPoints);

module.exports = router;
