const express = require('express');
const router = express.Router();

const inventoryController = require('../controllers/inventory.controller');
const productController = require('../controllers/product.controller');
const orderController = require('../controllers/order.controller');
const { requireAuth, authorizeRoles } = require('../middleware/auth.middleware');

// ==========================================================
// 1. INVENTORY & STOCK MANAGEMENT (Store Manager - UC-21)
// ==========================================================
// GET /inventory (UC-21)
router.get('/inventory', (req, res) => inventoryController.getInventory(req, res));
// GET /inventory/transactions
router.get('/inventory/transactions', (req, res) => inventoryController.getTransactions(req, res));
// GET /inventory/:partId
router.get('/inventory/:partId', (req, res) => inventoryController.getPartById(req, res));
// POST /inventory (Create part)
router.post('/inventory', authorizeRoles('Store Manager', 'Owner', 'Administrator'), (req, res) => inventoryController.createPart(req, res));
// PUT /inventory/:partId (UC-21)
router.put('/inventory/:partId', authorizeRoles('Store Manager', 'Owner', 'Administrator'), (req, res) => inventoryController.updatePart(req, res));
// POST /inventory/adjust (UC-21: Purchase, Allocation, Adjustment with locking)
router.post('/inventory/adjust', authorizeRoles('Store Manager', 'Owner', 'Administrator'), (req, res) => inventoryController.adjustStock(req, res));

// ==========================================================
// 2. PARTS REQUISITIONS (Mechanic & Store Manager - UC-18, UC-22)
// ==========================================================
// POST /requisitions (UC-18 / US-21: Mechanic submits requisition)
router.post('/requisitions', authorizeRoles('Mechanic', 'Owner', 'Store Manager'), (req, res) => inventoryController.submitRequisition(req, res));
// GET /requisitions (UC-22 / Store Manager views pending/all)
router.get('/requisitions', (req, res) => inventoryController.getRequisitions(req, res));
// PUT /requisitions/:id/approve (UC-22 / US-26: Store Manager approves with stock deduction)
router.put('/requisitions/:id/approve', authorizeRoles('Store Manager', 'Owner'), (req, res) => inventoryController.approveRequisition(req, res));
// PUT /requisitions/:id/reject (UC-22 / US-26: Store Manager rejects with reason)
router.put('/requisitions/:id/reject', authorizeRoles('Store Manager', 'Owner'), (req, res) => inventoryController.rejectRequisition(req, res));

// ==========================================================
// 3. PRODUCTS & COMPATIBILITY (UC-23, UC-25)
// ==========================================================
// GET /products/categories
router.get('/products/categories', (req, res) => productController.getCategories(req, res));
// GET /products (Public - UC-25: Search, filter by price, category, vehicle)
router.get('/products', (req, res) => productController.getProducts(req, res));
// GET /products/:id
router.get('/products/:id', (req, res) => productController.getProductById(req, res));
// POST /products (Store Manager - UC-23)
router.post('/products', authorizeRoles('Store Manager', 'Owner', 'Administrator'), (req, res) => productController.createProduct(req, res));
// PUT /products/:id (Store Manager - UC-23)
router.put('/products/:id', authorizeRoles('Store Manager', 'Owner', 'Administrator'), (req, res) => productController.updateProduct(req, res));
// DELETE /products/:id (Store Manager - UC-23: Soft delete)
router.delete('/products/:id', authorizeRoles('Store Manager', 'Owner', 'Administrator'), (req, res) => productController.deleteProduct(req, res));

// ==========================================================
// 4. CART (Customer - UC-26)
// ==========================================================
router.get('/cart', (req, res) => orderController.getCart(req, res));
router.post('/cart', (req, res) => orderController.addToCart(req, res));
router.put('/cart', (req, res) => orderController.updateCartItem(req, res));
router.delete('/cart', (req, res) => orderController.removeFromCart(req, res));

// ==========================================================
// 5. ORDERS & CHECKOUT (Customer & Store Manager - UC-24, UC-27, UC-28)
// ==========================================================
// POST /orders (UC-27: Checkout with stock reservation)
router.post('/orders', (req, res) => orderController.checkout(req, res));
// GET /orders/my (UC-28: Customer orders)
router.get('/orders/my', (req, res) => orderController.getMyOrders(req, res));
// GET /orders (Store Manager - UC-24: Manage order fulfilment)
router.get('/orders', (req, res) => orderController.getAllOrders(req, res));
// GET /orders/:id (UC-28 / Store Manager)
router.get('/orders/:id', (req, res) => orderController.getOrderById(req, res));
// PUT /orders/:id/status (Store Manager - UC-24: Update order status)
router.put('/orders/:id/status', authorizeRoles('Store Manager', 'Owner', 'Administrator'), (req, res) => orderController.updateStatus(req, res));

// ==========================================================
// 6. DASHBOARDS & NOTIFICATIONS (UC-35)
// ==========================================================
// GET /dashboard/inventory (UC-35: Inventory Dashboard)
router.get('/dashboard/inventory', (req, res) => inventoryController.getDashboard(req, res));
// GET /notifications
router.get('/notifications', (req, res) => inventoryController.getNotifications(req, res));

module.exports = router;
