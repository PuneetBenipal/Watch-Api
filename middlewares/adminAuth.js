const { isAuth, isAdmin } = require('./auth.middleware');

// Compose auth + admin check as a single export usable in route definitions
// Usage: router.post('/path', adminAuth, handler)
module.exports = [isAuth, isAdmin];
