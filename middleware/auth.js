const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) return res.sendStatus(403);

    try {
      const user = await User.findById(decoded._id).select('-passwordHash');

      if (!user) {
        return res.sendStatus(403);
      }

      req.user = user;

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.sendStatus(403);
    }
  });
}

module.exports = authenticateToken; 