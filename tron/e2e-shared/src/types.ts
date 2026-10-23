// ── Adapter harness types (shared between Node test runner and browser page) ──

export type AdapterActionName =
    | 'resetState'
    | 'getProvider'
    | 'connect'
    | 'disconnect'
    | 'signMessage'
    | 'signTransaction'
    | 'multiSign'
    | 'switchChain';

export interface AdapterActionParams {
    resetState: void;
    getProvider: void;
    connect: void;
    disconnect: void;
    signMessage: { message?: string };
    signTransaction: { receiver?: string; value?: string; fromAddress?: string };
    multiSign: { receiver?: string; value?: string; permissionId?: number; fromAddress?: string };
    switchChain: { chainId?: string };
}

export interface AdapterEventEntry {
    name: string;
    payload: unknown;
    timestamp: string;
}

export interface AdapterResultSnapshot {
    lastAction: string;
    status: 'idle' | 'pending' | 'success' | 'error';
    value: string;
    errorName: string;
    errorMessage: string;
    errorCode: number | null;
}

export interface AdapterHarnessConfig {
    scenario: string;
    useDeeplink: boolean;
    openUrlWhenWalletNotFound: boolean;
}

export interface AdapterSnapshot {
    config: AdapterHarnessConfig;
    readyState: string;
    state: string;
    address: string | null;
    connected: boolean;
    chainId: string;
    providerFound: boolean | null;
    providerIdentityCheck: boolean | null;
    result: AdapterResultSnapshot;
    events: AdapterEventEntry[];
}

// ── Wallet E2E config (provided by each wallet adapter) ──

export interface WalletE2ECapabilities {
    /** Whether the wallet supports multiSign. Default: false. */
    multiSign?: boolean;
    /** Whether the wallet supports switchChain. Default: false. */
    switchChain?: boolean;
}

export interface WalletE2EConfig {
    walletId: string;
    walletName: string;
    /** Property on the injected provider used to verify wallet identity (e.g. `isTronLink`). */
    providerIdentityKey: string;
    e2eBaseUrlEnvVar: string;
    unlockPagePath: string;
    unlockFramePredicate: (frameUrl: string, extensionOrigin: string) => boolean;
    confirmButtonNames?: RegExp[];
    rejectButtonNames?: RegExp[];
    unlockButtonNames?: RegExp[];
    /**
     * Label text of a fake "acknowledge risk" checkbox some wallets gate confirm
     * behind (e.g. OneKey's "Proceed at my own risk"). When set, the popup
     * controller clicks the <div> immediately preceding this text before confirming.
     */
    confirmAcknowledgeText?: string;
    /** Milliseconds to wait after unlocking before the test begins. Default: 0. */
    postUnlockDelayMs?: number;
    /** Milliseconds to wait after the test page opens before running any action. Default: 0. */
    pageReadyDelayMs?: number;
    capabilities?: WalletE2ECapabilities;
}

// ── Default button name patterns ──

export const DEFAULT_CONFIRM_BUTTON_NAMES: RegExp[] = [
    /^next$/i,
    /^connect$/i,
    /^approve$/i,
    /^agree$/i,
    /^confirm$/i,
    /^sign$/i,
    /^ok$/i,
    /^done$/i,
    /^submit$/i,
    /^allow$/i,
    /^accept$/i,
    /^switch$/i,
    /^continue$/i,
];

export const DEFAULT_REJECT_BUTTON_NAMES: RegExp[] = [/^reject$/i, /^cancel$/i, /^close$/i, /^not now$/i, /^deny$/i];

export const DEFAULT_UNLOCK_BUTTON_NAMES: RegExp[] = [/^unlock$/i, /^log in$/i, /^login$/i, /^confirm$/i, /^submit$/i];

export function resolveCapabilities(config: WalletE2EConfig): Required<WalletE2ECapabilities> {
    return {
        multiSign: config.capabilities?.multiSign ?? false,
        switchChain: config.capabilities?.switchChain ?? false,
    };
}
