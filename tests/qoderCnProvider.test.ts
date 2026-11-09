import { afterEach, describe, expect, test } from 'bun:test';
import { qoderCnToResource } from '../src/features/providers/adapters';
import { PROVIDER_LOGOS } from '../src/features/providers/brandLogos';
import { PROVIDER_BRAND_ORDER, PROVIDER_DESCRIPTORS } from '../src/features/providers/descriptors';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';
import { normalizeConfigResponse } from '../src/services/api/transformers';
import { AUTH_FILE_ICONS } from '../src/features/authFiles/constants';
import { mockProviderGroupsBackend, withoutSource } from './helpers/providerGroupsBackend';

const originalGet = apiClient.get;
const originalPut = apiClient.put;

afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
});

describe('Qoder CN provider', () => {
  test('normalizes the backend api-keys.qoder-cn groups and exposes a workbench resource', () => {
    const config = normalizeConfigResponse({
      'api-keys': {
        'qoder-cn': [
          {
            name: 'qoder-cn-1',
            'base-url': 'https://api2-v2.qoder.sh',
            keys: [
              {
                'api-key': 'qoder-secret',
                'refresh-token': 'qoder-refresh',
                'machine-id': 'machine-uuid-1',
                priority: 5,
                prefix: 'qd',
                'proxy-url': 'http://proxy.local',
                headers: { 'X-Custom': 'value' },
                models: [{ name: 'claude-opus-4-6', alias: 'opus' }],
                'excluded-models': ['claude-3-5-sonnet'],
                'disable-cooling': true,
                'auth-index': 'qoder-cn:apikey:1',
              },
            ],
          },
        ],
      },
    });

    expect(withoutSource(config.qoderCnApiKeys)).toEqual([
      {
        apiKey: 'qoder-secret',
        refreshToken: 'qoder-refresh',
        machineId: 'machine-uuid-1',
        priority: 5,
        prefix: 'qd',
        baseUrl: 'https://api2-v2.qoder.sh',
        proxyUrl: 'http://proxy.local',
        headers: { 'X-Custom': 'value' },
        models: [{ name: 'claude-opus-4-6', alias: 'opus', sourceIndex: 0 }],
        excludedModels: ['claude-3-5-sonnet'],
        disableCooling: true,
        authIndex: 'qoder-cn:apikey:1',
      },
    ]);

    const resource = qoderCnToResource(config.qoderCnApiKeys![0], 0);
    expect(resource.brand).toBe('qoderCn');
    expect(resource.baseUrl).toBe('https://api2-v2.qoder.sh');
    expect(resource.models).toEqual(['claude-opus-4-6']);
    expect(resource.selector).toEqual({
      brand: 'qoderCn',
      apiKey: 'qoder-secret',
      baseUrl: 'https://api2-v2.qoder.sh',
      index: 0,
    });
  });

  test('is registered in the workbench descriptor, logo, brand order and auth-file tables', () => {
    expect(PROVIDER_DESCRIPTORS.qoderCn).toBeDefined();
    expect(PROVIDER_DESCRIPTORS.qoderCn.supportsApiKey).toBe(true);
    expect(PROVIDER_DESCRIPTORS.qoderCn.baseUrlRequired).toBe(false);
    expect(PROVIDER_DESCRIPTORS.qoderCn.supportsBaseUrl).toBe(true);
    expect(PROVIDER_DESCRIPTORS.qoderCn.supportsModels).toBe(true);
    expect(PROVIDER_DESCRIPTORS.qoderCn.supportsExcludedModels).toBe(true);
    // Qoder's model server does not expose a websocket transport.
    expect(PROVIDER_DESCRIPTORS.qoderCn.supportsWebsockets).toBe(false);
    expect(PROVIDER_LOGOS.qoderCn).toBeDefined();
    expect(PROVIDER_BRAND_ORDER).toContain('qoderCn');
    expect(AUTH_FILE_ICONS['qoder-cn']).toBeDefined();
  });

  test('creates and deletes Qoder CN keys through the backend management contract', async () => {
    const existing = {
      name: 'qoder-cn-1',
      'base-url': 'https://api2-v2.qoder.sh',
      keys: [{ 'api-key': 'existing', 'machine-id': 'existing-machine', 'future-field': 'preserved' }],
    };
    const backend = mockProviderGroupsBackend('qoder-cn', [existing]);

    await providersApi.createQoderCNConfig({
      apiKey: 'qoder-new',
      baseUrl: 'https://api2-v2.qoder.sh',
      machineId: 'machine-uuid-2',
    });
    await providersApi.deleteQoderCNConfig('qoder-new', 'https://api2-v2.qoder.sh');

    const created = {
      name: 'qoder-cn-2',
      'base-url': 'https://api2-v2.qoder.sh',
      keys: [{ 'api-key': 'qoder-new', 'machine-id': 'machine-uuid-2' }],
    };
    expect(backend.calls).toEqual([
      { method: 'GET', url: '/config' },
      { method: 'PUT', url: '/config/api-keys/qoder-cn', body: [existing, created] },
      { method: 'GET', url: '/config' },
      {
        method: 'PUT',
        url: '/config/api-keys/qoder-cn',
        body: [existing, { ...created, keys: [] }],
      },
    ]);
  });

  test('preserves unknown backend fields when updating a key', async () => {
    const backend = mockProviderGroupsBackend('qoder-cn', [
      {
        name: 'qoder-cn-1',
        'base-url': 'https://api2-v2.qoder.sh',
        keys: [{ 'api-key': 'existing', 'future-field': 'preserved' }],
      },
    ]);

    await providersApi.updateQoderCNConfig('existing', 'https://api2-v2.qoder.sh', {
      apiKey: 'existing',
      baseUrl: 'https://api2-v2.qoder.sh',
      machineId: 'rotated-machine',
    });

    expect(backend.groups()).toEqual([
      {
        name: 'qoder-cn-1',
        'base-url': 'https://api2-v2.qoder.sh',
        keys: [{ 'api-key': 'existing', 'future-field': 'preserved', 'machine-id': 'rotated-machine' }],
      },
    ]);
  });
});
