import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicContactEmail } from '../src/data/contact.ts';

test('public contact accepts simple aliases and trims environment padding', () => {
  assert.equal(publicContactEmail('  hello@runlumi.app  '), 'hello@runlumi.app');
  assert.equal(publicContactEmail('Sales.Pilot+bi@runlumi.app'), 'Sales.Pilot+bi@runlumi.app');
});

test('unsafe configured recipients fail build instead of changing URI semantics', () => {
  for (const email of [
    'sales#pilot@example.com', 'sales?pilot@example.com', 'sales%40pilot@example.com',
    'sales&pilot@example.com', 'sales/pilot@example.com', 'a@example.com?bcc=b@example.com',
    'hello@example.com\r\nBcc:other@example.com', 'a b@example.com',
    'Sales <hello@example.com>', 'hello', 'hello@example.com,other@example.com',
  ]) assert.throws(() => publicContactEmail(email), /PUBLIC_CONTACT_EMAIL/, email);
});

test('accepted mailboxes remain the entire recipient, with no query or fragment', () => {
  for (const input of ['hello@runlumi.app', 'sales+pilot@example.com', 'a_b.c-d@sub.example.com']) {
    const email = publicContactEmail(input);
    const bare = new URL(`mailto:${email}`);
    assert.equal(bare.pathname, email);
    assert.equal(bare.search, '');
    assert.equal(bare.hash, '');
    const cta = new URL(`mailto:${email}?subject=${encodeURIComponent('Trao đổi pilot Lumi BI')}`);
    assert.equal(cta.pathname, email);
    assert.equal(cta.searchParams.get('subject'), 'Trao đổi pilot Lumi BI');
    assert.equal(cta.hash, '');
  }
});
