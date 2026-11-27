const productRepo = require('../repositories/product.repository');

class ProductController {
  // GET /products (Public - UC-25 / US-29: Browse, filter by price, category, vehicle make/model/year)
  async getProducts(req, res) {
    try {
      const {
        category,
        categoryId,
        search,
        minPrice,
        maxPrice,
        make,
        model,
        year
      } = req.query;

      const products = productRepo.findAll({
        categorySlug: category,
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        search,
        minPrice: minPrice ? parseFloat(minPrice) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        vehicleMake: make,
        vehicleModel: model,
        vehicleYear: year
      });

      res.json({ success: true, count: products.length, data: products });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /products/categories
  async getCategories(req, res) {
    try {
      const categories = productRepo.getAllCategories();
      res.json({ success: true, data: categories });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /products/:id
  async getProductById(req, res) {
    try {
      const prod = productRepo.findById(parseInt(req.params.id));
      if (!prod) return res.status(404).json({ success: false, error: 'Product not found' });
      res.json({ success: true, data: prod });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /products (Store Manager - UC-23 / US-27)
  async createProduct(req, res) {
    try {
      const product = productRepo.createProduct(req.body);
      res.status(201).json({ success: true, data: product });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // PUT /products/:id (Store Manager - UC-23 / US-27)
  async updateProduct(req, res) {
    try {
      const id = parseInt(req.params.id);
      const product = productRepo.updateProduct(id, req.body);
      res.json({ success: true, data: product });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // DELETE /products/:id (Store Manager - UC-23: Soft delete)
  async deleteProduct(req, res) {
    try {
      const id = parseInt(req.params.id);
      productRepo.softDeleteProduct(id);
      res.json({ success: true, message: 'Product deleted (soft delete)' });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = new ProductController();
