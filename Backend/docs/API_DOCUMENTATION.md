# Jay Gurudevv Electricals Backend API

Base URL: `http://localhost:5000/api`

All responses are JSON except multipart uploads. Protected endpoints require:

```http
Authorization: Bearer <JWT>
```

Successful responses use `success: true`; errors use `success: false` and a `message`. Database credentials, JWTs, and password hashes are never returned by the API.

## Public endpoints

### Health

`GET /health`

```json
{
  "success": true,
  "message": "Jay GuruDev backend is running."
}
```

### Products

- `GET /products` and `GET /products/` — active catalog, with pagination and filters
- `GET /products/featured/list` — featured active products
- `GET /products/:id` — active product detail

Supported query parameters:

| Parameter | Meaning |
|---|---|
| `search` | Searches name, SKU, short/full description, size, brand and category |
| `category` | Exact display name or slug |
| `brand` | Exact display name or slug |
| `page` | 1-based page number; defaults to `1` |
| `limit` | Page size from `1` to `100`; defaults to `12` |
| `sort` | `newest`, `name_asc`, `name_desc`, `price_asc`, or `price_desc` |
| `featured` | `true` to filter featured products |
| `best_selling` | `true` to filter best-selling products |

Example request: `GET /products?search=12W&category=LED%20Lights&brand=Philips&page=1&limit=12`

Example item shape (product responses also include normalized columns):

```json
{
  "id": 14,
  "name": "LED Bulb",
  "brand": "Philips",
  "category": "LED Lights",
  "size": "9W / 12W",
  "image": "/uploads/led-bulb.webp",
  "badge": "Lighting",
  "images": [
    { "id": 21, "image_path": "/uploads/led-bulb.webp", "is_primary": 1, "display_order": 0 }
  ],
  "specifications": [
    { "id": 8, "name": "Wattage", "value": "9W / 12W" }
  ]
}
```

List responses wrap items with pagination:

```json
{
  "success": true,
  "data": [],
  "pagination": { "page": 1, "limit": 12, "total": 0, "totalPages": 0 }
}
```

### Categories and brands

- `GET /categories` — active categories with `name`, `slug`, `subtitle`, `description`, `icon`, `image`, and `display_order`
- `GET /brands` — active brands with `name`, `slug`, `category`, `description`, and optional `logo_url`

Example:

```json
{
  "success": true,
  "data": [
    { "id": 2, "name": "LED Lights", "slug": "led-lights", "subtitle": "Indoor & outdoor", "description": "Indoor and outdoor lighting products", "icon": "sun", "image": "/uploads/led-lights.webp" }
  ]
}
```

### Gallery, pages, banners, and business settings

- `GET /gallery` — active gallery entries with `image`, `title`, and `category`
- `GET /pages/` — active page records
- `GET /pages/:slug` — page and active sections
- `GET /pages/:pageId/sections` — active sections for a page
- `GET /banners` — active homepage promotional banners
- `GET /settings` — public business settings
- `GET /statistics` — active hero/business statistics in display order

`GET /settings` response:

```json
{
  "success": true,
  "business": {
    "name": "JAY GURUDEVV ELECTRIICALS",
    "phone": "+91 99744 91814",
    "phoneDigits": "919974491814",
    "email": "jaygurudevelectricals@gmail.com",
    "address": "Opp. Jilla Panchayat, Palanpur, Gujarat",
    "hours": "Mon – Sun · 9:00 AM – 9:00 PM",
    "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Opp.+Jilla+Panchayat%2C+Palanpur%2C+Gujarat",
    "socialFacebook": null,
    "socialInstagram": null,
    "socialYouTube": null,
    "socialWhatsApp": null
  },
  "settings": {
    "name": "JAY GURUDEVV ELECTRIICALS",
    "phone": "+91 99744 91814",
    "phoneDigits": "919974491814",
    "email": "jaygurudevelectricals@gmail.com",
    "address": "Opp. Jilla Panchayat, Palanpur, Gujarat",
    "hours": "Mon – Sun · 9:00 AM – 9:00 PM",
    "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Opp.+Jilla+Panchayat%2C+Palanpur%2C+Gujarat"
  },
  "data": [
    { "key_name": "name", "key_value": "JAY GURUDEVV ELECTRIICALS", "description": "Business display name" }
  ]
}
```

