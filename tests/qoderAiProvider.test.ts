import { afterEach, describe, expect, test } from 'bun:test';
import { qoderAiToResource } from '../src/features/providers/adapters';
import { PROVIDER_LOGOS } from '../src/features/providers/brandLogos';
import { PROVIDER_BRAND_ORDER, PROVIDER_DESCRIPTORS } from '../src/features/providers/descriptors';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';
import { normalizeConfigResponse } from '../src/services/api/transformers';
import { AUTH_FILE_ICONS } from '../src/features/authFiles/constants';
import { isQoderAIFile, isQoderCNFile } from '../src/utils/quota';
import { QODERCN_CONFIG } from '../src/features/quota/providers/qodercn/data';
import type { AuthFileItem } from '../src/types';
import { mockProviderGroupsBackend, withoutSource } from './helpers/providerGroupsBackend';

const originalGet = apiClient.get;
const originalPut = apiClient.put;

afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
});

const qoderFile = (provider: string): AuthFileItem => ({
  name: `${provider}-1.json`,
  type: provider,
  authIndex: `${provider}:apikey:1`,
});

describe('Qoder AI (international) provider', () => {
  test('normalizes the backend api-keys.qoder-ai groups and exposes a workbench resource', () => {
    const config = normalizeConfigResponse({
      'api-keys': {
        'qoder-ai': [
          {
            name: 'qoder-ai-1',
            'base-url': 'https://api3.qoder.sh',
            keys: [
              {
                'api-key': 'qoder-ai-secret',
                'refresh-token': 'qoder-ai-refresh',
                'machine-id': 'machine-uuid-ai',
                priority: 3,
                prefix: 'qdai',
                'proxy-url': 'http://proxy.local',
                headers: { 'X-Custom': 'value' },
                models: [{ name: 'qmodel_38max', alias: 'qwen-max' }],
                'excluded-models': ['gmodel'],
                'disable-cooling': true,
                'auth-index': 'qoder-ai:apikey:1',
              },
            ],
          },
        ],
      },
    });

    expect(withoutSource(config.qoderAiApiKeys)).toEqual([
      {
        apiKey: 'qoder-ai-secret',
        refreshToken: 'qoder-ai-refresh',
        machineId: 'machine-uuid-ai',
        priority: 3,
        prefix: 'qdai',
        baseUrl: 'https://api3.qoder.sh',
        proxyUrl: 'http://proxy.local',
        headers: { 'X-Custom': 'value' },
        models: [{ name: 'qmodel_38max', alias: 'qwen-max', sourceIndex: 0 }],
        excludedModels: ['gmodel'],
        disableCooling: true,
        authIndex: 'qoder-ai:apikey:1',
      },
    ]);

    const resource = qoderAiToResource(config.qoderAiApiKeys![0], 0);
    expect(resource.brand).toBe('qoderAi');
    expect(resource.baseUrl).toBe('https://api3.qoder.sh');
    expect(resource.models).toEqual(['qmodel_38max']);
    expect(resource.selector).toEqual({
      brand: 'qoderAi',
      apiKey: 'qoder-ai-secret',
      baseUrl: 'https://api3.qoder.sh',
      index: 0,
    });
  });

  test('is registered in the workbench descriptor, logo, brand order and auth-file tables', () => {
    expect(PROVIDER_DESCRIPTORS.qoderAi).toBeDefined();
    expect(PROVIDER_DESCRIPTORS.qoderAi.supportsApiKey).toBe(true);
    expect(PROVIDER_DESCRIPTORS.qoderAi.baseUrlRequired).toBe(false);
    expect(PROVIDER_DESCRIPTORS.qoderAi.supportsBaseUrl).toBe(true);
    expect(PROVIDER_DESCRIPTORS.qoderAi.supportsModels).toBe(true);
    expect(PROVIDER_DESCRIPTORS.qoderAi.supportsExcludedModels).toBe(true);
    expect(PROVIDER_DESCRIPTORS.qoderAi.supportsWebsockets).toBe(false);
    expect(PROVIDER_LOGOS.qoderAi).toBeDefined();
    expect(PROVIDER_BRAND_ORDER).toContain('qoderAi');
    expect(AUTH_FILE_ICONS['qoder-ai']).toBeDefined();
  });

  test('writes the api-keys.qoder-ai groups through the management contract', async () => {
    const existing = {
      name: 'qoder-ai-1',
      'base-url': 'https://api3.qoder.sh',
      keys: [{ 'api-key': 'existing', 'future-field': 'kept' }],
    };
    const backend = mockProviderGroupsBackend('qoder-ai', [existing]);

    await providersApi.createQoderAIConfig({
      apiKey: 'qoder-ai-new',
      baseUrl: 'https://api3.qoder.sh',
      machineId: 'machine-uuid-2',
    });
    await providersApi.deleteQoderAIConfig('qoder-ai-new', 'https://api3.qoder.sh');

    const created = {
      name: 'qoder-ai-2',
      'base-url': 'https://api3.qoder.sh',
      keys: [{ 'api-key': 'qoder-ai-new', 'machine-id': 'machine-uuid-2' }],
    };
    expect(backend.calls).toEqual([
      { method: 'GET', url: '/config' },
      { method: 'PUT', url: '/config/api-keys/qoder-ai', body: [existing, created] },
      { method: 'GET', url: '/config' },
      {
        method: 'PUT',
        url: '/config/api-keys/qoder-ai',
        body: [existing, { ...created, keys: [] }],
      },
    ]);
  });

  test('the shared Qoder quota adapter claims both environments', () => {
    // The CN and AI credentials carry distinct providers but share one payload
    // shape, so a single adapter must classify both (and keep ignoring the rest).
    expect(isQoderCNFile(qoderFile('qoder-cn'))).toBe(true);
    expect(isQoderAIFile(qoderFile('qoder-ai'))).toBe(true);
    expect(isQoderCNFile(qoderFile('qoder-ai'))).toBe(false);
    expect(isQoderAIFile(qoderFile('qoder-cn'))).toBe(false);

    expect(QODERCN_CONFIG.filterFn(qoderFile('qoder-cn'))).toBe(true);
    expect(QODERCN_CONFIG.filterFn(qoderFile('qoder-ai'))).toBe(true);
    expect(QODERCN_CONFIG.filterFn(qoderFile('codex'))).toBe(false);
    // A disabled file is excluded regardless of environment.
    expect(QODERCN_CONFIG.filterFn({ ...qoderFile('qoder-ai'), disabled: true })).toBe(false);
  });
});
