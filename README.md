# tronwallet-adapter e2e

Playwright E2E test infrastructure for TRON wallet adapters. Each wallet runs as an isolated pnpm workspace package under `tron/<walletId>/`, sharing common fixtures, specs, and a page harness from `tron/e2e-shared/`.

Tests exercise the full adapter lifecycle — connect, signMessage, signTransaction, multiSign, switchChain — against the **real wallet Chrome extension** running in a persistent Chromium profile. Transactions are built at run time against the TRON Nile testnet, so no production keys or funds are required.

> **Relationship with `tronwallet-adapter`**
> This project is a companion repository. Run `pnpm e2e:update` from the main `tronwallet-adapter` repo root to clone or pull it into the `e2e/` sub-directory, then run `pnpm i` inside `tronwallet-adapter/e2e/` to install its dependencies. You normally work in `tronwallet-adapter/e2e/` — you do not need to clone this repo separately.

## Repository Structure

```
e2e/
├── README.md                  ← you are here
├── e2e-init.mjs               # per-wallet environment setup helper (pnpm e2e:init)
├── e2e-all.mjs                # run every wallet's suite sequentially (pnpm e2e:all)
├── setup-e2e.prompt.md        # AI scaffold prompt for adding a new wallet
└── tron/
    ├── .env                   # shared environment variables (gitignored)
    ├── e2e-shared/            # shared Playwright scaffold
    │   └── src/
    │       ├── config/        # createPlaywrightConfig / createViteConfig
    │       ├── fixtures/      # Playwright fixtures (AdapterE2EPage, WalletPopupController)
    │       ├── helpers/       # test helpers (connectWallet, expectTronAddress …)
    │       ├── page/          # browser-side harness (initHarness, getSecurityOptionsFromUrl)
    │       ├── specs/         # shared test specs (defineConnectTests, defineSecurityTests …)
    │       └── types.ts       # shared types
    ├── tronlink/              # TronLink test package
    │   └── e2e/
    │       ├── fixtures/      # re-exports createE2EFixtures for this wallet
    │       ├── pages/         # Vite entry: creates adapter + calls initHarness
    │       ├── tests/         # *.spec.ts files
    │       ├── playwright.config.ts
    │       ├── vite.config.ts
    │       └── wallet-config.ts
    └── <walletId>/            # identical layout for every other wallet
```

## How It Works

```
Playwright (Node.js)
  │  page.evaluate() / page.route()
  ▼
Chromium browser  ←── real wallet extension loaded
  │
  ├── Vite dev server  (pnpm e2e:page)
  │     └── pages/main.ts  creates the adapter, calls initHarness()
  │
  └── window.<walletId>AdapterE2E  (exposed by the harness)
        ├── runAction('connect' | 'signMessage' | …)
        └── getSnapshot()  → { connected, address, result, events, … }
```

1. **Vite dev server** (started automatically by Playwright) serves `pages/index.html` which runs `pages/main.ts`. That script instantiates the wallet adapter (e.g. `TronLinkAdapter`) and calls `initHarness(adapter, config)`.
2. **`initHarness`** wires adapter events to DOM elements, exposes `window.<walletId>AdapterE2E`, and provides `runAction` / `getSnapshot` APIs.
3. **Playwright tests** navigate to that page, call `runAction('connect')`, handle any wallet popup that appears, then assert on the snapshot.
4. **Wallet popup** — when the adapter triggers a popup (e.g. an approval request), `WalletPopupController` finds the popup page in the Chromium context and clicks Confirm/Reject.

### Playwright Projects

Each wallet has two Playwright projects:

| Project             | When it runs                        | Requires extension? |
| ------------------- | ----------------------------------- | ------------------- |
| `with-extension`    | All tests except discovery-NotFound | Yes                 |
| `without-extension` | `discovery.spec.ts` (E2E-003 only)  | No                  |

## Supported Wallets

