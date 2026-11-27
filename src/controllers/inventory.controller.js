const inventoryService = require('../services/inventory.service');
const productRepo = require('../repositories/product.repository');

class InventoryController {
  // GET /inventory (UC-21)
  async getInventory(req, res) {
    try {
      const { search, lowStockOnly } = req.query;
      const parts = await inventoryService.getAllInventory({
        search,
        lowStockOnly: lowStockOnly === 'true'
      });
      res.json({ success: true, count: parts.length, data: parts });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /inventory/:partId
  async getPartById(req, res) {
    try {
      const part = await inventoryService.getPartById(parseInt(req.params.partId));
      res.json({ success: true, data: part });
    } catch (err) {
      res.status(404).json({ success: false, error: err.message });
    }
  }

  // POST /inventory (Create new Part)
  async createPart(req, res) {
    try {
      const part = await inventoryService.createPart(req.body);
      res.status(201).json({ success: true, data: part });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // PUT /inventory/:partId (UC-21)
  async updatePart(req, res) {
    try {
      const partId = parseInt(req.params.partId);
      const updated = await inventoryService.updatePart(partId, req.body);
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // POST /inventory/adjust (UC-21: Purchase, Allocation, Adjustment)
  async adjustStock(req, res) {
    try {
      const { partId, adjustmentType, quantity, sourceStock, destinationStock, notes } = req.body;
      const performedBy = req.user ? req.user.id : null;

      const result = await inventoryService.adjustStock({
        partId: parseInt(partId),
        adjustmentType,
        quantity: parseInt(quantity),
        sourceStock,
        destinationStock,
        performedBy,
        notes
      });

      res.json({ success: true, message: 'Stock adjusted successfully', data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // GET /requisitions (UC-22)
  async getRequisitions(req, res) {
    try {
      const { status, jobCardId } = req.query;
      const requisitions = await inventoryService.getRequisitions({ status, jobCardId });
      res.json({ success: true, count: requisitions.length, data: requisitions });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /requisitions (UC-18 / US-21)
  async submitRequisition(req, res) {
    try {
      const { jobCardId, items } = req.body;
      const requestedBy = req.user ? req.user.id : 1; // Default mechanic if testing

      const reqRecord = await inventoryService.submitRequisition({
        jobCardId: parseInt(jobCardId),
        requestedBy,
        items
      });

      res.status(201).json({ success: true, message: 'Requisition submitted', data: reqRecord });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // PUT /requisitions/:id/approve (UC-22 / US-26 / SEQ-05)
  async approveRequisition(req, res) {
    try {
      const id = parseInt(req.params.id);
      const performedBy = req.user ? req.user.id : null;
      const result = await inventoryService.approveRequisition(id, performedBy);
      res.json({ success: true, message: 'Requisition approved and stock deducted', data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // PUT /requisitions/:id/reject (UC-22 / US-26)
  async rejectRequisition(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      const performedBy = req.user ? req.user.id : null;
      const result = await inventoryService.rejectRequisition(id, reason, performedBy);
      res.json({ success: true, message: 'Requisition rejected', data: result });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // GET /dashboard/inventory (UC-35)
  async getDashboard(req, res) {
    try {
      const metrics = await inventoryService.getDashboardMetrics();
      res.json({ success: true, data: metrics });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /inventory/transactions
  async getTransactions(req, res) {
    try {
      const partId = req.query.partId ? parseInt(req.query.partId) : null;
      const list = await require('../repositories/inventory.repository').getTransactions(partId);
      res.json({ success: true, count: list.length, data: list });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /notifications
  async getNotifications(req, res) {
    try {
      const role = req.user ? req.user.role : 'Store Manager';
      const notifications = inventoryService.getNotifications(role);
      res.json({ success: true, count: notifications.length, data: notifications });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new InventoryController();
