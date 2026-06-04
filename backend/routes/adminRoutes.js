const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { getUsers, createUser, importUsers, updateUser, deleteUser } = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// multer — memory storage for Excel parsing (no disk write needed)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(protect, restrictTo('ADMIN'));

router.get('/users',          getUsers);
router.post('/users',         createUser);
router.post('/users/import',  upload.single('file'), importUsers);
router.put('/users/:id',      updateUser);
router.delete('/users/:id',   deleteUser);

module.exports = router;
