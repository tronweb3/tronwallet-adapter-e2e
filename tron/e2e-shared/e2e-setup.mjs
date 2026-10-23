#!/usr/bin/env node

/**
 * E2E Test Environment Setup Script for TRON wallet adapters.
 *
 * Usage:
 *   node e2e-setup.mjs <walletId> --extension-id <chromeExtensionId>
 *   node e2e-setup.mjs <walletId> --crx <path/to/extension.crx>
 *   node e2e-setup.mjs <walletId> --extension-dir <path/to/unpacked-extension>
 *   node e2e-setup.mjs <walletId> --launch-profile
 *   node e2e-setup.mjs <walletId> --copy-profile
 *   node e2e-setup.mjs <walletId> --init-env
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ── Wallet Config Map ──────────────────────────────────────────────

// All wallets share E2E_WALLETS_DIR and WALLET_PASSWORD from tron/.env.
// Extension and profile are stored under $E2E_WALLETS_DIR/{walletId}/.
const WALLET_CONFIGS = {
    tronlink: { name: 'TronLink', baseUrlEnvVar: 'TRONLINK_E2E_BASE_URL' },
    okxwallet: { name: 'OKX Wallet', baseUrlEnvVar: 'OKX_WALLET_E2E_BASE_URL' },
    bitkeep: { name: 'Bitget Wallet', baseUrlEnvVar: 'BITGET_E2E_BASE_URL' },
    bybit: { name: 'Bybit Wallet', baseUrlEnvVar: 'BYBIT_E2E_BASE_URL' },
    gatewallet: { name: 'Gate Wallet', baseUrlEnvVar: 'GATE_E2E_BASE_URL' },
    guarda: { name: 'Guarda', baseUrlEnvVar: 'GUARDA_E2E_BASE_URL' },
    onekey: { name: 'OneKey', baseUrlEnvVar: 'ONEKEY_E2E_BASE_URL' },
    tokenpocket: { name: 'TokenPocket', baseUrlEnvVar: 'TOKENPOCKET_E2E_BASE_URL' },
    trust: { name: 'Trust Wallet', baseUrlEnvVar: 'TRUST_E2E_BASE_URL' },
    metamask: { name: 'MetaMask', baseUrlEnvVar: 'METAMASK_E2E_BASE_URL' },
    binance: { name: 'Binance Wallet', baseUrlEnvVar: 'BINANCE_E2E_BASE_URL' },
    backpack: { name: 'Backpack', baseUrlEnvVar: 'BACKPACK_E2E_BASE_URL' },
    safepal: { name: 'SafePal', baseUrlEnvVar: 'SAFEPAL_E2E_BASE_URL' },
};

// ── Path Utilities ────────────────────────────────────────────────

function findMonorepoRoot(startDir) {
    let dir = startDir;
    for (let i = 0; i < 20; i++) {
        if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}

function expandHome(input) {
    if (input === '~' || input.startsWith('~/') || input.startsWith('~\\')) {
        return path.join(process.env.HOME || process.env.USERPROFILE || '~', input.slice(1));
    }
    return input;
}

function resolveDir(baseDir, input) {
    const expanded = expandHome(input);
    return path.isAbsolute(expanded) ? expanded : path.resolve(baseDir, expanded);
}

/** Read E2E_WALLETS_DIR from tron/.env (if present), defaulting to tron/e2e-data. */
function getWalletsBaseDir(tronDir) {
    const envFile = path.join(tronDir, '.env');
    if (fs.existsSync(envFile)) {
        for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq === -1) continue;
            if (trimmed.slice(0, eq).trim() === 'E2E_WALLETS_DIR') {
                const raw = trimmed.slice(eq + 1).trim();
                return resolveDir(tronDir, raw);
            }
        }
    }
    return path.resolve(tronDir, 'e2e-data');
}

/** Returns the wallet-specific data directory: $walletsBaseDir/{walletId}. */
function getWalletDataDir(walletsBaseDir, walletId) {
    return path.join(walletsBaseDir, walletId);
}

// ── Chrome Extension Directory Lookup ──────────────────────────────

function getChromeUserDataDir() {
    const platform = os.platform();
    switch (platform) {
        case 'darwin':
            return path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
        case 'linux':
            return path.join(os.homedir(), '.config', 'google-chrome');
        case 'win32':
            return path.join(
                process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
                'Google',
                'Chrome',
                'User Data'
            );
        default:
            return null;
    }
}

