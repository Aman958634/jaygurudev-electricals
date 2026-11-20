import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const candidates = [
  ['GreatWhite', 'greatwhite'],
  ['Altech', 'altech'],
  ['PARCOS', 'parcos'],
  ['McCoy', 'mccoy'],
  ['LUKER', 'luker'],
  ['V-GUARD', 'v-guard'],
  ['Schneider Electric', 'schneider-electric'],
  ['Goldmedal', 'goldmedal'],
  ['GM Modular', 'gm-modular'],
  ['L&T', 'l-and-t'],
  ['LISTER', 'lister'],
  ['Elleys', 'elleys'],
  ['Hi-Fi', 'hi-fi'],
  ['VIHAN', 'vihan'],
  ['Norisys', 'norisys'],
  ['Guruttech', 'guruttech'],
  ['Atomberg', 'atomberg'],
  ['Orient Electric', 'orient-electric'],
  ['USHA', 'usha'],
  ['BOSS', 'boss'],
  ['Ajwin', 'ajwin'],
  ['Finolex', 'finolex'],
  ['RR KABEL', 'rr-kabel'],
  ['KEI', 'kei'],
  ['APAR', 'apar'],
].map(([name, slug]) => ({ name, slug }));

const documentedProductionBaseline = [
  { id: 5, name: 'Havells', slug: 'havells' },
  { id: 6, name: 'Polycab', slug: 'polycab' },
  { id: 7, name: 'Philips', slug: 'philips' },
  { id: 8, name: 'Crompton', slug: 'crompton' },
  { id: 9, name: 'Bajaj', slug: 'bajaj' },
  { id: 10, name: 'Voltas', slug: 'voltas' },
  { id: 11, name: 'LG', slug: 'lg' },
  { id: 12, name: 'Samsung', slug: 'samsung' },
  { id: 13, name: 'Anchor', slug: 'anchor' },
  { id: 14, name: 'Legrand', slug: 'legrand' },
];

const args = process.argv.slice(2);
const allowedArgs = ['--production', '--dry-run', '--apply'];
if (
  args.length !== 2
  || args.some((arg) => !allowedArgs.includes(arg))
  || !args.includes('--production')
  || Number(args.includes('--dry-run')) + Number(args.includes('--apply')) !== 1
) {
  throw new Error('Usage: node Backend/database/production-brands-migration.js --production --dry-run|--apply');
}

const apply = args.includes('--apply');
if (process.env.BRAND_MIGRATION_TARGET !== 'production-jaygurudev_db') {
  throw new Error('Refusing to run without BRAND_MIGRATION_TARGET=production-jaygurudev_db.');
}
if (process.env.DB_NAME !== 'jaygurudev_db') {
  throw new Error('Refusing to run: DB_NAME must be exactly jaygurudev_db.');
}
if (!process.env.DB_HOST) {
  throw new Error('Refusing to run: set DB_HOST explicitly from the VPS Backend/.env.');
}
if (apply && process.env.BRAND_MIGRATION_CONFIRM !== 'INSERT_ONLY_MISSING_25_BRANDS') {
  throw new Error('Refusing to apply without BRAND_MIGRATION_CONFIRM=INSERT_ONLY_MISSING_25_BRANDS.');
}
if (apply && process.env.BRAND_MIGRATION_BACKUP_VERIFIED !== 'YES') {
  throw new Error('Refusing to apply until BRAND_MIGRATION_BACKUP_VERIFIED=YES is explicitly set.');
}

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const keysFor = ({ name, slug }) => new Set([normalize(name), normalize(slug)].filter(Boolean));
const hasNormalizedMatch = (candidate, existing) => {
  const candidateKeys = keysFor(candidate);
  return [...keysFor(existing)].some((key) => candidateKeys.has(key));
};

