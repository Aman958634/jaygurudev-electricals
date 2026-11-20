# Production brand migration runbook

This runbook prepares, but does not execute, the production-only insertion of the 25 approved brands. No production host was contacted while preparing it.

## Safety and scope

- The migration script is `Backend/database/production-brands-migration.js`.
- The script requires the explicit `--production` flag and `BRAND_MIGRATION_TARGET=production-jaygurudev_db` even for a dry run.
- Apply additionally requires `BRAND_MIGRATION_CONFIRM=INSERT_ONLY_MISSING_25_BRANDS` and `BRAND_MIGRATION_BACKUP_VERIFIED=YES`.
- `DB_NAME` must be exactly `jaygurudev_db`; `DB_HOST` must be explicitly set from the VPS `Backend/.env`.
- The script verifies the ten documented production brand identities before proceeding. If any expected ID, normalized name, or normalized slug differs, it stops without changes.
- It checks candidate names and slugs against existing names and slugs after normalization, rechecks under a transaction before inserting, relies on existing unique constraints as a final duplicate guard, and rolls back on errors.
- Dry runs execute all reads inside a MySQL `READ ONLY` transaction. They do not execute `INSERT`, `UPDATE`, or `DELETE`; they commit only the read-only transaction after verification.
- Inserts omit IDs, category, description, and logo paths. New rows get `NULL` for category/description/logo, active status, and an appended display order. Existing rows, IDs, image references, and uploads are never updated or removed.
- `Anchor by Panasonic` is intentionally excluded.

## Documented production baseline

The latest production public API comparison available for this task reported these records. The migration script validates the IDs and normalized names/slugs; it does not write any of these rows or their other fields.

| ID | Name | Slug | Category | Description | Logo path | Display order | Active |
|---:|---|---|---|---|---|---:|---:|
| 5 | Havells | `havells` | Electricals | `NULL` | `NULL` | 0 | 1 |
| 6 | Polycab | `polycab` | Wires & cables | `NULL` | `NULL` | 0 | 1 |
| 7 | Philips | `philips` | Lighting | `NULL` | `NULL` | 0 | 1 |
| 8 | Crompton | `crompton` | Fans & appliances | `NULL` | `NULL` | 0 | 1 |
| 9 | Bajaj | `bajaj` | Electricals | `NULL` | `NULL` | 0 | 1 |
| 10 | Voltas | `voltas` | Cooling | `NULL` | `NULL` | 0 | 1 |
| 11 | LG | `lg` | Home appliances | `NULL` | `NULL` | 0 | 1 |
| 12 | Samsung | `samsung` | Home appliances | `NULL` | `NULL` | 0 | 1 |
| 13 | Anchor | `anchor` | Switches & sockets | `NULL` | `NULL` | 0 | 1 |
| 14 | Legrand | `legrand` | Electricals | `NULL` | `NULL` | 0 | 1 |

This is a previously observed baseline, not a substitute for the live dry run. The script stops if those identities have changed, while all other existing values are preserved because its SQL only inserts new rows.

## Approved insert candidates

| Name | Slug |
|---|---|
| GreatWhite | `greatwhite` |
| Altech | `altech` |
| PARCOS | `parcos` |
| McCoy | `mccoy` |
| LUKER | `luker` |
| V-GUARD | `v-guard` |
| Schneider Electric | `schneider-electric` |
| Goldmedal | `goldmedal` |
| GM Modular | `gm-modular` |
| L&T | `l-and-t` |
| LISTER | `lister` |
| Elleys | `elleys` |
| Hi-Fi | `hi-fi` |
| VIHAN | `vihan` |
| Norisys | `norisys` |
| Guruttech | `guruttech` |
| Atomberg | `atomberg` |
| Orient Electric | `orient-electric` |
| USHA | `usha` |
| BOSS | `boss` |
| Ajwin | `ajwin` |
| Finolex | `finolex` |
| RR KABEL | `rr-kabel` |
| KEI | `kei` |
| APAR | `apar` |

These are candidates, not a promise that 25 rows will be inserted: the production dry run rechecks the live table and inserts only candidates still missing.

## Local verification performed

