import { test, expect } from '../fixtures/index.js';
import { defineSignTests } from '@tronweb3/tronwallet-adapter-e2e-shared/specs';
import { safepalConfig } from '../wallet-config.js';

defineSignTests(test, expect, safepalConfig);
