const { db } = require('../data/db');

class OrderRepository {
  createOrderRecord({ orderNumber, customerId, subtotal, tax = 0, shippingFee = 0, totalAmount, deliveryAddress, paymentMethod, notes, items }) {
    // items: [{ product_id, part_id, quantity, unit_price, total_price }]
    const stmt = db.prepare(`
      INSERT INTO orders (
        order_number, customer_id, status, subtotal, tax, shipping_fee, total_amount,
        delivery_address, payment_method, payment_status, notes
      ) VALUES (?, ?, 'Placed', ?, ?, ?, ?, ?, ?, 'Pending', ?)
    `);

    const info = stmt.run(orderNumber, customerId, subtotal, tax, shippingFee, totalAmount, deliveryAddress, paymentMethod, notes || null);
    const orderId = info.lastInsertRowid;

    const itemStmt = db.prepare(`
      INSERT INTO order_items (order_id, product_id, part_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      itemStmt.run(orderId, item.product_id, item.part_id, item.quantity, item.unit_price, item.total_price);
    }

    return this.findById(orderId);
  }

  findById(id) {
    const order = db.prepare(`
      SELECT o.*, c.phone, c.address as customer_default_address, u.name as customer_name, u.email as customer_email
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE o.id = ?
    `).get(id);

    if (!order) return null;

    order.items = db.prepare(`
      SELECT oi.*, p.name as product_name, p.sku as product_sku, p.image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(id);

    return order;
  }

  findByOrderNumber(orderNumber) {
    const row = db.prepare(`SELECT id FROM orders WHERE order_number = ?`).get(orderNumber);
    if (!row) return null;
    return this.findById(row.id);
  }

  findByCustomerId(customerId) {
    const orders = db.prepare(`
      SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC
    `).all(customerId);

    for (const ord of orders) {
      ord.items = db.prepare(`
        SELECT oi.*, p.name as product_name, p.image_url
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `).all(ord.id);
    }

    return orders;
  }

  getAll(options = {}) {
    let query = `
      SELECT o.*, u.name as customer_name, u.email as customer_email, c.phone as customer_phone
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (options.status) {
      query += ` AND o.status = ?`;
      params.push(options.status);
    }

    query += ` ORDER BY o.created_at DESC`;
    const list = db.prepare(query).all(...params);

    for (const ord of list) {
      ord.items = db.prepare(`
        SELECT oi.*, p.name as product_name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `).all(ord.id);
    }

    return list;
  }

  updateStatus(id, newStatus, paymentStatus = null) {
    db.prepare(`
      UPDATE orders
      SET status = ?,
          payment_status = COALESCE(?, payment_status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, paymentStatus, id);

    return this.findById(id);
  }
}

module.exports = new OrderRepository();
