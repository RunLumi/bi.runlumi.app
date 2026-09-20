import {spawnSync} from 'node:child_process';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
// Deterministic per-package build: tsc emits dist/*.js with rewritten relative
// specifiers; declaration files keep ".ts" specifiers, so they are rewritten here.
const root = fileURLToPath(new URL('../', import.meta.url));
const name = process.argv[2];
if (!name || !/^[a-z0-9-]+$/.test(name)) throw new Error('Usage: node scripts/build-package.mjs <package-name>');
const dir = path.join(root, 'packages', name);
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const run = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.build.json'], {cwd: dir, stdio: 'inherit'});
if (run.status !== 0) process.exit(run.status ?? 1);
async function rewrite(file) {
  const source = await readFile(file, 'utf8');
  const rewritten = source.replace(/\.ts(['"])/g, '.js$1');
  if (rewritten !== source) await writeFile(file, rewritten);
}
let pending = [path.join(dir, 'dist')];
while (pending.length) {
  const target = pending.pop();
  for (const entry of await readdir(target, {withFileTypes: true})) {
    if (entry.isDirectory()) pending.push(path.join(target, entry.name));
    else if (entry.name.endsWith('.d.ts')) await rewrite(path.join(target, entry.name));
  }
}
console.log(`Built @runlumi/${name} dist/`);
