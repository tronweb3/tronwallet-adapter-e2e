#!/usr/bin/env node

/**
 * Root-level shortcut for TRON wallet E2E environment setup.
 *
 * Usage:
 *   node e2e-init.mjs <walletId>           # full interactive setup
 *   node e2e-init.mjs <walletId> --verify  # verify environment is ready
 *
 * Wraps tron/e2e-shared/e2e-setup.mjs with built-in Chrome extension IDs
 * so you never need to copy-paste them manually.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Chrome Extension IDs ──────────────────────────────────────────────────────

const EXTENSION_IDS = {
    tronlink: 'ibnejdfjmmkpcnlpebklmnkoeoihofec',
    okxwallet: 'mcohilncbfahbmgdjkbpemcciiolgcge',
    bitkeep: 'jiidiaalihmmhddjgbnbgdfflelocpak',
    bybit: 'pdliaogehgdbhbnmkklieghmmjkpigpa',
    gatewallet: 'cpmkedoipcpimgecpmgpldfpohjplkpp',
    guarda: 'hpglfhgfnhbgpjdenjgmdgoeiappafln',
    onekey: 'jnmbobjmhlngoefaiojfljckilhhlhcj',
    tokenpocket: 'mfgccjchihfkkindfppnaooecgfneiii',
    trust: 'egjidjbpglichdcondbcbdnbeeppgdph',
    metamask: 'nkbihfbeogaeaoehlefnkodbefgpgknn',
    binance: 'cadiboklkpojfamcoggejbbdjcoiljjk',
    backpack: 'aflkmfhebedbjioipglgcbcmnbpgliof',
    safepal: 'lgmpcpglpngdoalbgeoldeajfclnhafa',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const setupScript = path.join(rootDir, 'tron', 'e2e-shared', 'e2e-setup.mjs');

function run(walletId, ...flags) {
    execSync(`node "${setupScript}" ${walletId} ${flags.join(' ')}`, {
        cwd: rootDir,
        stdio: 'inherit',
    });
}

function printHelp() {
    const wallets = Object.keys(EXTENSION_IDS).join(', ');
    console.log(`
Usage: node e2e-init.mjs [<walletId>] [options]

Options:
  (none)            Full interactive setup: copy extension → init .env → launch profile → copy profile
  --extension-id    Copy extension from Chrome (ID looked up automatically — flag is optional)
  --launch-profile  Launch Chromium to create the wallet profile interactively
  --copy-profile    Copy the profile from /tmp into the project
  --init-env        Create tron/.env (skipped if it already exists); walletId is optional
  --verify          Check that the environment is ready to run tests
  --help            Show this help

Supported wallets:
  ${wallets}

Examples:
  node e2e-init.mjs --init-env               # create tron/.env (shared across all wallets)
  node e2e-init.mjs okxwallet                # full setup from scratch
  node e2e-init.mjs okxwallet --copy-profile # copy profile only (after --launch-profile)
  node e2e-init.mjs okxwallet --verify       # verify the environment is ready
`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
}

// --init-env is wallet-independent — handle it before walletId validation.
if (args.includes('--init-env') && !EXTENSION_IDS[args[0]]) {
    execSync(`node "${setupScript}" --init-env`, { cwd: rootDir, stdio: 'inherit' });
    process.exit(0);
}

const walletId = args[0];

if (!walletId) {
    printHelp();
    process.exit(1);
}

if (!EXTENSION_IDS[walletId]) {
    console.error(`❌ Unknown wallet: "${walletId}"`);
    console.error(`   Supported: ${Object.keys(EXTENSION_IDS).join(', ')}`);
    process.exit(1);
}

// ── Pass-through mode: any recognised single-step flag is forwarded directly ──

const PASSTHROUGH_FLAGS = [
    '--verify',
    '--copy-profile',
    '--launch-profile',
    '--init-env',
    '--extension-id',
    '--crx',
    '--extension-dir',
];

const hasPassthroughFlag = args.slice(1).some((a) => PASSTHROUGH_FLAGS.some((f) => a === f || a.startsWith(f)));

if (hasPassthroughFlag) {
    // For --extension-id without a value we inject the built-in ID automatically.
    const flagArgs = args.slice(1);
    const hasExtId = flagArgs.includes('--extension-id');
    const extraFlags = hasExtId
        ? flagArgs.map((f) => (f === '--extension-id' ? `--extension-id ${EXTENSION_IDS[walletId]}` : f))
        : flagArgs;
    run(walletId, ...extraFlags);
    process.exit(0);
}

// ── Full interactive setup ────────────────────────────────────────────────────

const extensionId = EXTENSION_IDS[walletId];

console.log(`\n🔧 Setting up ${walletId} E2E environment\n`);

// Step 1 — copy extension files from local Chrome installation
console.log('━━ Step 1/3: Copying extension from Chrome ━━━━━━━━━━━━━━━━━━━━━━━━');
run(walletId, `--extension-id ${extensionId}`);

// Step 2 — create tron/.env (skipped automatically if it already exists)
console.log('\n━━ Step 2/3: Initialising tron/.env ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
run(walletId, '--init-env');

// Step 3 — launch Chromium so the user can import their wallet.
// The profile is written to /tmp only after the browser closes.
// --copy-profile must be run separately once the browser is shut.
console.log('\n━━ Step 3/3: Launching Chromium to create wallet profile ━━━━━━━━━━');
console.log('   Follow the on-screen instructions, then close the browser.\n');

run(walletId, '--launch-profile');

console.log(`\n✅ Browser closed. Run the following command to save the profile:`);
console.log(`   pnpm e2e:init ${walletId} --copy-profile\n`);
