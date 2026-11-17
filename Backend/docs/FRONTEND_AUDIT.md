# Frontend Audit for Jay Gurudevv Electricals

## 1. Frontend pages and routes

The frontend is a React + Vite single-page application with client-side routing. The existing routes and associated files are:

| Route | Page component | Purpose | Notes |
|---|---|---|---|
| `/` | `frontend/src/pages/Home.jsx` | Landing page | home hero, trust badges, category cards, promo banners, brand tiles, featured products, wholesale CTA, about section, gallery preview, testimonials, contact section |
| `/about` | `frontend/src/pages/About.jsx` | About page | About section, showroom details, WhatsApp CTA |
| `/products` | `frontend/src/pages/Products.jsx` | Catalog page | Search, category + brand filter, wholesale enquiry CTA |
| `/brands` | `frontend/src/pages/Brands.jsx` | Brand directory | list of brands linking to filtered catalog |
| `/gallery` | `frontend/src/pages/Gallery.jsx` | Gallery page | lightbox image gallery |
| `/contact` | `frontend/src/pages/Contact.jsx` | Contact page | contact section with map and details |
| `*` | `frontend/src/App.jsx` | fallback route | redirects to home |

## 2. Reusable components

### Layout and shared UI

- `frontend/src/components/layout/Navbar.jsx` — top navigation, search box, language selector, mobile menu toggle, active-indicator nav
- `frontend/src/components/layout/MobileMenu.jsx` — mobile nav overlay
- `frontend/src/components/layout/AnnouncementBar.jsx` — location + business info strip above header
- `frontend/src/components/layout/Footer.jsx` — footer with brand, explore links, categories, contact details
- `frontend/src/components/common/Button.jsx` — shared button/link component
- `frontend/src/components/common/SectionTitle.jsx` — common heading block used across pages
- `frontend/src/components/common/WhatsAppButton.jsx` — floating WhatsApp action button
- `frontend/src/components/common/WhatsAppIcon.jsx` — WhatsApp icon component
- `frontend/src/components/common/Loading.jsx` — placeholder/loading UI
- `frontend/src/components/common/ScrollToTop.jsx` — scroll UX helper

### Home sections

- `frontend/src/components/home/Hero.jsx` — hero section with business identity, call-to-action, trust stats, showroom details
- `frontend/src/components/home/TrustBadges.jsx` — four guarantee/trust tiles
- `frontend/src/components/home/CategorySection.jsx` — category cards with icon, name, subtitle, route to filtered product page
- `frontend/src/components/home/HomePromoBanners.jsx` — two editorial promo banners for lighting and appliances
- `frontend/src/components/home/BrandSection.jsx` — brand list tiles
- `frontend/src/components/home/FeaturedProducts.jsx` — featured product grid on home page
- `frontend/src/components/home/WholesaleBanner.jsx` — dealer/contractor CTA
- `frontend/src/components/home/AboutSection.jsx` — about story block used on home and full about page
- `frontend/src/components/home/GalleryPreview.jsx` — 3-photo preview linking to gallery
- `frontend/src/components/home/Testimonials.jsx` — customer feedback CTA
- `frontend/src/components/home/ContactSection.jsx` — showroom details, contact cards, map iframe

### Product catalog

- `frontend/src/components/products/ProductGrid.jsx` — query-state catalog filter/search wrapper
- `frontend/src/components/products/ProductSearch.jsx` — product search input
- `frontend/src/components/products/ProductFilters.jsx` — category and brand dropdowns
- `frontend/src/components/products/ProductCard.jsx` — catalog card with product image, badge, brand, size, WhatsApp inquiry button
- `frontend/src/components/forms/WholesaleEnquiryForm.jsx` — modal form used to collect wholesale enquiry details and open WhatsApp message

### Context

- `frontend/src/context/EnquiryContext.jsx` — controls wholesale enquiry modal open/close state
- `frontend/src/context/LanguageContext.jsx` — translations for English/Hindi/Gujarati; toggled through header

## 3. Dynamic content displayed

At the time of the initial audit, the site depended on static data files rather than a live API. The completed integration now loads this content from the backend; see section 20.

