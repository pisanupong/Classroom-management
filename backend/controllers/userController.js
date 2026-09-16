const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// @desc    Register new user
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { username, password, role, name, student_number } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ message: 'Please add all required fields (username, password, name)' });
    }

    // Check if user exists
    const userExists = await prisma.user.findUnique({
      where: { username },
    });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        password_hash: hashedPassword,
        role: 'STUDENT',
        name,
        student_number: student_number || null,
      },
    });

    if (user) {
      res.status(201).json({
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        token: generateToken(user.id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Authenticate a user
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check by username OR student_number
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { student_number: username },
        ],
      },
    });

    if (user && (await bcrypt.compare(password, user.password_hash))) {
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        student_number: user.student_number,
        total_points: user.total_points,
        character_data: user.character_data,
        token: generateToken(user.id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user data
// @route   GET /api/users/me
// @access  Private
const getMe = async (req, res) => {
  try {
    // req.user is set by the protect middleware
    res.status(200).json(req.user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
};