| Wallet       | walletId      | Chrome Extension ID                |
| ------------ | ------------- | ---------------------------------- |
| TronLink     | `tronlink`    | `ibnejdfjmmkpcnlpebklmnkoeoihofec` |
| OKX Wallet   | `okxwallet`   | `mcohilncbfahbmgdjkbpemcciiolgcge` |
| Bitget       | `bitkeep`     | `jiidiaalihmmhddjgbnbgdfflelocpak` |
| Bybit        | `bybit`       | `pdliaogehgdbhbnmkklieghmmjkpigpa` |
| Gate Wallet  | `gatewallet`  | `cpmkedoipcpimgecpmgpldfpohjplkpp` |
| Guarda       | `guarda`      | `hpglfhgfnhbgpjdenjgmdgoeiappafln` |
| OneKey       | `onekey`      | `jnmbobjmhlngoefaiojfljckilhhlhcj` |
| TokenPocket  | `tokenpocket` | `mfgccjchihfkkindfppnaooecgfneiii` |
| Trust Wallet | `trust`       | `egjidjbpglichdcondbcbdnbeeppgdph` |
| MetaMask     | `metamask`    | `nkbihfbeogaeaoehlefnkodbefgpgknn` |
| Binance      | `binance`     | `cadiboklkpojfamcoggejbbdjcoiljjk` |
| Backpack     | `backpack`    | `aflkmfhebedbjioipglgcbcmnbpgliof` |

## Prerequisites

-   Node.js 24.22.1, pnpm 11.21.0 (pinned via `.nvmrc` and the `packageManager` field — run `nvm use` in the `e2e/` root)
-   Chrome with the target wallet extension installed (the setup script copies it from your Chrome profile)
-   An unused TRON seed phrase for the test profile — **do not use a production wallet**

## One-time Setup (per wallet)

All setup commands run from the **`e2e/` root directory** using `pnpm e2e:init`. The script looks up Chrome extension IDs automatically — you never need to copy-paste them.

```bash
# 1. Install workspace dependencies (run once from the e2e/ root)
pnpm install

# 2. Create the shared tron/.env (skip if it already exists)
pnpm e2e:init --init-env

# 3. Run the initial setup — copies the extension, initialises tron/.env, and opens Chromium.
#    In the browser window that opens:
#      - Open the wallet extension popup
#      - Import your test seed phrase (never use a real/production wallet!)
#      - Set an unlock password (you will need it in step 5)
#      - Switch the network to TRON Nile testnet
#      - (Optional) top up: https://nileex.io/join/getJoinPage
#      - Close the browser when done
pnpm e2e:init <walletId>          # e.g. pnpm e2e:init tronlink

# 4. After closing the browser, copy the wallet profile into the project
pnpm e2e:init <walletId> --copy-profile

# 5. Set WALLET_PASSWORD in tron/.env to the password you chose in step 3
#    All other defaults work for the Nile testnet out of the box

# 6. Verify the environment is fully prepared
pnpm e2e:init <walletId> --verify
```

Need to redo individual steps? Each phase can be run on its own:

```bash
pnpm e2e:init <walletId> --launch-profile   # re-open Chromium (e.g. to re-import seed)
pnpm e2e:init <walletId> --copy-profile     # re-copy the profile after --launch-profile
```

If you already have the extension as an unpacked directory or a `.crx` file, skip the Chrome lookup:

```bash
pnpm e2e:init <walletId> --extension-dir /path/to/unpacked --launch-profile
# or
pnpm e2e:init <walletId> --crx /path/to/extension.crx --launch-profile
```

## Running Tests

Because `e2e/` is a **pnpm workspace**, there are two equivalent ways to run tests.

### From the `e2e/` root (recommended)