function assertBaseline(existingRows) {
  const problems = [];
  for (const expected of documentedProductionBaseline) {
    const row = existingRows.find((item) => Number(item.id) === expected.id);
    if (!row) {
      problems.push(`Missing documented production brand id ${expected.id} (${expected.name}).`);
      continue;
    }
    if (normalize(row.name) !== normalize(expected.name) || normalize(row.slug) !== normalize(expected.slug)) {
      problems.push(
        `Documented production id ${expected.id} identity changed: `
        + `${row.name} (${row.slug}), expected ${expected.name} (${expected.slug}).`,
      );
    }
  }
  if (problems.length) {
    throw new Error(`Production baseline check failed; no rows changed.\n${problems.join('\n')}`);
  }
}

function findMissing(existingRows) {
  return candidates.filter((candidate) => !existingRows.some((row) => hasNormalizedMatch(candidate, row)));
}

function printReport(existingRows, missing) {
  console.log(`Database: ${process.env.DB_NAME} on configured host ${process.env.DB_HOST}`);
  console.log(`Current brand count: ${existingRows.length}`);
  console.log(`Documented production baseline: ${documentedProductionBaseline.length}/10 identities verified`);
  console.log(`Migration candidates: ${candidates.length}`);
  console.log(`Already present by normalized name/slug: ${candidates.length - missing.length}`);
  console.log(`Would insert: ${missing.length}`);
  for (const brand of missing) console.log(`  ADD ${brand.name} | ${brand.slug}`);
  console.log('Anchor by Panasonic is not a candidate and will not be inserted.');
  console.log('No existing record or upload will be updated, replaced, or deleted.');
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectTimeout: 10000,
});

let dryRunTransactionStarted = false;

try {
  if (!apply) {
    await connection.query('START TRANSACTION READ ONLY');
    dryRunTransactionStarted = true;
  }

  const [existingRows] = await connection.execute(
    'SELECT id, name, slug, category, description, logo_url, display_order, is_active FROM brands ORDER BY id ASC',
  );
  assertBaseline(existingRows);
  const missing = findMissing(existingRows);
  printReport(existingRows, missing);

  if (apply && missing.length) {
    await connection.beginTransaction();
    try {
      const [lockedRows] = await connection.execute(
        'SELECT id, name, slug, category, description, logo_url, display_order, is_active FROM brands ORDER BY id ASC FOR UPDATE',
      );
      assertBaseline(lockedRows);
      let nextDisplayOrder = Math.max(0, ...lockedRows.map((row) => Number(row.display_order) || 0)) + 1;
      const inserted = [];

      for (const brand of missing) {
        if (lockedRows.some((row) => hasNormalizedMatch(brand, row))) {
          console.log(`Skipped ${brand.name}: a matching normalized name or slug already exists.`);
          continue;
        }
        const [result] = await connection.execute(
          `INSERT INTO brands
             (name, slug, category, description, logo_url, display_order, is_active)
           VALUES (?, ?, NULL, NULL, NULL, ?, 1)`,
          [brand.name, brand.slug, nextDisplayOrder],
        );
        const insertedRow = { id: result.insertId, ...brand };
        inserted.push(insertedRow);
        lockedRows.push(insertedRow);
        nextDisplayOrder += 1;
      }

      await connection.commit();
      console.log(`Inserted ${inserted.length} missing record(s).`);
      for (const row of inserted) console.log(`  INSERTED id=${row.id} ${row.name} | ${row.slug}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } else if (apply) {
    console.log('All proposed brands are already represented; nothing to insert.');
  }

  const [verification] = await connection.execute(
    'SELECT id, name, slug, category, description, logo_url, display_order, is_active FROM brands ORDER BY id ASC',
  );
  assertBaseline(verification);
  console.log(`Final brand count after ${apply ? 'migration' : 'dry run'}: ${verification.length}`);
  console.log('Original production identities and all non-migrated fields remain untouched.');
  if (dryRunTransactionStarted) {
    await connection.commit();
    dryRunTransactionStarted = false;
    console.log('Dry run complete. No database rows were changed.');
  }
} catch (error) {
  if (dryRunTransactionStarted) await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
