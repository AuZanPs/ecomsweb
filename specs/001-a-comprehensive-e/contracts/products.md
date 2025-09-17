# Products API Contracts

## GET /api/products
Query: page, limit, search
Response 200:
```
{ page, limit, total, items: [ { id, name, description, priceCents, imageUrl, stock, createdAt } ] }
```

## GET /api/products/:id
Response 200:
```
{ id, name, description, priceCents, imageUrl, stock, createdAt }
```
Errors:
- 404 not found