- `frontend/src/data/products.js` — full catalog dataset used by `useProducts.js`
- `frontend/src/data/categories.js` — categories for homepage and filter dropdowns
- `frontend/src/data/brands.js` — brand naming and category mapping
- `frontend/src/data/testimonials.js` — empty placeholder data file; currently not used
- `frontend/src/utils/constants.js` — business profile, navigation labels and contact metadata
- `frontend/src/utils/whatsapp.js` — WhatsApp message generator

Dynamic display fields that appear in the UI include:

- Product: `id`, `name`, `brand`, `category`, `size`, `image`, `badge`
- Category: `name`, `subtitle`, `icon`, `image`
- Brand: `name`, `category`
- Business info: `name`, `phone`, `phoneDigits`, `email`, `address`, `hours`, `mapsUrl`
- Gallery: `image`, `title`, `category`
- Hero stats: `5.0 Google Rating`, `645+ Happy Reviews`, `13+ Years of Service`

## 4. Forms and submitted fields

### Wholesale enquiry modal (`frontend/src/components/forms/WholesaleEnquiryForm.jsx`)

Fields:

- `name` (required)
- `shop` (optional)
- `city` (required)
- `phone` (required, valid mobile 10–13 digits)
- `requirement` (required)

Submission behavior:

- validates phone length on client side
- composes WhatsApp message with:
  - `Wholesale enquiry`
  - `Name`
  - `Shop / firm`
  - `City`
  - `Mobile`
  - `Requirement and quantity`
- uses `window.open` with WhatsApp URL generated via `getWhatsAppUrl(message)`

### Product catalog search/filter form

- `ProductSearch.jsx`: search query input; text value of search terms
- `ProductFilters.jsx`: dropdown filters for category and brand

### Contact and enquiry CTA links

- WhatsApp message strings from `Hero.jsx`, `Testimonials.jsx`, `ProductCard.jsx`, `WholesaleBanner.jsx`
- contact cards in `ContactSection.jsx` use `tel:`, `mailto:` and Google Maps links

## 5. Product data fields

Actual frontend product data structure from `frontend/src/data/products.js`:

```js
{
  id: 1,
  name: "LED Bulb",
  brand: "Philips",
  category: "LED Lights",
  size: "9W / 12W",
  image: ledLights,
  badge: "Lighting"
}
```

This is a simplified catalog model. The backend should support normalized product structure with these logical fields:

- `id`
- `name`
- `slug`
- `sku`
- `description`
- `short_description`
- `category_id`
- `brand_id`
- `price`
- `price_on_request`
- `stock_status`
- `is_featured`
- `is_best_selling`
- `is_active`
- `badge`
- `size`
- `image`
- `meta_title`
- `meta_description`
- `created_at`, `updated_at`

Product image records should be stored separately in `product_images` with:

- `id`
- `product_id`
- `image_path`
- `is_primary`
- `display_order`

Product specification records should be stored separately in `product_specifications` with:

- `id`
- `product_id`
- `name`
- `value`

## 6. Category and brand fields

### Category structure from `frontend/src/data/categories.js`

```js
{
  name: "LED Lights",
  subtitle: "Indoor & outdoor",
  icon: "sun",
  image: ledLights
}
```

Requires normalized backend table fields:

- `id`
- `name`
- `slug`
- `subtitle`
- `image`
- `icon`
- `display_order`
- `is_active`
- `created_at`, `updated_at`

### Brand structure from `frontend/src/data/brands.js`

```js
{
  name: "Havells",
  category: "Electricals"
}
```

Requires normalized backend table fields:

- `id`
- `name`
- `slug`
- `category`
- `is_active`
- `created_at`, `updated_at`

## 7. Images and upload requirements

Frontend assets live in `frontend/src/assets/images/` and are imported directly into UI modules. The actual image files include:

- `air-conditioner.webp`
- `ceiling-fan.webp`
- `circuit-breaker.webp`
- `electrical-wiring.webp`
- `home-appliance.webp`
- `jay-gurudevv-logo.jpg`
- `led-lights.webp`
- `lighting-interior.webp`
- `living-room.webp`
- `modern-interior.webp`
- `reference-showroom-fan-1-blades.png`
- `reference-showroom-fan-2-blades.png`
- `reference-showroom-fan-3-blades.png`
- `reference-showroom-fan-4-blades.png`
- `reference-showroom-hero-fans.webp`
- `reference-showroom-hero.webp`
- `showroom-interior.webp`
- `showroom-lighting.webp`
- `switches-sockets.webp`
- `washing-machine.webp`

