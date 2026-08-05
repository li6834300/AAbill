import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const fail = (message) => {
  console.error(`Production deploy blocked: ${message}`);
  process.exit(1);
};

const branch = git('branch', '--show-current');
if (branch !== 'main') fail(`current branch is "${branch}", expected "main"`);

const inProgressMarkers = [
  'MERGE_HEAD',
  'REVERT_HEAD',
  'CHERRY_PICK_HEAD',
  'rebase-merge',
  'rebase-apply',
];
for (const marker of inProgressMarkers) {
  const markerPath = git('rev-parse', '--git-path', marker);
  if (existsSync(markerPath))
    fail(`Git operation is still in progress (${marker})`);
}

if (git('status', '--porcelain')) fail('working tree is not clean');

let originMain;
try {
  originMain = git('rev-parse', 'refs/remotes/origin/main');
} catch {
  fail('origin/main is unavailable; run "git fetch origin main" first');
}

const head = git('rev-parse', 'HEAD');
if (head !== originMain) fail('HEAD does not exactly match origin/main');

console.log(`Production deploy check passed on main at ${head.slice(0, 12)}.`);
