const cartRepo = require('../repositories/cart.repository');
const productRepo = require('../repositories/product.repository');

class CartService {
  async getCart(customerId) {
    return cartRepo.getCartWithItems(customerId);
  }

  async addItem(customerId, productId, quantity) {
    if (!productId || quantity <= 0) {
      throw new Error('Valid productId and quantity > 0 are required');
    }

    const product = productRepo.findById(productId);
    if (!product || !product.is_active) {
      throw new Error('Product not found or inactive');
    }

    // Check available web stock
    if (product.stock_qty < quantity) {
      throw new Error(`Cannot add ${quantity} item(s). Only ${product.stock_qty} in stock.`);
    }

    return cartRepo.addItem(customerId, productId, quantity);
  }

  async updateQuantity(customerId, productId, quantity) {
    const product = productRepo.findById(productId);
    if (!product) throw new Error('Product not found');

    if (quantity > product.stock_qty) {
      throw new Error(`Requested quantity exceeds available stock of ${product.stock_qty}`);
    }

    return cartRepo.updateItemQuantity(customerId, productId, quantity);
  }

  async removeItem(customerId, productId) {
    return cartRepo.removeItem(customerId, productId);
  }

  async clearCart(customerId) {
    return cartRepo.clearCart(customerId);
  }
}

module.exports = new CartService();
