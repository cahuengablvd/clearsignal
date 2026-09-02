import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, redactText } from '../src/redact.mjs';

test('redacts secret fields recursively', () => {
  assert.deepEqual(redact({ token: 'abc', nested: { password: 'def', safe: 'yes' } }), { token: '[REDACTED]', nested: { password: '[REDACTED]', safe: 'yes' } });
});

test('redacts bearer and common key strings', () => {
  assert.doesNotMatch(redactText('Authorization: Bearer abc.def and sk-ant-abcdefghijklmnop; "api_key":"plain-secret"'), /abc\.def|abcdefghijklmnop|plain-secret/);
});

test('redacts project secret formats', () => {
  const value = 'STRIPE_WEBHOOK_SECRET=whsec_abcdefghijklmnop SUPABASE_SERVICE_ROLE_KEY=eyJabc.def.ghi RESEND_API_KEY=re_abcdefghijklmnop sk_live_abcdefghijklmnop';
  assert.doesNotMatch(redactText(value), /whsec_|eyJabc|re_abc|sk_live_/);
});
