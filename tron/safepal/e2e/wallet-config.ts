import type { WalletE2EConfig } from '@tronweb3/tronwallet-adapter-e2e-shared';

export const safepalConfig: WalletE2EConfig = {
    walletId: 'safepal',
    walletName: 'SafePal',
    // SafePal extension injects window.SafePalHook as the TRON provider.
    // Ref: https://devdocs.safepal.com/Connect-wallet/Web/tron.html
    providerIdentityKey: 'SafePalHook',
    e2eBaseUrlEnvVar: 'SAFEPAL_E2E_BASE_URL',
    // Verify the actual popup path from the extension's manifest.json.
    unlockPagePath: '/popup.html',
    unlockFramePredicate: () => false,
    capabilities: {
        switchChain: false,
        multiSign: false,
    },
};