Admin API need to support image upload for:

- product main image
- multiple product gallery images
- category image
- brand logo or per-brand art (if extended later)
- gallery image uploads
- banner image uploads

The backend upload middleware uses `multer` with allowed MIME types:

- `image/jpeg`
- `image/jpg`
- `image/png`
- `image/webp`

maximum file size: 5MB

## 8. Search, filter and sorting requirements

The catalog uses search and filtering in `frontend/src/components/products/ProductGrid.jsx` and `frontend/src/hooks/useProducts.js`.

Search terms: `name`, `brand`, `category`, `size`

Filter params:

- `search`
- `category` (selected value like `LED Lights`)
- `brand` (selected value like `Philips`)

Sort requirements:

- product list is currently in static order from `products.js`
- backend should support:
  - `newest`
  - `name_asc`
  - `name_desc`
  - `price_asc`
  - `price_desc`

Pagination:

- page number from query param `page`
- limit from query param `limit`
- default page 1 and default limit 12

## 9. Homepage sections

The home page includes these sections in order:

1. `Hero` — with headline, trust stats, location CTA, WhatsApp CTA
2. `TrustBadges` — 5-card assurance strip
3. `CategorySection` — product categories
4. `HomePromoBanners` — two feature banners
5. `BrandSection` — top brand directory
6. `FeaturedProducts` — best-selling/featured product grid
7. `WholesaleBanner` — dealer/contractor CTA
8. `AboutSection` — about story block
9. `GalleryPreview` — gallery teaser
10. `Testimonials` — feedback CTA
11. `ContactSection` — business details + map

## 10. Contact and enquiry workflows

### Contact page workflow

- user reaches `ContactSection` and can call, email or WhatsApp
- user can use Google Maps to reach the physical location: `Opp. Jilla Panchayat, Palanpur, Gujarat`

### Enquiry workflow

- user enters product enquiry from `ProductCard` using WhatsApp
- user clicks wholesale CTA from `WholesaleBanner`, `Products` page, or `Hero`
- form validates mobile number and opens WhatsApp with details of requirement and quantities

Expected backend entities:

- `enquiries` — main enquiry record
- `enquiry_items` — optional product-specific items / quantities tied to an enquiry
- `enquiry_status_history` — status changes by admin

## 11. Existing dummy/static data

These modules contain the original audited seed content. The live React components no longer import the product, category, or brand lists at runtime; they are used by the repeatable backend content seed:

- `frontend/src/data/products.js`
- `frontend/src/data/categories.js`
- `frontend/src/data/brands.js`
- `frontend/src/data/testimonials.js` (empty as of current frontend)
- `frontend/src/utils/constants.js` (business configuration constant object)
- `frontend/src/context/LanguageContext.jsx` (translation map; not backend data but a local static content source)

## 12. localStorage-based functionality

The frontend currently does not use `localStorage` or `sessionStorage` for data persistence. The app stores UI-only state in React state and URL parameters. There is no app-level cart or shortlist implementation currently.

## 13. Required public APIs

Public endpoints needed to support the current frontend and future CMS-driven content:

- `GET /api/health`
- `GET /api/products` — list products with search, filter, sort, pagination
- `GET /api/products/:id` — product detail
- `GET /api/products/featured/list`
- `GET /api/categories` — category list for homepage and filters
- `GET /api/brands` — brand list
- `GET /api/gallery` — gallery list
- `GET /api/banners` — homepage promotional banner list
- `GET /api/pages/:slug` — page metadata and sections
- `GET /api/settings` — public site settings fields
- `GET /api/statistics` — homepage rating/review/years-of-service values
- `GET /api/pages/:pageId/sections` — CMS-managed page sections

## 14. Required protected admin APIs

Admin-only endpoints required for managing the website data:

