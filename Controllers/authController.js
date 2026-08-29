const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool'); // Adjust the path to your pool file if necessary

// Register a new user
exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // 1. Check if user already exists
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // 2. Hash the password securely using bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Insert the new user into the Neon database
    const newUser = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, email, hashedPassword]
    );

    // 4. Return success response (excluding password hash)
    res.status(201).json({
      message: 'User registered successfully!',
      user: newUser.rows[0]
    });
  } catch (err) {
    console.error('Registration Error:', err.message);
    res.status(500).json({ error: 'Server error during registration.' });
  }
};

// Login an existing user
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check if user exists
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const user = userResult.rows[0];

    // 2. Compare submitted password with the stored hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // 3. Generate a secure JWT Token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your_fallback_secret',
      { expiresIn: '1h' }
    );

    // 4. Return success response with the token
    res.status(200).json({
      message: 'Logged in successfully!',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login Error:', err.message);
    res.status(500).json({ error: 'Server error during login.' });
  }
};