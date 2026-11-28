# Production bulk-import deployment (Ubuntu 24.04, MySQL 8, Nginx, PM2)

This is a pre-deployment runbook. It does **not** authorize deploying, migrating, or modifying production data by itself.

## Compatibility result

- MySQL 8 is supported: the import uses `mysql2` prepared statements, `utf8mb4`, InnoDB transactions, JSON, and the `products.sku` unique index.
- Duplicate SKU protection is layered: preview validation detects spreadsheet/database duplicates and `uq_product_sku` remains the final transactional guard against concurrent imports.
- Import images are copied to the persistent upload root only for validated rows. Failed row transactions remove only their newly copied image files.
- Job manifests, temporary ZIP/PDF files, OCR cache, and thumbnails belong in `IMPORT_STORAGE_ROOT`; they must never be web-served.
- Run one PM2 backend instance. Current background-job coordination is process-local, although job manifests persist across restarts.

## One-time server preparation

Run as a sudo-capable operator, replacing `jayguru` with the non-root app account:

```bash
sudo install -d -o jayguru -g jayguru -m 0750 /var/lib/jaygurudev/uploads
sudo install -d -o jayguru -g jayguru -m 0750 /var/lib/jaygurudev/imports
sudo install -d -o www-data -g www-data -m 0700 /var/lib/jaygurudev/nginx-client-body
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

`canvas` uses these native libraries during an Ubuntu dependency install. Install Node.js LTS and MySQL client tools through the server's approved package source. Do not copy Windows `node_modules` to the VPS.

## Backend environment

Create `/var/www/jaygurudev/Backend/.env`, owned by `jayguru`, mode `0600`:

```ini
NODE_ENV=production
PORT=5000
BIND_HOST=127.0.0.1
TRUST_PROXY_HOPS=1
CLIENT_ORIGIN=https://<your-domain>
JWT_SECRET=<unique-random-secret-at-least-32-bytes>
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=<production-database>
DB_USER=<least-privilege-app-user>
DB_PASSWORD=<secret>
UPLOAD_STORAGE_ROOT=/var/lib/jaygurudev/uploads
IMPORT_STORAGE_ROOT=/var/lib/jaygurudev/imports
IMPORT_MAX_ZIP_MB=50
PDF_OCR_CONCURRENCY=2
OCR_CACHE_PATH=/var/lib/jaygurudev/imports/.ocr-cache
# Set OCR_LANG_PATH only when language data is pre-provisioned by your approved process.
OCR_LANG_PATH=
```

Never include database credentials or JWT secrets in the frontend build or source control.

The ignored local `eng.traineddata` file is an OCR cache artifact, not source
code. The API starts without it because Tesseract workers are created only for
scanned catalogue pages. Before using scanned PDFs in production, make the
configured OCR cache writable and pre-provision approved English language data
there if outbound downloads are not permitted.

## Safe database preflight and migration

Do **not** run `npm run init-db` against production: it is an initializer and includes legacy-table cleanup. Use only the explicit additive migration if its dry run says it is needed.

```bash
set -euo pipefail
STAMP=$(date +%F-%H%M%S)
BACKUP=/var/backups/jaygurudev/jaygurudev-$STAMP.sql.gz
sudo install -d -o root -g root -m 0700 /var/backups/jaygurudev
mysqldump --single-transaction --routines --triggers --no-tablespaces -h 127.0.0.1 -u <DB_USER> -p <DB_NAME> | gzip -9 > "$BACKUP"
gzip -t "$BACKUP"
sha256sum "$BACKUP"
cd /var/www/jaygurudev/Backend
node database/migrations/20261123_add_product_display_order.js
# Apply only after reviewing the dry run and verified backup:
# node database/migrations/20261123_add_product_display_order.js --apply
mysql -h 127.0.0.1 -u <DB_USER> -p <DB_NAME> -e "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='uq_product_sku';"
```

## Build and process preparation

```bash
cd /var/www/jaygurudev/Backend && npm ci --omit=dev
cd /var/www/jaygurudev/frontend && npm ci && VITE_API_BASE_URL=https://<your-domain>/api npm run build
cd /var/www/jaygurudev/Backend && pm2 start deploy/ecosystem.config.cjs --env production
pm2 save
pm2 status jaygurudev-api
curl --fail http://127.0.0.1:5000/api/health
```

Copy `deploy/nginx-jaygurudev.conf.example` into the existing HTTPS server block, then validate before a reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo ss -lntp | grep ':5000'
```

The listener must be `127.0.0.1:5000`, not a public interface. If using `client_body_temp_path`, configure `/var/lib/jaygurudev/nginx-client-body 1 2;` in Nginx's `http {}` context, not inside `server {}`.

## Post-deployment smoke checks

1. Log into Admin and open Bulk Import.
2. Upload an approved non-production test ZIP below 50 MiB. Verify preview, duplicate SKU warning, thumbnails, and admin refresh.
3. Confirm an import only in staging first. Verify `/api/products` returns the SKU and `/uploads/...` returns its image.
4. Check `df -h /var/lib/jaygurudev`, `find /var/lib/jaygurudev/uploads -type f | wc -l`, and `pm2 logs jaygurudev-api --lines 100`.

Never delete the uploads or imports directories during a release. Back up uploads separately from MySQL because product image paths are database references.
