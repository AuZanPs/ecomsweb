# Research: Comprehensive E-Commerce Platform

## Overview
Foundation research supporting Phase 0 decisions for the e-commerce MVP.

## Decisions & Rationale
| Area | Decision | Rationale | Alternatives | Status |
|------|----------|-----------|-------------|--------|
| Payment Provider | Stripe first | Rich docs, test modes, rapid integration | PayPal, Adyen | Adopt |
| Auth Token Handling | HTTP-only cookie (JWT) | Mitigate XSS token theft | Local storage, Session storage | Adopt |
| Password Hashing | bcrypt (cost=12) | Proven, widely supported | Argon2 (more setup) | Adopt |
| Currency Handling | Store price as int cents | Avoid FP rounding issues | Decimal128 (Mongo), float | Adopt |
| Stock Enforcement | Validate at add & checkout | Prevent oversell race window | Deferred optimistic lock | Adopt |
| Tax & Shipping | Flat zero in MVP | Simplifies flow; focus core | Config-driven rates | Defer |
| Order Statuses | Pending, Paid, Cancelled | Minimal viable tracking | Shipped, Delivered | Future |
| Product Search | name index + createdAt sort | Fast prefix/contains; simple | Full text search | Future |
| Data Access | Service layer over models | Encapsulate logic | Direct in controllers | Adopt |
| Retry Payment | Reuse order id until Paid | Avoid duplicates | New order per retry | Adopt |

## Risks
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Missing delivery statuses | Limited tracking realism | Add statuses post-Paid later |
| Single payment provider | Vendor dependency | Abstract provider interface early |
| No rate limiting | Potential abuse | Add middleware later |
| Simple search only | Relevance limitations | Upgrade to full-text index when needed |
| Flat tax/shipping | Unrealistic totals | Introduce config layer later |

## Assumptions
- Single currency (e.g., USD) in MVP.
- Admin UI out of scope for first increment (API only).
- No guest checkout; account required.
- Webhook security via shared secret.

## Glossary
- Cart Line Item: Product id + quantity + unit price snapshot.
- Payment Intent: External provider object representing a pending charge.

## Open Items (Deferred)
- Delivered / Shipped status modeling.
- Product reviews implementation.
- Inventory reservation strategy.

