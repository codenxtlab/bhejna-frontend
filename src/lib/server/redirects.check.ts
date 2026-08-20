// Self-check for the open-redirect guard. No test runner in this project, so:
//   npx tsx src/lib/server/redirects.check.ts
import assert from 'node:assert/strict';
import { safeNext, loginUrlFor, DEFAULT_LANDING } from './redirects.ts';

// Legitimate destinations pass through untouched.
assert.equal(safeNext('/dashboard/inbox'), '/dashboard/inbox');
assert.equal(safeNext('/dashboard/inbox?x=1'), '/dashboard/inbox?x=1');

// Anything that could leave the origin falls back.
for (const hostile of [
	'https://evil.example',
	'//evil.example',
	'/\\evil.example',
	'http:/evil.example',
	'javascript:alert(1)',
	'/dashboard\n/inbox',
	'dashboard/inbox'
]) {
	assert.equal(safeNext(hostile), DEFAULT_LANDING, `should reject ${JSON.stringify(hostile)}`);
}

// Missing values fall back.
assert.equal(safeNext(null), DEFAULT_LANDING);
assert.equal(safeNext(undefined), DEFAULT_LANDING);
assert.equal(safeNext(''), DEFAULT_LANDING);

// The round trip a PWA launch depends on: inbox -> login -> back to inbox.
const url = loginUrlFor('/dashboard/inbox');
assert.equal(url, '/login?next=%2Fdashboard%2Finbox');
assert.equal(
	safeNext(new URL(`https://x.test${url}`).searchParams.get('next')),
	'/dashboard/inbox'
);

console.log('redirects.ts: all checks passed');
