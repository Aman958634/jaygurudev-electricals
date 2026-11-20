import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const migrationScript = fileURLToPath(
  new URL('../database/production-brands-migration.js', import.meta.url),
);

function runApply(overrides = {}) {
  const env = {
    ...process.env,
    DB_HOST: '127.0.0.1',
    DB_PORT: '1',
    DB_NAME: 'jaygurudev_db',
    BRAND_MIGRATION_TARGET: 'production-jaygurudev_db',
    BRAND_MIGRATION_CONFIRM: 'INSERT_ONLY_MISSING_25_BRANDS',
    BRAND_MIGRATION_BACKUP_VERIFIED: 'YES',
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  return spawnSync(
    process.execPath,
    [migrationScript, '--production', '--apply'],
    { encoding: 'utf8', env },
  );
}

function assertStoppedBeforeConnecting(result, expectedMessage) {
  assert.equal(result.status, 1);
  assert.match(`${result.stdout}${result.stderr}`, new RegExp(expectedMessage));
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/);
}

test('apply stops when backup verification is missing', () => {
  const result = runApply({ BRAND_MIGRATION_BACKUP_VERIFIED: undefined });
  assertStoppedBeforeConnecting(
    result,
    'Refusing to apply until BRAND_MIGRATION_BACKUP_VERIFIED=YES is explicitly set\\.',
  );
});

test('apply stops when the target confirmation is incorrect', () => {
  const result = runApply({ BRAND_MIGRATION_CONFIRM: 'WRONG_CONFIRMATION' });
  assertStoppedBeforeConnecting(
    result,
    'Refusing to apply without BRAND_MIGRATION_CONFIRM=INSERT_ONLY_MISSING_25_BRANDS\\.',
  );
});

test('apply stops when the production target marker is incorrect', () => {
  const result = runApply({ BRAND_MIGRATION_TARGET: 'not-production' });
  assertStoppedBeforeConnecting(
    result,
    'Refusing to run without BRAND_MIGRATION_TARGET=production-jaygurudev_db\\.',
  );
});