The configured local database was contacted only through the explicit loopback host `127.0.0.1` and local port `3307`. It contained 35 brand rows, including all ten baseline identities and all 25 approved candidates. From `Backend/`, the tested command was:

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3307'
$env:BRAND_MIGRATION_TARGET = 'production-jaygurudev_db'
node .\database\production-brands-migration.js --production --dry-run
```

It reported 10/10 baseline identities verified, 25 candidates, all 25 already present, and zero proposed inserts. The row count remained 35, `Anchor by Panasonic` was excluded, and a SHA-256 snapshot of all brand fields matched before and after the run. No VPS or production database was contacted.

A separate disposable MySQL 8.1 instance bound only to `127.0.0.1:33307` was also used to test the missing-candidate path. Its isolated fixture contained the ten baseline identities and an `Anchor by Panasonic` row; the dry run listed 25 proposed candidates and the complete row snapshot was unchanged. That temporary instance and its data directory were removed after the test. Its empty root password was used only for that isolated instance; do not copy that setting into the production environment.

Apply guard tests (also from `Backend/`) use a loopback host and a closed test port, so they stop before opening a database connection:

```powershell
node --test tests\production-brands-migration.test.js
```

They verify that missing backup confirmation, an incorrect migration confirmation, and an incorrect target marker each fail before connecting.

## Manual VPS procedure

Run these commands from a trusted workstation with SSH access. Replace `<SSH_USER>@<VPS_HOST>` with the Hostinger VPS account. Do not copy or print `.env` or its password.

### 1. Copy the script only

```powershell
scp .\Backend\database\production-brands-migration.js <SSH_USER>@<VPS_HOST>:/var/www/jaygurudev-electricals/Backend/database/production-brands-migration.js
```

### 2. Log in and create a verified pre-migration backup

```sh
ssh <SSH_USER>@<VPS_HOST>
cd /var/www/jaygurudev-electricals
set -eu
BACKUP="/var/backups/jaygurudev_db-before-brands-$(date +%Y%m%d-%H%M%S).sql"
test ! -e "$BACKUP"
mysqldump --single-transaction --no-tablespaces -h 127.0.0.1 -u <DB_USER> -p jaygurudev_db > "$BACKUP"
test -s "$BACKUP"
mysql --version
sha256sum "$BACKUP"
```

Enter the database password only at the interactive prompt. If the production `DB_HOST` in `Backend/.env` is not `127.0.0.1`, use that configured host in `mysqldump`; do not change `.env`. Store the backup in protected storage and confirm its hash and restorability according to the site's backup procedure before continuing.

### 3. Run and review a production dry run

From `/var/www/jaygurudev-electricals`, use the Node version and dependencies already installed for the backend. The script loads the existing `Backend/.env`; it does not display credentials.

```sh
set -a
. Backend/.env
set +a
export BRAND_MIGRATION_TARGET=production-jaygurudev_db
node Backend/database/production-brands-migration.js --production --dry-run
```

Review the listed current count and every `ADD` line. The script must verify the ten documented IDs/names/slugs and report only brands still missing. Stop if the baseline check fails, the target values are unexpected, or the candidate list is not the expected set. Dry run is read-only.

### 4. Apply only after backup and dry-run review

Only after you personally verify the backup and approve the dry-run output:

```sh
export BRAND_MIGRATION_BACKUP_VERIFIED=YES
export BRAND_MIGRATION_CONFIRM=INSERT_ONLY_MISSING_25_BRANDS
node Backend/database/production-brands-migration.js --production --apply
unset BRAND_MIGRATION_TARGET BRAND_MIGRATION_BACKUP_VERIFIED BRAND_MIGRATION_CONFIRM DB_PASSWORD
```

The script prints each inserted ID, and a final count. If any insert fails, it rolls back the transaction. This command does not run schema initialization, seeds, or table replacement.

## Independent SQL verification

After a successful apply, connect interactively to the production database (`mysql -h <DB_HOST> -u <DB_USER> -p jaygurudev_db`) and run:

```sql
SELECT COUNT(*) AS total_brands FROM brands;

SELECT id, name, slug, category, description, logo_url, display_order, is_active
FROM brands
WHERE id IN (5, 6, 7, 8, 9, 10, 11, 12, 13, 14)
ORDER BY id;

SELECT id, name, slug, category, description, logo_url, display_order, is_active
FROM brands
WHERE slug IN (
  'greatwhite', 'altech', 'parcos', 'mccoy', 'luker', 'v-guard',
  'schneider-electric', 'goldmedal', 'gm-modular', 'l-and-t', 'lister',
  'elleys', 'hi-fi', 'vihan', 'norisys', 'guruttech', 'atomberg',
  'orient-electric', 'usha', 'boss', 'ajwin', 'finolex', 'rr-kabel', 'kei', 'apar'
)
ORDER BY display_order, id;

SELECT COUNT(*) AS anchor_by_panasonic_rows
FROM brands
WHERE LOWER(name) LIKE '%anchor%panasonic%';
```

Expected: `total_brands` is 35 if all 25 remain missing at dry-run/apply time; existing IDs 5–14 retain their current values; each inserted row has `NULL` category, description, and logo path with `is_active=1`; `anchor_by_panasonic_rows` is 0. If the dry run reports some candidates already present, the expected final count is the pre-migration count plus the number actually inserted, not necessarily 35.