### Enquiries

`POST /enquiries` is public and stores submitted enquiries permanently. It accepts both current form names and normalized aliases:

```json
{
  "name": "Ravi Patel",
  "shop": "Patel Electricals",
  "city": "Palanpur",
  "phone": "+91 99999 12345",
  "requirement": "20 switches and 30 LED bulbs",
  "enquiry_type": "wholesale"
}
```

The response contains the stored record ID:

```json
{ "success": true, "message": "Enquiry submitted.", "id": 105 }
```

The current React wholesale form validates the mobile number, posts the enquiry to this endpoint, and also opens the existing WhatsApp message flow. It displays a saved confirmation or an explicit persistence error; WhatsApp opening alone is not treated as a successful save.

Product enquiries can use `enquiry_type: "product"` and optionally provide `items` entries with `product_id`, `product_name`, `quantity`, and `notes`.

## Admin authentication and endpoints

### Login and identity

- `POST /admin/login` — body `{ "email": "admin@example.com", "password": "<local secret>" }`
- `GET /admin/me` — authenticated admin identity
- `POST /admin/change-password` — body `{ "current_password": "...", "new_password": "at-least-12-characters" }`
- `GET /admin/activity` — latest 100 activity entries; super-admin only
- `GET /dashboard/summary` — counts for products, categories, brands, gallery images, all enquiries, active enquiries, and the six most recent enquiries

Example login response:

```json
{
  "success": true,
  "token": "<JWT>",
  "admin": { "id": 1, "full_name": "Super Admin", "email": "admin@example.com", "role": "super_admin", "phone": null }
}
```

Example dashboard response:

