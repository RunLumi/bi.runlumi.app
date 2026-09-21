import test from 'node:test';
import assert from 'node:assert/strict';
import {manifest} from '../manifest.ts';
test('installation composition exports a named application manifest',()=>{assert.equal(typeof manifest.displayName,'string');assert.ok(manifest.modules.length>0)});
