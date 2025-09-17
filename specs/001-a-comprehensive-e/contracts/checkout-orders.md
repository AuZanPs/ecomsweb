# Checkout & Orders API Contracts

## POST /api/checkout
Request:
```
{ shipping: { fullName, address1, address2?, city, region?, postalCode, country, email } }
```
Response 200:
```
{ orderId, status: "Payment Pending", payment: { provider: "stripe", clientSecret } }
```
Errors:
- 400 cart empty
- 409 stock conflict (details per item)

## POST /api/payments/webhook
Provider to system event.
Response 200 always (idempotent).

## GET /api/orders
Response 200:
```
{ items: [ { id, createdAt, status, totalCents } ] }
```

## GET /api/orders/:id
Response 200:
```
{ id, status, subtotalCents, totalCents, items:[ { productId, quantity, unitPriceCents } ], timeline: { createdAt, paidAt?, cancelledAt? } }
```
Errors:
- 404 not found

## POST /api/orders/:id/cancel
Response 200:
```
{ id, status: "Cancelled" }
```
Errors:
- 400 invalid status transition
