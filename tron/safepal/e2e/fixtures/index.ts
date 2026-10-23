import { createE2EFixtures } from '@tronweb3/tronwallet-adapter-e2e-shared';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { safepalConfig } from '../wallet-config.js';

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { test, expect, e2eEnv } = createE2EFixtures(safepalConfig, e2eDir);

export { test, expect, e2eEnv };
