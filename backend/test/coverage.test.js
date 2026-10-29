import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('contract coverage report is reproducible and does not overclaim', () => {
  const raw = execFileSync(process.execPath, ['scripts/coverage.mjs'], { encoding: 'utf8' });
  const report = JSON.parse(raw);
  assert.equal(report.declared, report.implemented + report.missing);
  assert.ok(report.declared >= 100);
  assert.ok(report.missing > 0, 'incomplete backend must remain visible');
  assert.ok(report.coveragePercent < 100);
});
