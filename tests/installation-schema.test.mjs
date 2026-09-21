import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalDatabase} from '../scripts/local-adapters.mjs';

test('installation schema is a standalone database with no installation routing surface', async () => {
  const sql = await readFile(new URL('../migrations/installation/0001_initial.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /legacy_id|legacy_identity|legacy_lifecycle|CENTRAL_DB|ROUTING_BINDINGS/i);
  const db = new LocalDatabase();
  try {
    db.db.exec(sql);
    const names = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row => row.name);
    for (const required of ['installation', 'users', 'sessions', 'sources', 'snapshots', 'active_snapshots', 'workflow_facts', 'dashboards', 'audit_events', 'commerce_connections', 'commerce_publications', 'commerce_jobs']) {
      assert.ok(names.includes(required), `missing installation table ${required}`);
    }
    assert.equal(names.some(name => /legacy|control|routing/i.test(name)), false);
    db.db.prepare("INSERT INTO installation VALUES (1,?,?,?)").run('Test installation', new Date().toISOString(), '0.1.0');
    db.db.prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?,?)").run('u1', 'local', 'admin', 'Administrator', 'owner', 'active', new Date().toISOString(), new Date().toISOString());
    assert.equal(db.db.prepare('SELECT role FROM users WHERE issuer=? AND subject=?').get('local', 'admin').role, 'owner');
  } finally {
    db.db.close();
  }
});
