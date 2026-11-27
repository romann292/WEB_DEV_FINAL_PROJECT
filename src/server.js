const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const { initSchema } = require('./data/db');
const { authenticate } = require('./middleware/auth.middleware');
const apiRoutes = require('./routes/api.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// Ensure database schema is initialised
initSchema();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Authentication parser
app.use(authenticate);

// API Routes
app.use('/api', apiRoutes);

// Direct endpoint aliases conforming to Deliverable 2 Table 21
app.use('/', apiRoutes);

// Serve Static Frontend UI
app.use(express.static(path.join(__dirname, '../public')));

// Root info
app.get('/info', (req, res) => {
  res.json({
    project: 'Dab Automotive',
    module: 'Member 4: Inventory & Automotive E-Commerce Subsystem',
    developer: 'Roman Fatima (241878)',
    status: 'Operational',
    endpoints: {
      inventory: '/api/inventory',
      requisitions: '/api/requisitions',
      products: '/api/products',
      cart: '/api/cart',
      orders: '/api/orders',
      dashboard: '/api/dashboard/inventory',
      transactions: '/api/inventory/transactions',
      notifications: '/api/notifications'
    }
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`🚗 DAB AUTOMOTIVE - MEMBER 4 (ROMAN) SUBSYSTEM RUNNING`);
    console.log(`📡 Server listening on http://localhost:${PORT}`);
    console.log(`📦 Inventory Dashboard: http://localhost:${PORT}/inventory.html`);
    console.log(`🛒 E-Commerce Storefront: http://localhost:${PORT}/index.html`);
    console.log(`================================================================`);
  });
}

module.exports = app;
