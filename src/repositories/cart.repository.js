const { db } = require('../data/db');

class CartRepository {
  getOrCreateCart(customerId) {
    let cart = db.prepare(`SELECT * FROM carts WHERE customer_id = ?`).get(customerId);
    if (!cart) {
      const info = db.prepare(`INSERT INTO carts (customer_id) VALUES (?)`).run(customerId);
      cart = db.prepare(`SELECT * FROM carts WHERE id = ?`).get(info.lastInsertRowid);
    }
    return cart;
  }

  getCartWithItems(customerId) {
    const cart = this.getOrCreateCart(customerId);

    const items = db.prepare(`
      SELECT ci.id as cart_item_id, ci.quantity, ci.product_id,
             p.name, p.slug, p.sku, p.price, p.image_url, p.part_id,
             COALESCE(i.web_qty, 0) as available_web_stock,
             (ci.quantity * p.price) as item_total
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN inventory i ON p.part_id = i.part_id
      WHERE ci.cart_id = ?
    `).all(cart.id);

    const subtotal = items.reduce((sum, item) => sum + item.item_total, 0);

    return {
      cartId: cart.id,
      customerId,
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      updated_at: cart.updated_at
    };
  }

  addItem(customerId, productId, quantity) {
    const cart = this.getOrCreateCart(customerId);

    const existing = db.prepare(`
      SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?
    `).get(cart.id, productId);

    if (existing) {
      db.prepare(`
        UPDATE cart_items SET quantity = quantity + ? WHERE id = ?
      `).run(quantity, existing.id);
    } else {
      db.prepare(`
        INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)
      `).run(cart.id, productId, quantity);
    }

    db.prepare(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(cart.id);
    return this.getCartWithItems(customerId);
  }

  updateItemQuantity(customerId, productId, quantity) {
    const cart = this.getOrCreateCart(customerId);

    if (quantity <= 0) {
      return this.removeItem(customerId, productId);
    }

    db.prepare(`
      UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?
    `).run(quantity, cart.id, productId);

    db.prepare(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(cart.id);
    return this.getCartWithItems(customerId);
  }

  removeItem(customerId, productId) {
    const cart = this.getOrCreateCart(customerId);
    db.prepare(`DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?`).run(cart.id, productId);
    db.prepare(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(cart.id);
    return this.getCartWithItems(customerId);
  }

  clearCart(customerId) {
    const cart = this.getOrCreateCart(customerId);
    db.prepare(`DELETE FROM cart_items WHERE cart_id = ?`).run(cart.id);
    db.prepare(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(cart.id);
    return { success: true };
  }
}

module.exports = new CartRepository();
