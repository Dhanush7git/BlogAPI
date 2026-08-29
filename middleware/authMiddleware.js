const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'your_fallback_secret');
    
    // Normalize user object to always have `id`
    req.user = {
      ...verified,
      id: verified.id || verified.userId || verified.sub
    };
    
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = verifyToken;