- `POST /api/admin/login`
- `GET /api/admin/me`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`
- `POST /api/brands`
- `PUT /api/brands/:id`
- `DELETE /api/brands/:id`
- `GET /api/banners/admin/list`
- `POST /api/banners`
- `PUT /api/banners/:id`
- `DELETE /api/banners/:id`
- `POST /api/gallery`
- `PUT /api/gallery/:id`
- `DELETE /api/gallery/:id`
- `POST /api/pages`
- `PUT /api/pages/:id`
- `DELETE /api/pages/:id`
- `POST /api/settings`
- `PUT /api/settings/:key_name`
- `DELETE /api/settings/:key_name`
- `GET /api/enquiries`
- `GET /api/enquiries/:id`
- `POST /api/enquiries`
- `PATCH /api/enquiries/:id/status`
- `GET /api/dashboard/summary`
- Business statistics CRUD under `/api/statistics`
- Page section CRUD under `/api/pages/:pageId/sections`

## 15. Frontend integration mapping

The following frontend modules consume backend data:

- `frontend/src/data/products.js` => replaced by `GET /api/products`
- `frontend/src/data/categories.js` => replaced by `GET /api/categories`
- `frontend/src/data/brands.js` => replaced by `GET /api/brands`
- `frontend/src/hooks/useProducts.js` => backend-driven filtering and pagination
- `frontend/src/components/home/FeaturedProducts.jsx` => backend featured products
- `frontend/src/components/home/CategorySection.jsx` => backend-managed category cards
- `frontend/src/components/home/BrandSection.jsx` => backend-managed brand list
- `frontend/src/components/home/GalleryPreview.jsx` => backend gallery entries
- `frontend/src/components/layout/Footer.jsx` => backend site settings and product categories
- `frontend/src/components/layout/Navbar.jsx` => backend navigation menu if expanded to CMS-driven nav
- `frontend/src/components/home/ContactSection.jsx` => business contact values stored in `site_settings`
- `frontend/src/components/home/Testimonials.jsx` => no testimonials API needed; this component is only an outbound WhatsApp feedback CTA, and `frontend/src/data/testimonials.js` is empty and unused

## 16. Exact expected data structure mapping to backend tables

### Category map

Frontend category object:

```js
{ name: "LED Lights", subtitle: "Indoor & outdoor", icon: "sun", image: "..." }
```

MySQL table: `categories`

```sql
INSERT INTO categories (name, slug, subtitle, icon, image, display_order, is_active)
VALUES ('LED Lights', 'led-lights', 'Indoor & outdoor', 'sun', '/uploads/led-lights.webp', 1, 1);
```

### Brand map

Frontend brand object:

```js
{ name: "Havells", category: "Electricals" }
```

MySQL table: `brands`

```sql
INSERT INTO brands (name, slug, category, is_active)
VALUES ('Havells', 'havells', 'Electricals', 1);
```

### Product map

Frontend product object:

```js
{
  id: 1,
  name: "LED Bulb",
  brand: "Philips",
  category: "LED Lights",
  size: "9W / 12W",
  image: "...",
  badge: "Lighting"
}
```

MySQL normalized shape:

```sql
INSERT INTO products (name, slug, sku, short_description, category_id, brand_id, price, price_on_request, stock_status, is_featured, is_best_selling, is_active, badge, size, image)
VALUES ('LED Bulb', 'led-bulb', 'LED-001', 'Lighting solution', 1, 3, NULL, 0, 'price_on_request', 0, 0, 1, 'Lighting', '9W / 12W', '/uploads/led-lights.webp');
```

Related entries:

```sql
INSERT INTO product_images (product_id, image_path, is_primary, display_order)
VALUES (1, '/uploads/led-lights.webp', 1, 0);

