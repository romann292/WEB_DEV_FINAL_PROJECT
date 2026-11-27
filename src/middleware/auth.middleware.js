const jwt = require('jsonwebtoken');
const { db } = require('../data/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dab-automotive-dev-secret-key-2026';

// Middleware to authenticate JWT or fallback to demo simulated headers
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
  }

  // Development convenience header: x-user-id or x-role
  if (req.headers['x-user-id']) {
    const userId = parseInt(req.headers['x-user-id']);
    const user = db.prepare(`
      SELECT u.id, u.name, u.email, r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(userId);

    if (user) {
      req.user = user;
      // If customer, attach customer_id
      if (user.role === 'Customer') {
        const cust = db.prepare(`SELECT id FROM customers WHERE user_id = ?`).get(user.id);
        if (cust) req.user.customerId = cust.id;
      }
      return next();
    }
  }

  // Default guest for public endpoints
  req.user = null;
  next();
}

// Ensure logged-in
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }
  next();
}

// RBAC Role Authorizer
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Role '${req.user.role}' is not authorized for this resource. Required: ${allowedRoles.join(', ')}`
      });
    }
    next();
  };
}

module.exports = {
  JWT_SECRET,
  authenticate,
  requireAuth,
  authorizeRoles
};
