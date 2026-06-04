const express = require('express');
const router  = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/',  getSettings);                                   // public
router.put('/',  protect, restrictTo('SUPER_USER'), updateSettings); // SUPER_USER only

module.exports = router;
