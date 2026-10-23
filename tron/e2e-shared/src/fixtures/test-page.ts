import { expect, type Page, type Route } from '@playwright/test';
import type { AdapterActionName, AdapterActionParams, AdapterSnapshot, WalletE2EConfig } from '../types.js';
import type { E2EEnv } from '../env.js';

export class AdapterE2EPage {
    private readonly globalName: string;

    constructor(
        private readonly page: Page,
        private readonly baseURL: string,
        private readonly config: WalletE2EConfig,
        private readonly e2eEnv: E2EEnv,
        /** Whether a wallet provider is expected to be injected (false for the no-extension project). */
        private readonly expectProvider = true
    ) {
        this.globalName = `${config.walletId}AdapterE2E`;
    }

    getE2eEnv() {
        return this.e2eEnv;
    }

    async goto(extraParams?: Record<string, string>) {
        const url = new URL(this.baseURL);
        url.searchParams.set('chainId', this.e2eEnv.testChainId);
        url.searchParams.set('receiver', this.e2eEnv.testReceiverAddress);
        url.searchParams.set('value', this.e2eEnv.testValueSun);
        url.searchParams.set('fullHost', this.e2eEnv.tronFullHost);
        if (extraParams) {
            for (const [key, value] of Object.entries(extraParams)) {
                url.searchParams.set(key, value);
            }
        }
        await this.page.goto(url.toString());
        await expect(this.page.getByTestId('adapter-name')).toHaveText(/\S+/);
        await this.waitForHarness();
        if (this.expectProvider) {
            await this.waitForProvider();
        }
        if (this.config.pageReadyDelayMs) {
            await this.page.waitForTimeout(this.config.pageReadyDelayMs);
        }
    }

    /**
     * Wait until the page-side harness global is present before driving it.
     *
     * Many wallet extensions reload the dApp tab shortly after it opens (e.g. to
     * (re)inject their provider). That wipes `window.<walletId>AdapterE2E` until
     * `main.ts` re-runs `initHarness()`, so an action firing in that window would
     * otherwise throw "Cannot read properties of undefined (reading 'runAction')".
     */
    private async waitForHarness() {
        await this.page.waitForFunction(
            (globalName) => Boolean((window as unknown as Record<string, unknown>)[globalName]),
            this.globalName,
            { timeout: 15_000 }
        );
    }

    /**
     * Wait until the wallet extension has injected its provider into the page.
     *
     * Extension content scripts inject the provider asynchronously after page load,
     * so the adapter can briefly see no provider and a `connect` would fail with a
     * "wallet not found" error. We poll the wallet's identity path (e.g.
     * `trustwallet.tronLink`, `tron.isTronLink`) until it resolves to a truthy value
     * — a deterministic replacement for fixed `pageReadyDelayMs` sleeps.
     */
    private async waitForProvider() {
        await this.page.waitForFunction(
            (identityKey) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let cursor: any = window;
                for (const part of identityKey.split('.')) {
                    if (cursor == null) return false;
                    cursor = cursor[part];
                }
                return Boolean(cursor);
            },
            this.config.providerIdentityKey,
            { timeout: 15_000 }
        );
    }

    async waitForReady() {
        await this.waitForHarness();
        if (this.expectProvider) {
            await this.waitForProvider();
        }
    }

    async route(url: string | RegExp, handler: (route: Route) => void | Promise<void>) {
        await this.page.route(url, handler);
    }

    async runAction<T extends AdapterActionName>(action: T, params?: AdapterActionParams[T]) {
        await this.waitForHarness();
        return this.page.evaluate(
            async ({ globalName, nextAction, nextParams }) => {
                return (window as unknown as Record<string, { runAction(a: string, p?: unknown): Promise<unknown> }>)[
                    globalName
                ].runAction(nextAction, nextParams);
            },
            { globalName: this.globalName, nextAction: action, nextParams: params }
        );
    }

    async getSnapshot(): Promise<AdapterSnapshot> {
        await this.waitForHarness();
        return this.page.evaluate(
            ({ globalName }) => {
                return (window as unknown as Record<string, { getSnapshot(): AdapterSnapshot }>)[
                    globalName
                ].getSnapshot();
            },
            { globalName: this.globalName }
        );
    }

    async clearEvents() {
        await this.waitForHarness();
        await this.page.evaluate(
            ({ globalName }) => {
                (window as unknown as Record<string, { clearEvents(): void }>)[globalName].clearEvents();
            },
            { globalName: this.globalName }
        );
    }

    async setField(name: 'switchChain' | 'receiver' | 'value' | 'message', value: string) {
        await this.waitForHarness();
        await this.page.evaluate(
            ({ globalName, key, nextValue }) => {
                (window as unknown as Record<string, { setField(n: string, v: string): void }>)[globalName].setField(
                    key,
                    nextValue
                );
            },
            { globalName: this.globalName, key: name, nextValue: value }
        );
    }
}
