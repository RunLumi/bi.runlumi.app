import {spawnSync} from 'node:child_process';
import {readdir, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
// Deterministic per-package build. The package owns its dist/ directory: it is
// cleared before every emit so obsolete build output can never survive into a
// release archive (tsc does not remove files whose source was deleted).
const root = fileURLToPath(new URL('../', import.meta.url));
const name = process.argv[2];
if (!name || !/^[a-z0-9-]+$/.test(name)) throw new Error('Usage: node scripts/build-package.mjs <package-name>');
const dir = path.join(root, 'packages', name);
const dist = path.join(dir, 'dist');
await rm(dist, {recursive: true, force: true});
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const run = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], {cwd: dir, stdio: 'inherit'});
if (run.status !== 0) process.exit(run.status ?? 1);
async function rewrite(file) {
  const source = await readFile(file, 'utf8');
  const rewritten = source.replace(/\.ts(['"])/g, '.js$1');
  if (rewritten !== source) await writeFile(file, rewritten);
}
let pending = [dist];
let emitted = 0;
while (pending.length) {
  const target = pending.pop();
  for (const entry of await readdir(target, {withFileTypes: true})) {
    if (entry.isDirectory()) pending.push(path.join(target, entry.name));
    else {if (entry.name.endsWith('.d.ts')) await rewrite(path.join(target, entry.name)); emitted++;}
  }
}
console.log(`Built @runlumi/${name} dist/ (${emitted} files)`);
