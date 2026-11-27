# Dab Automotive — Member 4 (Roman Fatima - 241878)
## Inventory Control, Parts Requisitions & Automotive E-Commerce Subsystem

This repository contains the complete implementation for **Member 4 (Roman)** according to the team work division and design specifications in **Deliverable 1 & Deliverable 2**.

---

### 1. Ownership & Deliverable Scope

| Component | Specification Reference | Implementation Location |
| :--- | :--- | :--- |
| **Database Tables (12 tables)** | Deliverable 2 Section 5.1 (ERD), Table 15 | [db.js](file:///c:/Users/GM%20Computer/Desktop/5%20semester/WEB%20DEV/PROJECT/src/data/db.js) |
| **Inventory & Stock Transactions with Row Locking** | US-24, US-25, UC-21, Figure 41 (Data flow of stock) | [inventory.repository.js](file:///c:/Users/GM%20Computer/Desktop/5%20semester/WEB%20DEV/PROJECT/src/repositories/inventory.repository.js) |
| **Low-Stock Alerts & Auto-Notifications** | US-25, UC-21 | [inventory.service.js](file:///c:/Users/GM%20Computer/Desktop/5%20semester/WEB%20DEV/PROJECT/src/services/inventory.service.js) |
| **Parts Requisitions & Approval Lifecycle** | US-21, US-26, UC-18, UC-22, SEQ-05, AD-07 | [requisition.repository.js](file:///c:/Users/GM%20Computer/Desktop/5%20semester/WEB%20DEV/PROJECT/src/repositories/requisition.repository.js) |
| **Products, Categories & Compatibility Fitment** | US-27, US-29, UC-23, UC-25 | [product.repository.js](file:///c:/Users/GM%20Computer/Desktop/5%20semester/WEB%20DEV/PROJECT/src/repositories/product.repository.js) |
| **Shopping Cart Management** | US-30, UC-26 | [cart.repository.js](file:///c:/Users/GM%20Computer/Desktop/5%20semester/WEB%20DEV/PROJECT/src/repositories/cart.repository.js), [cart.service.js](file:///c:/Users/GM%20Computer/Desktop/5%20semester/WEB%20DEV/PROJECT/src/services/cart.service.js) |
| **Checkout & Web Orders with Stock Reservation** | US-31, UC-27, SEQ-06, AD-05 | [order.repository.js](file:///c:/Users/GM%20Computer/Desktop/5%20semester/WEB%20DEV/PROJECT/src/repositories/order.repository.js), [order.service.js](file:///c:/Users/GM%20Computer/Desktop/5%20semester/WEB%20DEV/PROJECT/src/services/order.service.js) |
| **Web Order Fulfilment State Machine** | US-28, UC-24, Table 69 (States) | `Placed` &rarr; `Packed` &rarr; `Dispatched` &rarr; `Delivered` (or `Cancelled`) |
| **Inventory & Store Manager Dashboard** | UC-35, Table 21 | [inventory.html](file:///c:/Users/GM%20Computer/Desktop/5%20semester/WEB%20DEV/PROJECT/public/inventory.html) |
| **Customer E-Commerce Storefront UI** | UC-25 to UC-28 | [index.html](file:///c:/Users/GM%20Computer/Desktop/5%20semester/WEB%20DEV/PROJECT/public/index.html) |

---

### 2. Architecture & Data Flow

#### A. Stock Segregation & Data Flow (Deliverable 2, Figure 41)
- **Workshop Stock (`workshop_qty`)**: Dedicated to workshop bay repairs and job cards. Deducted upon Store Manager approval of mechanic requisitions (`Issue`).
- **Web Stock (`web_qty`)**: Available for e-commerce purchases. Held in `reserved_qty` at checkout (`Reserve`).
- **Reserved Stock (`reserved_qty`)**: Converted into permanent sales upon order dispatch (`Sale`), or released back on cancellation (`Release`).
- **Stock Audit Ledger (`inventory_transactions`)**: Every movement (`Purchase`, `Allocation`, `Reserve`, `Issue`, `Sale`, `Release`, `Adjustment`) records timestamp, user, quantity, and source/destination pools.

#### B. Requisition Approval Workflow (SEQ-05 / AD-07)
1. Mechanic submits parts request via `POST /requisitions` for an active Job Card.
2. Store Manager reviews items and available workshop stock via `GET /requisitions`.
3. Store Manager approves via `PUT /requisitions/:id/approve`.
4. In an atomic transaction, the system verifies stock levels, decrements `workshop_qty`, registers `Issue` records in `inventory_transactions`, flags low-stock warnings if below threshold, and updates status to `Approved/Issued`.

#### C. Checkout & Order Fulfilment (SEQ-06 / AD-05)
1. Customer filters products by vehicle make/model/year (`GET /products?make=Toyota&model=Corolla&year=2021`) and adds to cart.
2. Customer checks out via `POST /orders`.
3. In an atomic transaction, the system verifies available `web_qty`, generates a unique order number, holds quantity in `reserved_qty`, creates order records, clears the cart, and notifies the Store Manager.
4. Store Manager transitions order through lifecycle states:
   - `Placed` &rarr; `Packed` &rarr; `Dispatched` (converts reserved stock to permanent sale) &rarr; `Delivered` (settles payment).

---

### 3. REST API Endpoints Implemented

#### Inventory & Transactions (Store Manager)
- `GET /inventory` — List parts catalog with stock levels and low-stock filters (UC-21)
- `GET /inventory/:partId` — Get single part details and stock pools
- `POST /inventory` — Create new part and initialize stock
- `PUT /inventory/:partId` — Update part pricing, active flag or threshold
- `POST /inventory/adjust` — Atomic restock, inter-pool allocation, or audit adjustment
- `GET /inventory/transactions` — Full inventory audit log

#### Parts Requisitions (Mechanic & Store Manager)
- `POST /requisitions` — Mechanic submits requisition linked to a Job Card (UC-18 / US-21)
- `GET /requisitions` — Query pending/processed requisitions (UC-22)
- `PUT /requisitions/:id/approve` — Approve requisition and deduct workshop stock (UC-22 / US-26)
- `PUT /requisitions/:id/reject` — Reject requisition with required reason (UC-22 / US-26)

#### Products & Compatibility Catalog (Public & Store Manager)
- `GET /products` — Browse products with vehicle make/model/year & price filters (UC-25 / US-29)
- `GET /products/categories` — Get category list
- `GET /products/:id` — Product details with fitment list
- `POST /products` — Add product to catalog (UC-23 / US-27)
- `PUT /products/:id` — Update product details and compatibility ranges
- `DELETE /products/:id` — Soft-delete product

#### Cart & Orders (Customer & Store Manager)
- `GET /cart` — View customer cart (UC-26 / US-30)
- `POST /cart` — Add item to cart with stock validation
- `PUT /cart` — Update item quantity
- `DELETE /cart` — Remove item or clear cart
- `POST /orders` — Atomic checkout with stock reservation (UC-27 / US-31)
- `GET /orders/my` — Customer order tracking history (UC-28)
- `GET /orders` — Store Manager order management (UC-24)
- `GET /orders/:id` — Detailed order tracking
- `PUT /orders/:id/status` — State machine transition (`Packed`, `Dispatched`, `Delivered`, `Cancelled`)

#### Dashboard & Notifications
- `GET /dashboard/inventory` — Summary metrics for Store Manager dashboard (UC-35)
- `GET /notifications` — Alert log for low stock and requisitions

---

### 4. Running the Application

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Seed Initial Demo Data:**
   ```bash
   npm run seed
   ```
3. **Run Automated Test Suite:**
   ```bash
   npm test
   ```
4. **Start the Web Server:**
   ```bash
   npm start
   ```
5. **Open in Browser:**
   - **Customer E-Commerce Storefront:** [http://localhost:4000/index.html](http://localhost:4000/index.html)
   - **Store Manager Inventory Dashboard:** [http://localhost:4000/inventory.html](http://localhost:4000/inventory.html)
