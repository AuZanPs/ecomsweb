# Auth API Contracts

## POST /api/auth/register
Request:
```
{ email, name, password }
```
Response 201:
```
{ id, email, name }
```
Errors:
- 400 duplicate email

## POST /api/auth/login
Request:
```
{ email, password }
```
Response 200:
```
{ token, user: { id, email, name } }
```
Errors:
- 401 invalid credentials

## GET /api/auth/profile
Headers: Authorization: Bearer <token>
Response 200:
```
{ id, email, name }
```
Errors:
- 401 unauthorized

## POST /api/auth/logout
Clears auth context (client action).
Response 204