```bash
# Run tests for a single wallet
pnpm --filter ./tron/<walletId> e2e

# Examples
pnpm --filter ./tron/tronlink e2e
pnpm --filter ./tron/tronlink e2e --grep "E2E-SEC"
pnpm --filter ./tron/tronlink e2e tests/security.spec.ts
pnpm --filter ./tron/tronlink e2e --project with-extension

# Run tests for all wallets sequentially (one wallet at a time)
pnpm e2e:all

# Pass extra Playwright flags — forwarded to every wallet's test run
pnpm e2e:all --grep "connect"          # only tests matching "connect"
pnpm e2e:all --grep "E2E-SEC"          # security tests only
pnpm e2e:all --project chromium        # specific Playwright project
pnpm e2e:all --headed                  # headed mode for all wallets
pnpm e2e:all --grep "sign" --headed    # combine multiple flags

# Serve the harness page for manual inspection (no Playwright)
pnpm --filter ./tron/tronlink e2e:page
# then open the URL Vite prints (each wallet uses its own dedicated port
# derived from its walletId, so suites never collide on a shared port)
```

### From inside a wallet directory

```bash
cd tron/<walletId>      # e.g. cd tron/tronlink

pnpm e2e                                  # full suite
pnpm e2e --grep "connect"              # filter by test name
pnpm e2e --grep "E2E-SEC"             # security tests only
pnpm e2e -- tests/security.spec.ts        # single spec file
pnpm e2e --project with-extension      # specific Playwright project
pnpm e2e --project without-extension

pnpm e2e:page                             # serve harness page without Playwright
```

The HTML report is written to `<walletDir>/e2e/playwright-report/` after every run. Open `playwright-report/index.html` in a browser to view it.

## Shared Environment Variables (`tron/.env`)

All wallets share a single `tron/.env`. Wallet-specific overrides (if any) go in `tron/<walletId>/e2e/.env`.

| Variable                | Default                    | Description                                                                                                                                                |
| ----------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WALLET_PASSWORD`       | _(empty)_                  | Password used to unlock the test Chromium profile.                                                                                                         |
| `E2E_WALLETS_DIR`       | `./e2e-data`               | Base dir for per-wallet data; each wallet's extension files and Chromium profile live under `$E2E_WALLETS_DIR/<walletId>/` (resolved relative to `tron/`). |
| `TEST_CHAIN_ID`         | `0x94a9059e`               | Target TRON chain id (`0x94a9059e` Shasta · `0xcd8690dc` Nile · `0x2b6653dc` Mainnet).                                                                     |
| `TRON_FULL_HOST`        | `https://nile.trongrid.io` | TronGrid `fullHost` used by the harness to build test transactions.                                                                                        |
| `TEST_RECEIVER_ADDRESS` | -                          | Base58 address that receives the test transfer.                                                                                                            |
| `TEST_VALUE_SUN`        | `1000`                     | Transfer amount in sun (1 TRX = 1 000 000 sun).                                                                                                            |
| `TEST_UNKNOWN_CHAIN_ID` | `0xdeadbeef`               | Used by the negative `switchChain` test.                                                                                                                   |
| `WALLET_ADAPTERS_PATH`  | _(empty)_                  | Optional local path to the `tronwallet-adapters` source for development testing.                                                                           |

## Local Adapter Development

Set `WALLET_ADAPTERS_PATH` in `tron/.env` to point to your local `tronwallet-adapter` checkout. Vite will alias `@tronweb3/tronwallet-adapters` to that path so the tests run against your in-progress changes instead of the published npm package:

```env
# tron/.env
# Path to the local adapters source, resolved relative to the e2e/ root.
WALLET_ADAPTERS_PATH=../packages/adapters/adapters/src/index.ts
WALLET_PASSWORD=your_wallet_password
```

Then rebuild the adapter and re-run tests:

```bash
# In tronwallet-adapter root
pnpm build

# In e2e/tron/<walletId>
pnpm e2e
```

## Test Suite Reference

Each wallet's `tests/` directory contains these spec files:

