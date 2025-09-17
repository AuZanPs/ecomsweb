## **Project Vision Statement**
Deliver a reliable, secure, and user‑friendly e‑commerce website that enables customers to seamlessly discover products, add them to a cart, complete secure payments, and track orders end‑to‑end—while showcasing full‑stack proficiency across authentication, data modeling, API design, payment integration, and scalable architecture suitable as a portfolio centerpiece for real‑world commerce scenarios.

## **Core User Personas**
- **Customer / Registered User**: Browses and searches products, views product details (images, pricing, availability), manages a personal shopping cart, completes secure checkout, pays via integrated gateway, tracks order status, and submits product reviews after delivery.
- **Site Administrator**: Oversees platform health and data integrity, manages order status life cycle, and monitors user activity and product catalog quality (implicit stewardship required for accurate listings and fulfillment coordination).

## **Core Modules & Minimum Viable Features (MVF)**

### **Module 1: User Authentication** (User login and authentication)
- User registration with required fields: name, email, password.
- Enforce unique email constraint; reject duplicates with clear error.
- Passwords stored using a secure hashing algorithm (e.g., bcrypt) — never plain text.
- Login with email + password returns a signed JWT auth token.
- Protected API routes require valid JWT (authorization middleware).
- Logout accomplished client‑side by removing stored token; server validates token signature only (stateless sessions).
- Basic profile endpoint returns authenticated user’s id, name, and email.

### **Module 2: Product Catalog** (Product search and listing with details, images, pricing)
- Public product listing endpoint with pagination (page number & page size params).
- Search capability by product name (case‑insensitive substring match).
- Each product exposes: id, name, description, price, primary image URL, stock status (in/out of stock).
- Product detail endpoint returns full product record for a given id.
- Results ordered by creation date descending by default.
- Graceful handling when no products match (empty list, not error).

### **Module 3: Shopping Cart** (Shopping cart functionality to add/remove items)
- Authenticated user maintains a single active cart stored in database.
- Add product to cart with specified quantity (default 1); validate product exists and is in stock.
- Update line item quantity (must remain > 0) or remove item entirely.
- Prevent adding quantity exceeding available stock at time of action.
- Retrieve cart endpoint returns item list with: product id, name, unit price, quantity, line subtotal, and overall subtotal.
- Cart automatically recalculates subtotal server‑side (no client trust).

### **Module 4: Secure Checkout & Payments** (Secure payment gateway integration)
- Checkout endpoint validates cart is not empty and all items still in stock.
- Collect shipping and billing contact fields (minimal: full name, address, city, postal code, country, email).
- Calculate order total (sum of line items) plus placeholder tax/shipping logic (flat values in MVP).
- Create payment intent/session via selected gateway (Stripe or PayPal) and return client secret / approval URL.
- Store only gateway transaction/reference id—never raw card data.
- Mark provisional order state as “Payment Pending” until gateway confirmation.
- On successful gateway confirmation, transition order to “Paid.”
- On failure/cancellation, expose clear status and allow retry without duplicating order records.

### **Module 5: Order Management** (Order tracking and review system)
- Create order record from paid cart capturing: user id, items (product id, quantity, unit price), totals, status timeline.
- Supported statuses: Payment Pending → Paid → Shipped → Delivered (→ Cancelled when applicable).
- Customer can view list of their orders with summary (id, date, total, current status).
- Order detail endpoint shows full line items, current status, and minimal history (at least created + latest status timestamp).
- Customer can submit a product review (rating + short text) only after order status = Delivered and only for purchased items.
- Administrator can update order status (e.g., Paid → Shipped → Delivered or Paid → Cancelled) with validation of allowed transitions.
- Order listing for admin supports filtering by status.

## **Mandated Technology Stack**
- **Frontend: ReactJS or Angular** — Provides a dynamic, component‑based interface for product browsing, cart interactions, and responsive user experience.
- **Backend: Node.js with Express.js** — Implements RESTful APIs for authentication, product data access, cart operations, checkout orchestration, and order life cycle management.
- **Database: MongoDB** — Stores users, products, carts, and orders with flexible document schemas supporting rapid iteration and scaling.

## **Key Non-Functional Requirements (NFRs)**
- **Security**: Enforce hashed credentials, JWT-based stateless auth, least-privilege data access, and secure payment processing by delegating sensitive card handling to the gateway; all sensitive operations must assume transport over HTTPS.
- **Performance**: Implement paginated product queries, minimize payload sizes, and ensure fast client interactions through efficient API responses (<~300ms target for core reads under normal load) and cached static assets.
- **Scalability**: Design stateless backend services allowing horizontal scaling; leverage MongoDB indexing on frequently queried fields (e.g., product name) and modular API boundaries to support future feature expansion.

**Version**: 1.0.0 | **Ratified**: 2025-09-16 | **Last Amended**: 2025-09-16