const { db } = require('../data/db');

class ProductRepository {
  findAll(options = {}) {
    let query = `
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             COALESCE(i.web_qty, 0) as stock_qty,
             CASE WHEN COALESCE(i.web_qty, 0) > 0 THEN 1 ELSE 0 END as in_stock
      FROM products p
      JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.part_id = i.part_id
      WHERE p.is_active = 1
    `;
    const params = [];

    if (options.categorySlug) {
      query += ` AND c.slug = ?`;
      params.push(options.categorySlug);
    }

    if (options.categoryId) {
      query += ` AND p.category_id = ?`;
      params.push(options.categoryId);
    }

    if (options.search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)`;
      params.push(`%${options.search}%`, `%${options.search}%`, `%${options.search}%`);
    }

    if (options.minPrice !== undefined) {
      query += ` AND p.price >= ?`;
      params.push(options.minPrice);
    }

    if (options.maxPrice !== undefined) {
      query += ` AND p.price <= ?`;
      params.push(options.maxPrice);
    }

    // Vehicle compatibility filter (US-29 / UC-25: make, model, year)
    if (options.vehicleMake || options.vehicleModel || options.vehicleYear) {
      query += ` AND p.id IN (
        SELECT pc.product_id FROM product_compatibility pc
        WHERE 1=1
      `;
      if (options.vehicleMake) {
        query += ` AND LOWER(pc.make) = LOWER(?)`;
        params.push(options.vehicleMake);
      }
      if (options.vehicleModel) {
        query += ` AND LOWER(pc.model) = LOWER(?)`;
        params.push(options.vehicleModel);
      }
      if (options.vehicleYear) {
        query += ` AND ? BETWEEN pc.year_from AND pc.year_to`;
        params.push(parseInt(options.vehicleYear));
      }
      query += ` )`;
    }

    query += ` ORDER BY p.created_at DESC`;
    const products = db.prepare(query).all(...params);

    // Attach compatibility details
    for (const prod of products) {
      prod.compatibility = db.prepare(`
        SELECT * FROM product_compatibility WHERE product_id = ?
      `).all(prod.id);
    }

    return products;
  }

  findById(id) {
    const prod = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             COALESCE(i.web_qty, 0) as stock_qty,
             i.reserved_qty
      FROM products p
      JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.part_id = i.part_id
      WHERE p.id = ?
    `).get(id);

    if (!prod) return null;

    prod.compatibility = db.prepare(`
      SELECT * FROM product_compatibility WHERE product_id = ?
    `).all(id);

    return prod;
  }

  createProduct({ category_id, part_id, name, slug, sku, description, price, image_url, compatibility = [] }) {
    const createTx = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO products (category_id, part_id, name, slug, sku, description, price, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(category_id, part_id || null, name, slug, sku, description, price, image_url || null);
      const productId = info.lastInsertRowid;

      if (compatibility && compatibility.length > 0) {
        const compStmt = db.prepare(`
          INSERT INTO product_compatibility (product_id, make, model, year_from, year_to, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const c of compatibility) {
          compStmt.run(productId, c.make, c.model, c.year_from, c.year_to, c.notes || null);
        }
      }

      return this.findById(productId);
    });

    return createTx();
  }

  updateProduct(id, { category_id, name, description, price, image_url, is_active, compatibility }) {
    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE products
        SET category_id = COALESCE(?, category_id),
            name = COALESCE(?, name),
            description = COALESCE(?, description),
            price = COALESCE(?, price),
            image_url = COALESCE(?, image_url),
            is_active = COALESCE(?, is_active),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(category_id, name, description, price, image_url, is_active, id);

      if (compatibility !== undefined) {
        db.prepare(`DELETE FROM product_compatibility WHERE product_id = ?`).run(id);
        const compStmt = db.prepare(`
          INSERT INTO product_compatibility (product_id, make, model, year_from, year_to, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const c of compatibility) {
          compStmt.run(id, c.make, c.model, c.year_from, c.year_to, c.notes || null);
        }
      }

      return this.findById(id);
    });

    return updateTx();
  }

  softDeleteProduct(id) {
    db.prepare(`UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
    return true;
  }

  // Categories
  getAllCategories() {
    return db.prepare(`SELECT * FROM product_categories ORDER BY name ASC`).all();
  }

  createCategory({ name, slug, description }) {
    const stmt = db.prepare(`
      INSERT INTO product_categories (name, slug, description)
      VALUES (?, ?, ?)
    `);
    const info = stmt.run(name, slug, description);
    return db.prepare(`SELECT * FROM product_categories WHERE id = ?`).get(info.lastInsertRowid);
  }
}

module.exports = new ProductRepository();