| File                  | Test IDs          | What it covers                                               |
| --------------------- | ----------------- | ------------------------------------------------------------ |
| `discovery.spec.ts`   | E2E-001 – 003     | Provider detection, readyState transitions                   |
| `connect.spec.ts`     | E2E-004 – 006a    | Connect / reject / reconnect / disconnect                    |
| `sign.spec.ts`        | E2E-007, 008, 011 | signMessage (success / reject / disconnected)                |
| `transaction.spec.ts` | E2E-012 – 014a    | signTransaction, multiSign                                   |
| `chain.spec.ts`       | E2E-015 – 016     | switchChain                                                  |
| `events.spec.ts`      | E2E-017 – 019     | accountsChanged / chainChanged / disconnect events           |
| `security.spec.ts`    | E2E-SEC-001 – 008 | Security policy (risk config fetch, onRiskDetected, caching) |

### Security Tests (`E2E-SEC-*`)

Security tests verify the `securityOptions` feature of the adapter without requiring a real remote config server. Playwright intercepts the `fetch()` call in the browser using `page.route()`, so no external network access is needed.

The harness page (`pages/main.ts`) reads security configuration from URL query parameters:

| Parameter             | Values                      | Description                                                                               |
| --------------------- | --------------------------- | ----------------------------------------------------------------------------------------- |
| `securityEnabled`     | `true`                      | Enables the security check (default: off)                                                 |
| `securityConfigUrl`   | URL or comma-separated URLs | The config endpoint(s) the adapter will fetch                                             |
| `securityThrowOnRisk` | `true` \| `false`           | If `true` (default), `onRiskDetected` throws and blocks connect; if `false`, it only logs |

These parameters are set by the test via `app.goto({ securityEnabled: 'true', securityConfigUrl: '...' })` before the connect action is called.

| Test ID     | Scenario                                                   | Expected result                                        |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| E2E-SEC-001 | Config has risks for another wallet only                   | connect succeeds                                       |
| E2E-SEC-002 | Config has a risk for this wallet, `onRiskDetected` throws | connect fails; error message contains the risk title   |
| E2E-SEC-003 | Config endpoint returns HTTP 500                           | safe fallback — connect succeeds                       |
| E2E-SEC-004 | `securityEnabled` not set (default off)                    | config URL never fetched; connect succeeds             |
| E2E-SEC-005 | Two `configUrls`; risk present only in the second          | risks merged; connect fails with the second URL's risk |
| E2E-SEC-006 | Risk detected but `onRiskDetected` only logs               | connect succeeds (soft-warning mode)                   |
| E2E-SEC-007 | Config has three risk entries for this wallet              | all titles present in the error message                |
| E2E-SEC-008 | Risk cached after first fetch; mock changed to abort       | second connect still blocked from cache                |

All `E2E-SEC-*` tests require the `with-extension` project (the wallet must be installed and unlocked so the adapter's `_checkWallet()` can detect it before reaching the security check).

## Adding a New Wallet

Use the AI scaffold prompt:

```
/setup-e2e.prompt.md <walletId>
```

Or open `setup-e2e.prompt.md` and follow the steps manually.

## Troubleshooting

**Extension service worker not found**
The wallet extension must be loaded as an unpacked directory. If `pnpm e2e:init` cannot locate your Chrome install, pass the extension path directly:

```bash
pnpm e2e:init <walletId> --extension-dir /path/to/unpacked-extension --launch-profile
```

**Wallet prompts for password during the test run**
The unlock fixture automatically enters `WALLET_PASSWORD` from `tron/.env`. If unlocking still fails, re-run `pnpm e2e:init <walletId> --launch-profile` and ensure the password in the profile matches the env variable.

**Popup confirmation times out**
Some wallets need extra time before the popup is ready to click. Add `postUnlockDelayMs` or `pageReadyDelayMs` to the wallet's `wallet-config.ts`.

## Notes

-   **Never commit** `tron/.env` — it contains the wallet password.
-   `tron/.env`, `.chromium-profile/`, `extensions/`, `.vite-dist/`, and `playwright-report/` are gitignored.
-   Each test run gets an isolated copy of the template profile so runs cannot corrupt the on-disk wallet state.
-   TRON transactions are built against the network specified by `TRON_FULL_HOST`. Make sure the wallet profile is set to the same network before running transaction tests.
