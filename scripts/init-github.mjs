import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Explicit, fixed-destination bootstrap. No credentials, repository deletion,
// force pushes, remote rewrites, or Cloudflare actions are performed here.
const root = fileURLToPath(new URL('../', import.meta.url));
const remote = 'https://github.com/RunLumi/lumi-bi.git';
const args = process.argv.slice(2);
if (args.some(a => a !== '--push') || args.length > 1) {
  console.error('Usage: npm run init:github [-- --push]'); process.exit(1);
}
console.log(`Destination: ${remote}\nSource: ${root}`);
if (!args.includes('--push')) {
  console.log('DRY RUN. No files or remote refs changed.');
  console.log('With --push: require empty remote, run all checks, create local main, commit and push.');
  console.log('Uses your existing Git credential manager and Git author configuration.');
  process.exit(0);
}
function run(command, argv, capture = false) {
  const result = spawnSync(command, argv, {cwd: root, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit'});
  if (result.error || result.status !== 0) throw new Error(`Command failed: ${command} ${argv.join(' ')}. ${result.error?.message ?? ''}`);
  return result.stdout ?? '';
}
try {
  if (existsSync(path.join(root, '.git'))) throw new Error('A .git directory already exists. Inspect it manually; this bootstrap never rewrites existing history.');
  const refs = run('git', ['ls-remote', remote], true).trim();
  if (refs) throw new Error('Remote is not empty. Use a reviewed branch/PR instead of this bootstrap.');
  run('git', ['var', 'GIT_AUTHOR_IDENT'], true);
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error('Run this through npm run init:github so the package-manager executable is explicit.');
  run(process.execPath, [npm, 'run', 'check']);
  run('git', ['init', '-b', 'main']);
  run('git', ['remote', 'add', 'origin', remote]);
  run('git', ['add', '.']);
  run('git', ['commit', '-m', 'Bootstrap Cloudflare-first tenant-isolated BI kernel']);
  // No --force. A concurrent remote initialization will safely reject this push.
  run('git', ['push', '-u', 'origin', 'main']);
  console.log('Published main. Inspect GitHub CI before enabling any deployment.');
} catch (error) {
  console.error(error.message);
  console.error('Stopped. No reset, cleanup, history rewrite, or force push is attempted.');
  process.exitCode = 1;
}
