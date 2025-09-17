# Data Model

## Entities

### User
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| _id | ObjectId | PK | |
| email | string | unique, required, lowercase | Indexed |
| name | string | required | |
| passwordHash | string | required | bcrypt hash |
| createdAt | Date | required | default now |

### Product
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| _id | ObjectId | PK | |
| name | string | required | index (text or collation) |
| description | string | required | |
| priceCents | int | >0 | store cents |
| imageUrl | string | required | |
| stock | int | >=0 | decrease on order capture |
| createdAt | Date | required | default now |
| updatedAt | Date | required | update on change |

### Cart
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| _id | ObjectId | PK | |
| userId | ObjectId | unique, required | references User |
| items | array<CartItem> | | validated sizes |
| updatedAt | Date | required | refreshed on mutation |

#### CartItem (embedded)
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| productId | ObjectId | required | |
| quantity | int | >=1 | <= current stock on change |
| unitPriceCents | int | >0 | snapshot at add/update |

### Order
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| _id | ObjectId | PK | |
| userId | ObjectId | required | references User |
| status | string | enum(Pending,Paid,Cancelled) | index |
| items | array<OrderItem> | required | snapshot from cart |
| subtotalCents | int | >=0 | sum item subtotal |
| totalCents | int | >=0 | subtotal + adjustments |
| paymentRef | string | nullable | provider intent/charge id |
| createdAt | Date | required | default now |
| paidAt | Date | nullable | set when Paid |
| cancelledAt | Date | nullable | set when Cancelled |

#### OrderItem (embedded)
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| productId | ObjectId | required | |
| quantity | int | >=1 | |
| unitPriceCents | int | >0 | snapshot |
| lineSubtotalCents | int | >=0 | quantity * unitPriceCents |

### PaymentEvent
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| _id | ObjectId | PK | |
| orderId | ObjectId | required | references Order |
| provider | string | required | 'stripe' initially |
| type | string | enum(intent,confirmation,failure) | |
| meta | object | | minimal payload subset |
| createdAt | Date | required | default now |

## Relationships
- User 1 - 1 Cart
- User 1 - * Orders
- Product 1 - * (CartItem|OrderItem) references
- Order 1 - * PaymentEvents

## Indexing Plan
| Collection | Field(s) | Type | Purpose |
|------------|----------|------|---------|
| users | email | unique | Auth lookup |
| products | name | text/collation | Search |
| products | createdAt | descending | Recent listing |
| orders | userId,status,createdAt | compound | History queries |

## State Transitions (Order)
Pending -> Paid
Pending -> Cancelled
Paid -> Cancelled (manual)
(No other transitions)

## Validation Rules Summary
- priceCents positive int
- quantity positive int
- status restricted to enum
- snapshot pricing used for orders
- cart quantity never exceeds current product stock on change
