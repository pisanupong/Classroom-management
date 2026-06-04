const express = require('express');
const router = express.Router();
const { getUsers, updateUser, deleteUser } = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// ADMIN level and above can manage users
router.use(protect, restrictTo('ADMIN'));

router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

module.exports = router;
