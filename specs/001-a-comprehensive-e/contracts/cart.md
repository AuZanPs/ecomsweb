# Cart API Contracts

## GET /api/cart
Response 200:
```
{ items: [ { productId, name, unitPriceCents, quantity, lineSubtotalCents } ], subtotalCents }
```

## POST /api/cart
Request:
```
{ productId, quantity }
```
Response 200:
```
{ items:[...], subtotalCents }
```
Errors:
- 404 product not found
- 400 invalid quantity
- 409 insufficient stock

## PATCH /api/cart/item/:productId
Request:
```
{ quantity }
```
Response 200 updated cart.

## DELETE /api/cart/item/:productId
Response 204
