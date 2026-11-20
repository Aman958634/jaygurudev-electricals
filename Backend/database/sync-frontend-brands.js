import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';
import { brands as frontendBrands } from '../../frontend/src/data/brands.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const columns = 'id, name, slug, category, description, logo_url, display_order, is_active';
const args = process.argv.slice(2);
if (args.length > 1 || args.some((arg) => !['--dry-run', '--apply'].includes(arg))) {
  throw new Error('Usage: node database/sync-frontend-brands.js [--dry-run|--apply]');
}

const apply = args.includes('--apply');
const configuredHost = (process.env.DB_HOST || 'localhost').toLowerCase();
if (!['localhost', '127.0.0.1', '::1'].includes(configuredHost)) {
  throw new Error('Refusing to connect: this synchronization script is restricted to a local database.');
}

const host = configuredHost === 'localhost' ? '127.0.0.1' : configuredHost;
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const brandKeys = (brand) => [normalize(brand.name), normalize(brand.slug)].filter(Boolean);

function classifyBrand(candidate, existingBrands) {
  const candidateKeys = new Set(brandKeys(candidate));
  const exactMatches = existingBrands.filter((brand) => brandKeys(brand).some((key) => candidateKeys.has(key)));
  if (exactMatches.length) {
    return { type: exactMatches.length === 1 ? 'matched' : 'conflict', records: exactMatches };
  }

  const aliasKeys = new Set((candidate.aliases || []).map(normalize).filter(Boolean));
  const aliasMatches = existingBrands.filter((brand) => brandKeys(brand).some((key) => aliasKeys.has(key)));
  if (aliasMatches.length) return { type: 'review', records: aliasMatches };
  return { type: 'missing', records: [] };
}

function printReport(databaseBrands) {
  const matched = [];
  const missing = [];
  const review = [];
  const conflicts = [];

  for (const brand of frontendBrands) {
    const result = classifyBrand(brand, databaseBrands);
    if (result.type === 'matched') matched.push({ frontend: brand, database: result.records[0] });
    else if (result.type === 'missing') missing.push(brand);
    else if (result.type === 'review') review.push({ frontend: brand, database: result.records });
    else conflicts.push({ frontend: brand, database: result.records });
  }

  console.log(`Frontend catalog records: ${frontendBrands.length}`);
  console.log(`Database brand records: ${databaseBrands.length}`);
  console.log(`Exact normalized matches: ${matched.length}`);
  for (const { frontend, database } of matched) {
    console.log(`  MATCH ${frontend.name} -> id=${database.id} ${database.name} (${database.slug})`);
  }
  console.log(`Needs manual identity review: ${review.length}`);
  for (const { frontend, database } of review) {
    console.log(`  REVIEW ${frontend.name} may alias ${database.map((brand) => `id=${brand.id} ${brand.name}`).join(', ')}`);
  }
  console.log(`Name/slug conflicts: ${conflicts.length}`);
  for (const { frontend, database } of conflicts) {
    console.log(`  CONFLICT ${frontend.name} -> ${database.map((brand) => `id=${brand.id} ${brand.name}`).join(', ')}`);
  }
  console.log(`Clearly missing brands: ${missing.length}`);
  for (const brand of missing) console.log(`  ADD ${brand.name} (${brand.slug})`);
  console.log(`Proposed inserts: ${missing.length}; execution: ${apply ? 'explicit --apply requested' : 'dry run only'}`);

  return { missing };
}

const connection = await mysql.createConnection({
  host,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jaygurudev_db',
});

try {
  const [databaseBrands] = await connection.execute(`SELECT ${columns} FROM brands ORDER BY id ASC`);
  const { missing } = printReport(databaseBrands);
  if (!apply || !missing.length) {
    if (!apply) console.log('No rows were changed. Use --apply only after reviewing the comparison report.');
    process.exitCode = 0;
  } else {
    await connection.beginTransaction();
    try {
      const [currentBrands] = await connection.execute(`SELECT ${columns} FROM brands ORDER BY id ASC FOR UPDATE`);
      let nextDisplayOrder = Math.max(0, ...currentBrands.map((brand) => Number(brand.display_order) || 0)) + 1;
      const inserted = [];

      for (const brand of missing) {
        const currentMatch = classifyBrand(brand, currentBrands);
        if (currentMatch.type !== 'missing') {
          console.log(`Skipped ${brand.name}: a matching or ambiguous record appeared after the report.`);
          continue;
        }

        const [result] = await connection.execute(
          `INSERT INTO brands (name, slug, category, description, logo_url, display_order, is_active)
           VALUES (?, ?, NULL, NULL, NULL, ?, 1)`,
          [brand.name, brand.slug, nextDisplayOrder],
        );
        inserted.push({ id: result.insertId, name: brand.name, slug: brand.slug });
        currentBrands.push({
          id: result.insertId,
          name: brand.name,
          slug: brand.slug,
          display_order: nextDisplayOrder,
        });
        nextDisplayOrder += 1;
      }

      await connection.commit();
      console.log(`Inserted ${inserted.length} brand record(s); existing records and image paths were left unchanged.`);
      for (const brand of inserted) console.log(`  INSERTED id=${brand.id} ${brand.name} (${brand.slug})`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
} finally {
  await connection.end();
}