function findExtensionDir(extensionId) {
    const userDataDir = getChromeUserDataDir();
    if (!userDataDir) {
        console.error(`❌ Unsupported platform: ${os.platform()}`);
        process.exit(1);
    }

    if (!fs.existsSync(userDataDir)) {
        console.error(`❌ Chrome user data directory not found: ${userDataDir}`);
        process.exit(1);
    }

    const profileDirs = fs.readdirSync(userDataDir).filter((name) => {
        if (name === 'Default' || /^Profile \d+$/.test(name)) {
            const extPath = path.join(userDataDir, name, 'Extensions', extensionId);
            return fs.existsSync(extPath);
        }
        return false;
    });

    if (profileDirs.length === 0) {
        console.error(`❌ Extension not found: ${extensionId}`);
        console.error(`   Searched all Chrome profiles in: ${userDataDir}`);
        process.exit(1);
    }

    let bestProfile = null;
    let bestVersion = null;
    let bestDir = null;

    for (const profile of profileDirs) {
        const extDir = path.join(userDataDir, profile, 'Extensions', extensionId);
        const versions = fs.readdirSync(extDir).filter((v) => fs.statSync(path.join(extDir, v)).isDirectory());
        if (versions.length === 0) continue;
        versions.sort();
        const latest = versions[versions.length - 1];
        if (!bestVersion || latest > bestVersion) {
            bestVersion = latest;
            bestProfile = profile;
            bestDir = path.join(extDir, latest);
        }
    }

    if (!bestDir) {
        console.error(`❌ Extension directory exists but has no version subdirectory`);
        process.exit(1);
    }

    console.log(`✅ Found extension: ${extensionId} v${bestVersion} (Chrome ${bestProfile})`);
    return bestDir;
}

function copyExtension(srcDir, walletDataDir) {
    const destDir = path.join(walletDataDir, 'extensions');

    if (path.resolve(srcDir) === path.resolve(destDir)) {
        console.log(`✅ Extension already at destination, skipping copy: ${destDir}`);
        return destDir;
    }

    if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
    }
    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(srcDir, destDir, { recursive: true });

    if (!fs.existsSync(path.join(destDir, 'manifest.json'))) {
        console.error(`❌ Copy complete but manifest.json not found, extension may be incomplete`);
        process.exit(1);
    }

    console.log(`✅ Extension copied to: ${destDir}`);
    return destDir;
}

function extractCrx(crxPath, walletDataDir) {
    if (!fs.existsSync(crxPath)) {
        console.error(`❌ CRX file not found: ${crxPath}`);
        process.exit(1);
    }
    const destDir = path.join(walletDataDir, 'extensions');
    if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
    fs.mkdirSync(destDir, { recursive: true });

    try {
        execSync(`unzip -o "${crxPath}" -d "${destDir}"`, { stdio: 'inherit' });
    } catch {
        console.error(`❌ CRX extraction failed.`);
        process.exit(1);
    }

    if (!fs.existsSync(path.join(destDir, 'manifest.json'))) {
        console.error(`❌ Extraction complete but manifest.json not found`);
        process.exit(1);
    }
    console.log(`✅ CRX extracted to: ${destDir}`);
    return destDir;
}