INSERT INTO product_specifications (product_id, name, value)
VALUES (1, 'Wattage', '9W / 12W');
```

## 17. Summary

The frontend is a React + Vite product catalog and showroom marketing website for a local electrical retail store. It is now integrated with its backend for public content and wholesale enquiry persistence. The backend supports:

- public catalog browsing and filtering
- WhatsApp-driven lead and wholesale enquiry flows
- admin management of products, categories, brands, gallery, settings and enquiries
- normalized MySQL storage for product catalog and site configuration

The backend implementation and frontend integration are modeled to match the actual structures discovered in `frontend/src`; the existing visual design has been preserved.

## 18. Verified backend compatibility and integration boundary

The backend exposes a single `/api` prefix. Catalog list/detail responses include the frontend card properties `id`, `name`, `brand`, `category`, `size`, `image`, and `badge`; `image` resolves to the primary product image when present. Search includes product name, SKU, description, brand, category, and size. Category and brand filters accept either their exact display names (as used in the existing URL query parameters) or slugs.

Business contact values are exposed as `GET /api/settings` `business` properties with the exact camel-case names `name`, `phone`, `phoneDigits`, `email`, `address`, `hours`, and `mapsUrl`. Settings writes are protected.

The API persists wholesale enquiry form fields (`name`, `shop`, `city`, `phone`, `requirement`). The integrated form submits to `POST /api/enquiries`, presents persistence status, and continues to open the existing WhatsApp message flow.

The hero statistics are loaded from `/api/statistics`. Business settings are loaded from `/api/settings` and used for contact details, maps, and WhatsApp URLs.

Product, category, brand-logo, gallery, and promotional-banner uploads use `multipart/form-data` and return public paths under `/uploads/`. Those paths are served from the backend's persistent `uploads/` directory. Only raster formats JPG/JPEG, PNG, and WEBP are accepted, with a 5 MiB limit per file.

Promotional banners are loaded from `/api/banners`. Categories, brands, products, gallery items, and page headings/descriptions are loaded from their public endpoints. The curated frontend catalog is seeded into MySQL by `npm run seed-frontend-content`, and its images are copied into `Backend/uploads/`.

## 19. Verification notes

- The backend implementation and actual endpoint examples are documented in `Backend/docs/API_DOCUMENTATION.md`.
- The implemented files, database inventory, and validation evidence are recorded in `Backend/docs/IMPLEMENTATION_AUDIT.md`.
- The local XAMPP instance was found on port `3307`; the tracked example configuration retains the requested default `3306`, while the local ignored `Backend/.env` uses the actual XAMPP port.

## 20. Completed frontend integration

- `frontend/src/services/api.js` reads `VITE_API_BASE_URL`, handles JSON errors, and resolves backend upload paths.
- `frontend/src/context/SiteDataContext.jsx` loads categories, brands, gallery, banners, pages, business settings, and statistics.
- `frontend/src/hooks/useProducts.js` loads server-filtered products with search, category, brand, page, limit, and sort parameters.
- Homepage and public pages use the corresponding API content; existing static product/category/brand modules are no longer UI data sources.
- Wholesale submission preserves client validation and WhatsApp behavior while persisting the same fields through `POST /api/enquiries`.
- Product, category, gallery, banner and page content images are hosted through Express `/uploads/...` URLs.
- UI content areas have loading, retryable error, and empty states. API failure is not presented as a successful data load.
- `frontend/.env.example` contains only the public API base URL; no credentials or secrets are exposed.
- The backend content seed is idempotent and preserves existing database records and upload files.

## 21. Admin panel and current integration audit

The public routes and their visual layout are unchanged. `/admin` is mounted separately from the public header/footer and uses the existing `/api` endpoints:

- Secure sign-in and identity check use `POST /api/admin/login` and `GET /api/admin/me`. The JWT is held only in browser storage, sent only in bearer headers, and cleared when the API reports an expired/invalid session. Logout clears it immediately; the account menu provides password change.
- The dashboard uses `GET /api/dashboard/summary` for product, category, brand, gallery and enquiry counts plus the six latest enquiries.
- Products support create/edit/delete, SKU, description, category, brand, size, price/price-on-request, stock status, featured/active flags, badges, specifications and multiple image uploads.
- Categories, brands, gallery items and homepage banners support protected CRUD and their existing image upload fields. Category/brand descriptions and banner button text use additive, idempotent columns in the existing tables.
- Enquiries support list/status updates (`closed` is shown as “Completed”) and confirmation-gated deletion. Deletion is logged and existing foreign-key cascades remove associated history/items.
- Page title/heading/description and public business/contact/social URL settings are editable through the admin content screens.
- Configured Facebook, Instagram, YouTube and WhatsApp URLs are published through `/api/settings` and appear as accessible footer links; only absolute HTTP/HTTPS destinations are rendered.
- No public admin registration endpoint was added. Database and JWT secrets remain exclusively in backend environment configuration.
- Image uploads require an allowed raster media type and matching JPG, PNG or WebP file signature; existing size/count limits remain enforced.

API and persistence behavior is covered by the live MySQL integration suite, including description/button persistence, dashboard totals/recent enquiries, enquiry deletion and rejection of image content with a spoofed image MIME type. Browser-level admin login and CRUD validation is recorded in the implementation audit after local browser testing.