```json
{
  "success": true,
  "data": {
    "products": 12,
    "categories": 8,
    "brands": 10,
    "enquiries": 4,
    "galleryImages": 6,
    "activeEnquiries": 2,
    "recentEnquiries": [
      {
        "id": 105,
        "enquiry_type": "wholesale",
        "customer_name": "Ravi Patel",
        "customer_phone": "+91 99999 12345",
        "customer_city": "Palanpur",
        "customer_shop": "Patel Electricals",
        "requirement": "20 switches and 30 LED bulbs",
        "status": "new",
        "created_at": "2025-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

There is no public admin registration endpoint. Set `ADMIN_EMAIL` and a unique 12–128 character `ADMIN_PASSWORD` in the ignored local `.env`, then run `npm run seed-admin`. It creates an account if that normalized email does not exist; otherwise, it updates the matching account's normalized email and bcrypt password hash without creating a duplicate. The seed command activates the matching admin. Keep real credentials out of source control and frontend configuration.

### Protected content management

| Module | Admin list | Create | Read | Update | Delete |
|---|---|---|---|---|---|
| Products | `GET /products/admin/list` | `POST /products` | `GET /products/:id` | `PUT /products/:id` | `DELETE /products/:id` |
| Categories | `GET /categories/admin/list` | `POST /categories` | `GET /categories/:id` | `PUT /categories/:id` | `DELETE /categories/:id` |
| Brands | `GET /brands/admin/list` | `POST /brands` | `GET /brands/:id` | `PUT /brands/:id` | `DELETE /brands/:id` |
| Gallery | `GET /gallery/admin/list` | `POST /gallery` | included in list | `PUT /gallery/:id` | `DELETE /gallery/:id` |
| Banners | `GET /banners/admin/list` | `POST /banners` | included in list | `PUT /banners/:id` | `DELETE /banners/:id` |
| Pages | `GET /pages/admin/list` | `POST /pages` | `GET /pages/:slug` | `PUT /pages/:id` | `DELETE /pages/:id` |
| Settings | `GET /settings/admin/list` | `POST /settings` | included in list | `PUT /settings/:key_name` | `DELETE /settings/:key_name` |
| Business statistics | `GET /statistics/admin/list` | `POST /statistics` | included in list | `PUT /statistics/:id` | `DELETE /statistics/:id` |
| Enquiries | `GET /enquiries` | Public `POST /enquiries` | `GET /enquiries/:id` | `PATCH /enquiries/:id/status` | `DELETE /enquiries/:id` |

Example protected category update (JSON):

```http
PUT /api/categories/2
Content-Type: application/json
Authorization: Bearer <JWT>
```

```json
{
  "name": "LED Lights",
  "subtitle": "Indoor & outdoor",
  "description": "Energy-efficient products for home and commercial use",
  "icon": "sun",
  "is_active": true
}
```

Example response:

```json
{ "success": true, "message": "Category updated." }
```

Brand create accepts `name`, `category`, `description`, and `is_active` with an optional `logo` image upload. Banner create/update accepts `button_text`, `title`, `subtitle`, `highlight`, `description`, `link_url`, `category`, `display_order`, and `is_active`; `image` is optional on update and required for a visible homepage image.

Page-section management is available through protected `POST /pages/:pageId/sections`, `PUT /pages/:pageId/sections/:sectionId`, and `DELETE /pages/:pageId/sections/:sectionId`; the public section list is `GET /pages/:pageId/sections`.

Example page section request:

```json
{
  "section_key": "intro",
  "title": "About our showroom",
  "content": "A local destination for electrical essentials.",
  "image": "/uploads/showroom.webp",
  "display_order": 1
}
```

Example statistics item:

```json
{ "metric_key": "google_rating", "metric_value": "5.0", "label": "Google Rating", "display_order": 1 }
```

Product create/update accepts JSON or `multipart/form-data` with up to 12 `images` files. JSON `specifications` can be an array; in multipart requests, send it as a JSON-encoded string. Category upload field: `image`. Brand logo field: `logo`. Gallery and banner upload field: `image`. Images are stored under `Backend/uploads/`, and the saved public path is persisted in MySQL.

Product boolean flags (`price_on_request`, `is_featured`, `is_best_selling`, and `is_active`) accept JSON booleans or multipart `"true"` / `"false"` values and are normalized to MySQL boolean columns.

Example product creation JSON:

```json
{
  "name": "LED Bulb",
  "slug": "led-bulb",
  "sku": "LED-001",
  "category_id": 2,
  "brand_id": 3,
  "size": "9W / 12W",
  "badge": "Lighting",
  "price_on_request": true,
  "specifications": [{ "name": "Wattage", "value": "9W / 12W" }]
}
```

Enquiry status values: `new`, `contacted`, `quoted`, `closed`, and `rejected`. The admin UI labels `closed` as “Completed.” Status changes are written to `enquiry_status_history`. Enquiry deletion is authenticated, requires explicit confirmation in the admin UI, and removes linked items/history through the existing foreign-key cascades; the deletion is recorded in `admin_activity_logs`.

Example deletion:

```http
DELETE /api/enquiries/105
Authorization: Bearer <JWT>
```

```json
{ "success": true, "message": "Enquiry deleted." }
```

## Admin panel

The local admin interface is available at `http://localhost:5173/admin`. It reuses the protected endpoints in this document; there is no public admin registration. Login tokens expire after the configured JWT lifetime (currently eight hours); an expired token is cleared and the administrator is returned to sign-in. Admin content, uploads, page records, settings, and enquiry status changes use the existing MySQL tables.

## Operational limits and errors

- Uploaded images must be JPG/JPEG, PNG, or WEBP and no larger than 5 MiB each.
- Product uploads allow up to 12 images per request.
- API traffic is rate-limited; login and public enquiry submission have stricter limits.
- All database values are passed as prepared-statement parameters. Sort field names are selected from a fixed allowlist.
- Invalid/missing authentication returns HTTP 401; role violations return HTTP 403; validation errors return HTTP 400.

## Frontend integration

The frontend reads its API URL from `VITE_API_BASE_URL` (see `frontend/.env.example`). For local development, set it to `http://localhost:5000/api`. API media paths such as `/uploads/led-lights.webp` are resolved against the backend origin and served by Express. No database credentials, admin credentials, or JWT secrets belong in frontend environment variables.

The frontend content seed command imports the existing product, category, brand, gallery, banner, and page data and copies the referenced local images into the persistent uploads directory:

```powershell
Set-Location C:\Users\AMAN\Downloads\JayGuruDev\Backend
npm run seed-frontend-content
```

Public page, catalog, and content sections display loading, retryable error, and empty states. Product search, category/brand filters, sorting, and pagination use the documented product query parameters.
