const { db } = require('../data/db');
const orderRepo = require('../repositories/order.repository');
const cartRepo = require('../repositories/cart.repository');
const inventoryRepo = require('../repositories/inventory.repository');
const inventoryService = require('./inventory.service');

class OrderService {
  // Checkout & Place Order (US-31 / UC-27 / SEQ-06 / AD-05)
  async checkout({ customerId, deliveryAddress, paymentMethod, notes }) {
    if (!customerId || !deliveryAddress || !paymentMethod) {
      throw new Error('customerId, deliveryAddress, and paymentMethod are required');
    }

    const cart = cartRepo.getCartWithItems(customerId);
    if (!cart.items || cart.items.length === 0) {
      throw new Error('Your cart is empty');
    }

    // Execute checkout inside an ACID transaction with atomic stock reservation
    const checkoutTx = db.transaction(() => {
      // 1. Re-validate web stock for every cart item under lock
      for (const item of cart.items) {
        if (item.part_id) {
          const inv = db.prepare(`SELECT web_qty FROM inventory WHERE part_id = ?`).get(item.part_id);
          const available = inv ? inv.web_qty : 0;
          if (available < item.quantity) {
            throw new Error(`Item '${item.name}' does not have enough web stock. Available: ${available}, In Cart: ${item.quantity}`);
          }
        }
      }

      // 2. Generate unique order number (e.g. DAB-ORD-20261126-XXXX)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `DAB-ORD-${dateStr}-${randomSuffix}`;

      // 3. Compute totals
      const subtotal = cart.subtotal;
      const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST/Sales Tax
      const shippingFee = subtotal > 5000 ? 0 : 250; // Free delivery over 5000
      const totalAmount = subtotal + tax + shippingFee;

      const orderItems = cart.items.map(item => ({
        product_id: item.product_id,
        part_id: item.part_id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.item_total
      }));

      // 4. Create Order Record
      const order = orderRepo.createOrderRecord({
        orderNumber,
        customerId,
        subtotal,
        tax,
        shippingFee,
        totalAmount,
        deliveryAddress,
        paymentMethod,
        notes,
        items: orderItems
      });

      // 5. Reserve web stock atomically and record inventory_transactions (Reserve)
      for (const item of cart.items) {
        if (item.part_id) {
          inventoryRepo.reserveWebStock({
            partId: item.part_id,
            quantity: item.quantity,
            orderId: order.id
          });
          inventoryService.checkAndTriggerLowStockAlert(item.part_id);
        }
      }

      // 6. Clear customer's shopping cart
      cartRepo.clearCart(customerId);

      // 7. Store manager notification
      db.prepare(`
        INSERT INTO notifications (role_target, type, title, message)
        VALUES ('Store Manager', 'ORDER_PLACED', ?, ?)
      `).run(
        `New Order #${orderNumber}`,
        `Customer placed order #${orderNumber} total Rs. ${totalAmount.toFixed(2)}. ${orderItems.length} item(s).`
      );

      return order;
    });

    return checkoutTx();
  }

  // Update Order Status (US-28 / UC-24: Placed -> Packed -> Dispatched -> Delivered, or Cancelled)
  async updateOrderStatus(orderId, newStatus, performedBy) {
    const validStatuses = ['Placed', 'Packed', 'Dispatched', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid order status: ${newStatus}`);
    }

    const order = orderRepo.findById(orderId);
    if (!order) throw new Error(`Order #${orderId} not found`);

    const currentStatus = order.status;
    if (currentStatus === 'Delivered' || currentStatus === 'Cancelled') {
      throw new Error(`Cannot change status of an order that is already ${currentStatus}`);
    }

    const statusTx = db.transaction(() => {
      let paymentStatus = order.payment_status;

      // Handle stock adjustments based on lifecycle state machine
      if (newStatus === 'Dispatched' && currentStatus !== 'Dispatched') {
        // Dispatched converts reserved stock into permanent Sale deduction
        for (const item of order.items) {
          if (item.part_id) {
            inventoryRepo.dispatchReservedStock({
              partId: item.part_id,
              quantity: item.quantity,
              orderId: order.id,
              performedBy
            });
          }
        }
      } else if (newStatus === 'Delivered') {
        paymentStatus = 'Paid';
      } else if (newStatus === 'Cancelled') {
        // If order is cancelled before dispatch, release reserved stock back to web_qty
        if (currentStatus === 'Placed' || currentStatus === 'Packed') {
          for (const item of order.items) {
            if (item.part_id) {
              inventoryRepo.releaseReservedStock({
                partId: item.part_id,
                quantity: item.quantity,
                orderId: order.id
              });
            }
          }
        }
        paymentStatus = paymentStatus === 'Paid' ? 'Refunded' : 'Cancelled';
      }

      const updated = orderRepo.updateStatus(orderId, newStatus, paymentStatus);

      // Customer notification
      db.prepare(`
        INSERT INTO notifications (user_id, role_target, type, title, message)
        VALUES (
          (SELECT user_id FROM customers WHERE id = ?),
          'Customer',
          'ORDER_STATUS_UPDATE',
          ?,
          ?
        )
      `).run(
        order.customer_id,
        `Order #${order.order_number} ${newStatus}`,
        `Your order #${order.order_number} has been updated to '${newStatus}'.`
      );

      return updated;
    });

    return statusTx();
  }

  // Get orders
  async getAllOrders(options = {}) {
    return orderRepo.getAll(options);
  }

  async getOrderById(orderId) {
    const order = orderRepo.findById(orderId);
    if (!order) throw new Error(`Order #${orderId} not found`);
    return order;
  }

  async getCustomerOrders(customerId) {
    return orderRepo.findByCustomerId(customerId);
  }
}

module.exports = new OrderService();
