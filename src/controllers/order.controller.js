const cartService = require('../services/cart.service');
const orderService = require('../services/order.service');

class OrderController {
  // Helper to determine customer ID
  _getCustomerId(req) {
    if (req.user && req.user.customerId) return req.user.customerId;
    if (req.headers['x-customer-id']) return parseInt(req.headers['x-customer-id']);
    return 1; // Default customer ID for demo
  }

  // GET /cart (UC-26 / US-30)
  async getCart(req, res) {
    try {
      const customerId = this._getCustomerId(req);
      const cart = await cartService.getCart(customerId);
      res.json({ success: true, data: cart });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /cart (UC-26 / US-30: Add to cart)
  async addToCart(req, res) {
    try {
      const customerId = this._getCustomerId(req);
      const { productId, quantity = 1 } = req.body;
      const cart = await cartService.addItem(customerId, parseInt(productId), parseInt(quantity));
      res.json({ success: true, message: 'Item added to cart', data: cart });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // PUT /cart (UC-26 / US-30: Update quantity)
  async updateCartItem(req, res) {
    try {
      const customerId = this._getCustomerId(req);
      const { productId, quantity } = req.body;
      const cart = await cartService.updateQuantity(customerId, parseInt(productId), parseInt(quantity));
      res.json({ success: true, message: 'Cart updated', data: cart });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // DELETE /cart (UC-26: Remove item or clear cart)
  async removeFromCart(req, res) {
    try {
      const customerId = this._getCustomerId(req);
      const { productId } = req.query;
      if (productId) {
        const cart = await cartService.removeItem(customerId, parseInt(productId));
        res.json({ success: true, message: 'Item removed', data: cart });
      } else {
        await cartService.clearCart(customerId);
        res.json({ success: true, message: 'Cart cleared' });
      }
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // POST /orders (UC-27 / US-31 / SEQ-06: Checkout)
  async checkout(req, res) {
    try {
      const customerId = this._getCustomerId(req);
      const { deliveryAddress, paymentMethod, notes } = req.body;

      const order = await orderService.checkout({
        customerId,
        deliveryAddress,
        paymentMethod,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Order placed successfully and stock reserved',
        data: order
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // GET /orders/my (UC-28 / Customer order tracking)
  async getMyOrders(req, res) {
    try {
      const customerId = this._getCustomerId(req);
      const orders = await orderService.getCustomerOrders(customerId);
      res.json({ success: true, count: orders.length, data: orders });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /orders/:id (UC-28)
  async getOrderById(req, res) {
    try {
      const order = await orderService.getOrderById(parseInt(req.params.id));
      res.json({ success: true, data: order });
    } catch (err) {
      res.status(404).json({ success: false, error: err.message });
    }
  }

  // GET /orders (Store Manager - UC-24: List all orders)
  async getAllOrders(req, res) {
    try {
      const { status } = req.query;
      const orders = await orderService.getAllOrders({ status });
      res.json({ success: true, count: orders.length, data: orders });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // PUT /orders/:id/status (Store Manager - UC-24 / US-28: Pack, Dispatch, Deliver, Cancel)
  async updateStatus(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const performedBy = req.user ? req.user.id : null;

      const order = await orderService.updateOrderStatus(id, status, performedBy);
      res.json({
        success: true,
        message: `Order #${order.order_number} updated to ${status}`,
        data: order
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = new OrderController();