function findPlaywrightChromium() {
    try {
        const playwrightCliPath = require.resolve('playwright-core/cli');
        const result = execSync(`node "${playwrightCliPath}" print-browser --browser chromium`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (result && fs.existsSync(result)) return result;
    } catch {}

    try {
        const result = execSync('npx playwright print-browser --browser chromium 2>/dev/null', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (result && fs.existsSync(result)) return result;
    } catch {}

    const platform = os.platform();
    const cacheDir =
        platform === 'darwin'
            ? path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')
            : platform === 'linux'
              ? path.join(os.homedir(), '.cache', 'ms-playwright')
              : path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');

    if (!fs.existsSync(cacheDir)) return null;
    const dirs = fs.readdirSync(cacheDir).filter((d) => d.startsWith('chromium-') && !d.includes('headless'));
    if (dirs.length === 0) return null;
    dirs.sort();

    for (const dir of dirs) {
        const chromiumDir = path.join(cacheDir, dir);
        const candidates = [];
        if (platform === 'darwin') {
            candidates.push(
                path.join(chromiumDir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
                path.join(chromiumDir, 'chrome-mac-arm64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
            );
        } else if (platform === 'linux') {
            candidates.push(path.join(chromiumDir, 'chrome-linux', 'chrome'));
        } else {
            candidates.push(path.join(chromiumDir, 'chrome-win', 'chrome.exe'));
        }
        for (const c of candidates) if (fs.existsSync(c)) return c;
    }
    return null;
}

function ensurePlaywrightChromium() {
    const chromium = findPlaywrightChromium();
    if (chromium) return chromium;
    console.log(`⚠️  Playwright Chromium not found, installing...`);
    try {
        execSync('pnpm exec playwright install chromium', { stdio: 'inherit' });
    } catch {
        console.error(`❌ Failed to install Playwright Chromium. Run: pnpm exec playwright install chromium`);
        process.exit(1);
    }
    const retry = findPlaywrightChromium();
    if (retry) return retry;
    process.exit(1);
}

function launchProfile(walletDataDir, walletId) {
    const chromium = ensurePlaywrightChromium();
    const extDir = path.join(walletDataDir, 'extensions');
    if (!fs.existsSync(extDir) || !fs.existsSync(path.join(extDir, 'manifest.json'))) {
        console.error(`❌ Extension directory missing. Prepare the extension first.`);
        process.exit(1);
    }
    const tmpProfile = path.join(os.tmpdir(), `wallet-profile-${walletId}`);

    console.log(`\n🚀 Launching Chromium to create Profile...`);
    console.log(`   1. Click extension icon → Import wallet via seed phrase`);
    console.log(`   2. Set unlock password`);
    console.log(`   3. Switch the wallet to the TRON Nile testnet`);
    console.log(`   4. (Optional) Get test TRX from https://nileex.io/join/getJoinPage`);
    console.log(`   5. Close the browser\n`);

    const cmd = `"${chromium}" --user-data-dir="${tmpProfile}" --disable-extensions-except="${extDir}" --load-extension="${extDir}" --no-first-run about:blank`;
    try {
        execSync(cmd, { stdio: 'inherit' });
    } catch {}

    if (fs.existsSync(path.join(tmpProfile, 'Default'))) {
        console.log(`\n✅ Profile saved to: ${tmpProfile}`);
        console.log(`   Next: pnpm e2e:setup --copy-profile`);
    }
}

function copyProfile(walletDataDir, walletId) {
    const tmpProfile = path.join(os.tmpdir(), `wallet-profile-${walletId}`);
    if (!fs.existsSync(path.join(tmpProfile, 'Default'))) {
        console.error(`❌ Temp Profile does not exist: ${tmpProfile}`);
        console.error(`   Please run: pnpm e2e:setup --launch-profile`);
        process.exit(1);
    }
    const destDir = path.join(walletDataDir, '.chromium-profile');
    if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
    fs.cpSync(tmpProfile, destDir, { recursive: true });
    console.log(`✅ Profile copied to: ${destDir}`);
}

function initEnv(tronDir) {
    const sharedEnvFile = path.join(tronDir, '.env');
    const sharedEnvExample = path.join(tronDir, '.env.example');

    if (fs.existsSync(sharedEnvFile)) {
        console.log(`⚠️  tron/.env already exists, skipping.`);
    } else if (fs.existsSync(sharedEnvExample)) {
        fs.copyFileSync(sharedEnvExample, sharedEnvFile);
        console.log(`✅ Created tron/.env from tron/.env.example`);
        console.log(`\n   ⚠️  Edit tron/.env to set WALLET_PASSWORD\n`);
    } else {
        const content =
            [
                `E2E_WALLETS_DIR=./e2e-data`,
                `WALLET_PASSWORD=`,
                `TEST_CHAIN_ID=0x94a9059e`,
                `TRON_FULL_HOST=https://nile.trongrid.io`,
                `TEST_RECEIVER_ADDRESS=TYukBQZ2XXCcRCReAUguyXncCWNY9CEiDQ`,
                `TEST_VALUE_SUN=1000`,
                `TEST_UNKNOWN_CHAIN_ID=0xdeadbeef`,
                `WALLET_ADAPTERS_PATH=`,
            ].join('\n') + '\n';
        fs.writeFileSync(sharedEnvFile, content);
        console.log(`✅ Created tron/.env`);
        console.log(`\n   ⚠️  Edit tron/.env to set WALLET_PASSWORD\n`);
    }
}

function verify(walletDataDir, tronDir, walletId) {
    let hasIssue = false;

    const manifest = path.join(walletDataDir, 'extensions', 'manifest.json');
    if (fs.existsSync(manifest)) console.log(`✅ Extension files`);
    else {
        console.error(`❌ Extension files missing: ${manifest}`);
        hasIssue = true;
    }

    const defaultDir = path.join(walletDataDir, '.chromium-profile', 'Default');
    if (fs.existsSync(defaultDir)) console.log(`✅ Chromium Profile`);
    else {
        console.error(`❌ Chromium Profile missing`);
        hasIssue = true;
    }

    // Check shared tron/.env for WALLET_PASSWORD
    const sharedEnvFile = path.join(tronDir, '.env');
    if (fs.existsSync(sharedEnvFile)) {
        const envContent = fs.readFileSync(sharedEnvFile, 'utf-8');
        const passwordSet = envContent.split('\n').some((line) => {
            const eq = line.indexOf('=');
            if (eq === -1) return false;
            return line.slice(0, eq).trim() === 'WALLET_PASSWORD' && line.slice(eq + 1).trim().length > 0;
        });
        if (passwordSet) console.log(`✅ tron/.env (WALLET_PASSWORD is set)`);
        else {
            console.error(`⚠️  WALLET_PASSWORD is not set in tron/.env`);
            hasIssue = true;
        }
    } else {
        console.error(`❌ tron/.env missing`);
        hasIssue = true;
    }

    if (!hasIssue) console.log(`\n🎉 Ready! Run: cd tron/${walletId} && pnpm e2e\n`);
    return !hasIssue;
}

// ── Main ─────────────────────────────────────────────────────────

function printHelp() {
    console.log(`
Usage: node e2e-setup.mjs <walletId> [options]

Options:
  --extension-id <id>    Copy extension from Chrome install directory
  --crx <path>           Extract extension from CRX file
  --extension-dir <path> Copy extension from local directory
  --launch-profile       Launch Chromium to create Profile
  --copy-profile         Copy Profile from /tmp to project
  --init-env             Generate .env file
  --setup                All-in-one (extension + Profile + .env)
  --verify               Verify environment is ready
  --help                 Show help

Supported wallets: ${Object.keys(WALLET_CONFIGS).join(', ')}
`);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = findMonorepoRoot(scriptDir) || process.cwd();
const tronDir = path.join(rootDir, 'tron');

// --init-env is wallet-independent — handle it before walletId validation.
if (args.includes('--init-env') && !WALLET_CONFIGS[args[0]]) {
    initEnv(tronDir);
    process.exit(0);
}

const walletId = args[0];
if (!WALLET_CONFIGS[walletId]) {
    console.error(`❌ Unknown wallet: ${walletId}`);
    console.error(`   Supported wallets: ${Object.keys(WALLET_CONFIGS).join(', ')}`);
    process.exit(1);
}

const walletsBaseDir = getWalletsBaseDir(tronDir);
const walletDataDir = getWalletDataDir(walletsBaseDir, walletId);

console.log(`Wallet: ${WALLET_CONFIGS[walletId].name} (${walletId})`);
console.log(`Data directory: ${walletDataDir}\n`);

let extensionId = null;
let crxPath = null;
let extDir = null;
let doLaunchProfile = false;
let doCopyProfile = false;
let doInitEnv = false;
let doSetup = false;
let doVerify = false;

for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
        case '--extension-id':
            extensionId = args[++i];
            break;
        case '--crx':
            crxPath = args[++i];
            break;
        case '--extension-dir':
            extDir = args[++i];
            break;
        case '--launch-profile':
            doLaunchProfile = true;
            break;
        case '--copy-profile':
            doCopyProfile = true;
            break;
        case '--init-env':
            doInitEnv = true;
            break;
        case '--setup':
            doSetup = true;
            break;
        case '--verify':
            doVerify = true;
            break;
    }
}

if (extensionId) copyExtension(findExtensionDir(extensionId), walletDataDir);
if (crxPath) extractCrx(path.resolve(crxPath), walletDataDir);
if (extDir) {
    const abs = path.resolve(extDir);
    if (!fs.existsSync(path.join(abs, 'manifest.json'))) {
        console.error(`❌ manifest.json not found: ${abs}`);
        process.exit(1);
    }
    copyExtension(abs, walletDataDir);
}

if (doLaunchProfile) launchProfile(walletDataDir, walletId);

if (doSetup) {
    if (!extensionId && !crxPath && !extDir) {
        console.error(`❌ --setup requires --extension-id / --crx / --extension-dir`);
        process.exit(1);
    }
    doCopyProfile = true;
    doInitEnv = true;
}

if (doCopyProfile && !doLaunchProfile) copyProfile(walletDataDir, walletId);
if (doInitEnv) initEnv(tronDir);
if (doVerify) process.exit(verify(walletDataDir, tronDir, walletId) ? 0 : 1);
