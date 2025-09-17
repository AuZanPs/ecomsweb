# Implementation Plan: Comprehensive E-Commerce Platform Core Feature Set

**Branch**: `001-a-comprehensive-e` | **Date**: 2025-09-16 | **Spec**: `/specs/001-a-comprehensive-e/spec.md`
**Input**: Feature specification from `/specs/001-a-comprehensive-e/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path → SUCCESS
2. Fill Technical Context (scan for NEEDS CLARIFICATION) → All resolved in spec
3. Fill the Constitution Check section based on constitution → PASS (no violations)
4. Evaluate Constitution Check section → PASS; update progress
5. Execute Phase 0 → research.md (documented below)
6. Execute Phase 1 → contracts/, data-model.md, quickstart.md (created below)
7. Re-evaluate Constitution Check → PASS
8. Plan Phase 2 (describe task generation approach) → Included
9. STOP - Ready for /tasks command
```

## Summary
Implement an MVP e-commerce platform covering user authentication, product catalog browsing/search, shopping cart management, secure checkout with external payment session, and minimal order lifecycle (Payment Pending → Paid with cancellation path) using a MERN-style stack (MongoDB, Express/Node backend, React frontend) with stateless JWT authentication and clearly defined domain models.

## Technical Context
**Language/Version**: Node.js (LTS 20.x), TypeScript (planned), React 18.x
**Primary Dependencies**: Express.js, Mongoose (ODM), JSON Web Token lib, Bcrypt, Payment SDK (Stripe first; abstraction to allow PayPal later)
**Storage**: MongoDB (collections: users, products, carts, orders, paymentEvents)
**Testing**: Jest + Supertest (backend), React Testing Library (frontend), contract tests via supertest harness
**Target Platform**: Web (browser frontend + Node backend)
**Project Type**: web (frontend + backend) → Structure Option 2
**Performance Goals**: <300ms p95 for product list & cart operations under nominal load (single region)
**Constraints**: Stateless API nodes; no partial order fulfillment; flat tax/shipping = 0 in MVP; minimal statuses (Pending, Paid, Cancelled)
**Scale/Scope**: Initial target ~1k daily active users; product catalog <10k items; order write rate low (<5/min) MVP

## Constitution Check
All core module requirements in constitution are represented by functional requirements FR-001..FR-034.
| Constitution Module | Coverage | Notes |
|---------------------|----------|-------|
| User Authentication | FR-001–FR-004, FR-028 | Secure hashing, JWT, uniqueness enforced |
| Product Catalog | FR-005–FR-007, FR-025–FR-027 | Pagination & search in design (see contracts) |
| Shopping Cart | FR-008–FR-013, FR-029–FR-030 | Stock validation & adjustment flows defined |
| Secure Checkout & Payments | FR-014–FR-023, FR-031–FR-033 | External payment intent, retry semantics |
| Order Management | FR-017–FR-024, FR-034 | Minimal lifecycle + timestamp audit |
| NFR Security | Hashing, JWT, stateless, no raw card data | Payment token only |
| NFR Performance | Pagination, minimal payload design | Indexes planned on product name & createdAt |
| NFR Scalability | Stateless API, indexed queries | Horizontal scale readiness |

No violations requiring Complexity Tracking. Structure Option 2 (web) justified by distinct frontend + backend separation.

## Project Structure
Using Web application (Option 2) with separate `backend/` and `frontend/` plus shared specification docs under `specs/`.

### Documentation (this feature)
```
specs/001-a-comprehensive-e/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── spec.md
```

### Source Code (planned)
```
backend/
  src/
    models/
    services/
    api/
      routes/
      middleware/
      controllers/
    utils/
  tests/
    contract/
    integration/
    unit/
frontend/
  src/
    components/
    pages/
    hooks/
    services/
    context/
  tests/
```

**Structure Decision**: Option 2 (web) due to distinct client + server responsibilities.

## Phase 0: Outline & Research
### Key Unknowns (now resolved)
- Payment provider selection: Choose Stripe for MVP (widest docs, test mode ease).
- Token storage approach: HTTP-only cookie vs local storage — choose HTTP-only cookie for XSS mitigation; fallback local storage optional for demo simplicity (documented risk).
- Product search indexing: Create index on `name` (text or case-insensitive collation) + `createdAt`.
- Order consistency: Snapshot unit price into order items.
- Retry semantics: Single order while Payment Pending; reuses same order id.

### Research Decisions Summary
| Decision | Rationale | Alternatives |
|----------|-----------|--------------|
| Stripe first | Fast integration, good docs | PayPal (add later) |
| HTTP-only cookie auth token | XSS mitigation | Local storage (higher risk) |
| Mongoose ODM | Rapid schema iteration | Native driver (more boilerplate) |
| Separate frontend/backend | Clear separation of concerns | Monolith single folder (less clarity) |
| Flat tax/shipping 0 | Simplify MVP | Dynamic rates (adds complexity) |

See `research.md` for expanded rationale.

## Phase 1: Design & Contracts
### Data Model Overview (excerpt)
- User: email(unique), name, passwordHash, createdAt
- Product: name, description, price (decimal stored as int cents), imageUrl, stock, createdAt, updatedAt
- Cart: userId(unique), items[{ productId, quantity, unitPriceSnapshot }], updatedAt
- Order: userId, status(enum: Pending|Paid|Cancelled), items[{ productId, quantity, unitPrice }], subtotal, total, createdAt, paidAt?, cancelledAt?, paymentRef
- PaymentEvent: orderId, provider, type(intent|confirmation|failure), payloadMeta, createdAt

### API Contract Summary (endpoints)
Auth:
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/profile

Products:
- GET /api/products?page&limit&search
- GET /api/products/:id

Cart:
- GET /api/cart
- POST /api/cart (add {productId, quantity})
- PATCH /api/cart/item/:productId (update quantity)
- DELETE /api/cart/item/:productId

Checkout / Payments:
- POST /api/checkout (validates + creates payment intent) → returns {clientSecret|approvalUrl}
- POST /api/payments/webhook (provider -> system event ingestion)

Orders:
- GET /api/orders
- GET /api/orders/:id
- POST /api/orders/:id/cancel (if Pending or Paid per policy)

### Validation & Rules
- Registration: password length ≥ 8
- Product: stock ≥ 0; price > 0 cents
- Cart add/update: quantity ≥1 and ≤ stock
- Checkout: cart not empty; each item quantity ≤ current stock else adjust or block
- Order cancellation: Allowed only if status = Pending or Paid (records cancelledAt)

### Quickstart Outline
1. Install dependencies
2. Configure env (.env with Mongo URI, JWT secret, Stripe keys)
3. Seed sample products
4. Run backend dev server
5. Run frontend dev server
6. Execute contract tests
7. Perform manual checkout flow with test card

## Phase 2: Task Planning Approach
(To be executed by /tasks) — will map each FR to: model definitions, route + controller, service logic, validation middleware, tests (unit, contract, integration), frontend pages/components (Auth, Product List, Product Detail, Cart, Checkout, Orders).

## Phase 3+: Future Implementation
Out of scope for /plan.

## Complexity Tracking
None.

## Progress Tracking
**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
