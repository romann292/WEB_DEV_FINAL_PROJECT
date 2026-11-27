const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Set test DB path
process.env.DB_PATH = path.join(__dirname, '../dab_automotive_test.db');
if (fs.existsSync(process.env.DB_PATH)) {
  fs.unlinkSync(process.env.DB_PATH);
}

const { db, initSchema } = require('../src/data/db');
const { seedData } = require('../src/data/seed');
const inventoryService = require('../src/services/inventory.service');
const orderService = require('../src/services/order.service');
const cartService = require('../src/services/cart.service');
const productRepo = require('../src/repositories/product.repository');

async function runTestSuite() {
  console.log('🧪 ========================================================');
  console.log('🧪 RUNNING MEMBER 4 (ROMAN) VERIFICATION TEST SUITE');
  console.log('🧪 Dab Automotive - Inventory & Automotive E-Commerce');
  console.log('🧪 ========================================================\n');

  try {
    // 1. Initialise & Seed
    console.log('[TEST 1] Initializing schema and seed data...');
    seedData();
    console.log('  ✅ Schema created and 6 parts/products seeded.\n');

    // 2. Product Search & Fitment Filter (US-29 / UC-25)
    console.log('[TEST 2] Product Catalog Search & Vehicle Fitment (UC-25 / US-29)...');
    const allProds = productRepo.findAll();
    assert.strictEqual(allProds.length, 6, 'Should find 6 initial products');

    // Test filter by make Toyota and model Corolla
    const toyotaCorollaProds = productRepo.findAll({ vehicleMake: 'Toyota', vehicleModel: 'Corolla', vehicleYear: 2021 });
    assert(toyotaCorollaProds.length > 0, 'Should find products compatible with 2021 Toyota Corolla');
    console.log(`  ✅ Filter found ${toyotaCorollaProds.length} products compatible with 2021 Toyota Corolla.\n`);

    // 3. Cart Management (US-30 / UC-26)
    console.log('[TEST 3] Shopping Cart Operations (UC-26 / US-30)...');
    const customerId = 1;
    await cartService.clearCart(customerId);

    // Add 2 Brake pads (Product 2)
    const cartAfterAdd = await cartService.addItem(customerId, 2, 2);
    assert.strictEqual(cartAfterAdd.items.length, 1);
    assert.strictEqual(cartAfterAdd.items[0].quantity, 2);
    console.log(`  ✅ Added 2x Brake pads to cart. Cart subtotal: Rs. ${cartAfterAdd.subtotal}.\n`);

    // 4. Atomic Checkout & Stock Reservation (US-31 / UC-27 / SEQ-06 / AD-05)
    console.log('[TEST 4] Atomic Checkout with Row Locking & Web Stock Reservation (UC-27 / US-31)...');
    const prePart = await inventoryService.getPartById(2);
    const initialWebQty = prePart.web_qty;
    const initialReservedQty = prePart.reserved_qty;

    const order = await orderService.checkout({
      customerId,
      deliveryAddress: 'House 14, Street 8, F-10/2, Islamabad',
      paymentMethod: 'Cash on Delivery',
      notes: 'Please ring bell'
    });

    assert(order.id, 'Order must be assigned an ID');
    assert(order.order_number.startsWith('DAB-ORD-'), 'Order must have a valid order number');
    assert.strictEqual(order.status, 'Placed', 'Initial order status must be Placed');

    // Verify stock reservation in database
    const postPart = await inventoryService.getPartById(2);
    assert.strictEqual(postPart.web_qty, initialWebQty - 2, 'Web stock must be decremented by 2');
    assert.strictEqual(postPart.reserved_qty, initialReservedQty + 2, 'Reserved stock must be incremented by 2');
    console.log(`  ✅ Checkout successful: Order #${order.order_number}`);
    console.log(`  ✅ Web stock reserved: Web Qty ${initialWebQty} -> ${postPart.web_qty}, Reserved Qty: ${initialReservedQty} -> ${postPart.reserved_qty}\n`);

    // 5. Order Fulfilment Lifecycle (US-28 / UC-24)
    console.log('[TEST 5] Order Fulfilment State Machine: Placed -> Packed -> Dispatched -> Delivered (UC-24)...');
    // Step A: Mark Packed
    const packedOrder = await orderService.updateOrderStatus(order.id, 'Packed', 1);
    assert.strictEqual(packedOrder.status, 'Packed');

    // Step B: Mark Dispatched (Sale transaction - reserved stock permanently deducted)
    const dispatchedOrder = await orderService.updateOrderStatus(order.id, 'Dispatched', 1);
    assert.strictEqual(dispatchedOrder.status, 'Dispatched');
    const dispatchedPart = await inventoryService.getPartById(2);
    assert.strictEqual(dispatchedPart.reserved_qty, initialReservedQty, 'Dispatched order permanently clears reserved stock');

    // Step C: Mark Delivered
    const deliveredOrder = await orderService.updateOrderStatus(order.id, 'Delivered', 1);
    assert.strictEqual(deliveredOrder.status, 'Delivered');
    assert.strictEqual(deliveredOrder.payment_status, 'Paid');
    console.log(`  ✅ Order successfully progressed Placed -> Packed -> Dispatched -> Delivered.\n`);

    // 6. Workshop Parts Requisitions & Stock Deduction (US-21 / US-26 / UC-18 / UC-22 / SEQ-05 / AD-07)
    console.log('[TEST 6] Mechanic Requisition & Store Manager Approval (UC-18 / UC-22)...');
    const oilPart = await inventoryService.getPartById(1);
    const initialWorkshopOil = oilPart.workshop_qty;

    // Mechanic submits requisition
    const req = await inventoryService.submitRequisition({
      jobCardId: 101,
      requestedBy: 2, // Mechanic Ali
      items: [{ part_id: 1, quantity: 2 }]
    });
    assert.strictEqual(req.status, 'Pending');
    console.log(`  ✅ Requisition #${req.id} submitted for Job Card #101.`);

    // Store manager approves requisition (ACID transaction deducts workshop_qty)
    const approvedReq = await inventoryService.approveRequisition(req.id, 1);
    assert.strictEqual(approvedReq.status, 'Approved/Issued');

    const postOilPart = await inventoryService.getPartById(1);
    assert.strictEqual(postOilPart.workshop_qty, initialWorkshopOil - 2, 'Workshop stock must decrease by 2 on requisition approval');
    console.log(`  ✅ Requisition approved: Workshop Qty ${initialWorkshopOil} -> ${postOilPart.workshop_qty}\n`);

    // 7. Low Stock Alerts & Thresholds (US-25 / UC-21)
    console.log('[TEST 7] Low Stock Thresholds & Notifications (UC-21 / US-25)...');
    const lowStockItems = inventoryService.scanLowStock();
    assert(lowStockItems.length > 0, 'Low stock items should be detected');
    console.log(`  ✅ Detected ${lowStockItems.length} items at or below low-stock threshold.`);

    // Check notifications table
    const notifications = inventoryService.getNotifications('Store Manager');
    assert(notifications.length > 0, 'Store Manager should have notifications');
    console.log(`  ✅ Verified ${notifications.length} notifications generated.\n`);

    // 8. Stock Allocation & Adjustment (UC-21)
    console.log('[TEST 8] Stock Allocation between Workshop & Web (UC-21)...');
    const part5Before = await inventoryService.getPartById(3);
    await inventoryService.adjustStock({
      partId: 3,
      adjustmentType: 'Allocation',
      quantity: 5,
      sourceStock: 'workshop',
      destinationStock: 'web',
      performedBy: 1,
      notes: 'Transfer 5 units to web store'
    });
    const part5After = await inventoryService.getPartById(3);
    assert.strictEqual(part5After.workshop_qty, part5Before.workshop_qty - 5);
    assert.strictEqual(part5After.web_qty, part5Before.web_qty + 5);
    console.log(`  ✅ Stock allocation successfully transferred 5 units from Workshop to Web stock.\n`);

    console.log('🎉 ========================================================');
    console.log('🎉 ALL MEMBER 4 (ROMAN) MODULE TESTS PASSED WITH 100% SUCCESS!');
    console.log('🎉 ========================================================');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runTestSuite();
