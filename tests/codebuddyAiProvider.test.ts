import { afterEach, describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { codebuddyAiToResource } from '../src/features/providers/adapters';
import { PROVIDER_LOGOS } from '../src/features/providers/brandLogos';
import { PROVIDER_BRAND_ORDER, PROVIDER_DESCRIPTORS } from '../src/features/providers/descriptors';
import { CODEBUDDY_CONFIG } from '../src/features/quota/providers/codebuddy/data';
import { apiCallApi } from '../src/services/api';
import { apiClient } from '../src/services/api/client';
import { oauthApi, type BuiltInOAuthProvider } from '../src/services/api/oauth';
import { providersApi } from '../src/services/api/providers';
import { normalizeConfigResponse } from '../src/services/api/transformers';
import { isCodeBuddyAiFile, isCodeBuddyFile } from '../src/utils/quota/validators';
import type { AuthFileItem } from '../src/types';
import { mockProviderGroupsBackend, withoutSource } from './helpers/providerGroupsBackend';

const originalGet = apiClient.get;
const originalPut = apiClient.put;
const originalApiCallRequest = apiCallApi.request;

afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
  apiCallApi.request = originalApiCallRequest;
});

describe('CodeBuddy AI (international) provider', () => {
  test('normalizes the backend api-keys.codebuddy-ai groups and exposes a workbench resource', () => {
    const config = normalizeConfigResponse({
      'api-keys': {
        'codebuddy-ai': [
          {
            name: 'codebuddy-ai-1',
            'base-url': 'https://www.codebuddy.ai/v2',
            keys: [
              {
                'api-key': 'cbai-secret',
                priority: 3,
                prefix: 'cba',
                'proxy-url': 'http://proxy.local',
                headers: { 'X-Custom': 'value' },
                models: [{ name: 'gpt-5.5', alias: 'gpt-latest' }],
                'excluded-models': ['gemini-2.5-pro'],
                'disable-cooling': true,
                'auth-index': 'codebuddy-ai:apikey:1',
              },
            ],
          },
        ],
      },
    });

    expect(withoutSource(config.codebuddyAiApiKeys)).toEqual([
      {
        apiKey: 'cbai-secret',
        priority: 3,
        prefix: 'cba',
        baseUrl: 'https://www.codebuddy.ai/v2',
        proxyUrl: 'http://proxy.local',
        headers: { 'X-Custom': 'value' },
        models: [{ name: 'gpt-5.5', alias: 'gpt-latest', sourceIndex: 0 }],
        excludedModels: ['gemini-2.5-pro'],
        disableCooling: true,
        authIndex: 'codebuddy-ai:apikey:1',
      },
    ]);

    const resource = codebuddyAiToResource(config.codebuddyAiApiKeys![0], 0);
    expect(resource.brand).toBe('codebuddyAi');
    expect(resource.baseUrl).toBe('https://www.codebuddy.ai/v2');
    expect(resource.models).toEqual(['gpt-5.5']);
    expect(resource.selector).toEqual({
      brand: 'codebuddyAi',
      apiKey: 'cbai-secret',
      baseUrl: 'https://www.codebuddy.ai/v2',
      index: 0,
    });
  });

  test('is registered in the workbench descriptor, logo and brand order tables', () => {
    expect(PROVIDER_DESCRIPTORS.codebuddyAi).toBeDefined();
    expect(PROVIDER_DESCRIPTORS.codebuddyAi.supportsApiKey).toBe(true);
    expect(PROVIDER_DESCRIPTORS.codebuddyAi.baseUrlRequired).toBe(false);
    expect(PROVIDER_DESCRIPTORS.codebuddyAi.supportsBaseUrl).toBe(true);
    expect(PROVIDER_LOGOS.codebuddyAi).toBeDefined();
    expect(PROVIDER_BRAND_ORDER).toContain('codebuddyAi');
  });

  test('creates and deletes international keys through the backend management contract', async () => {
    const existing = {
      name: 'codebuddy-ai-1',
      'base-url': 'https://www.codebuddy.ai/v2',
      keys: [{ 'api-key': 'existing', 'future-field': 'preserved' }],
    };
    const backend = mockProviderGroupsBackend('codebuddy-ai', [existing]);

    await providersApi.createCodeBuddyAIConfig({
      apiKey: 'cbai-new',
      baseUrl: 'https://www.codebuddy.ai/v2',
    });
    await providersApi.deleteCodeBuddyAIConfig('cbai-new', 'https://www.codebuddy.ai/v2');

    const created = {
      name: 'codebuddy-ai-2',
      'base-url': 'https://www.codebuddy.ai/v2',
      keys: [{ 'api-key': 'cbai-new' }],
    };
    expect(backend.calls).toEqual([
      { method: 'GET', url: '/config' },
      { method: 'PUT', url: '/config/api-keys/codebuddy-ai', body: [existing, created] },
      { method: 'GET', url: '/config' },
      {
        method: 'PUT',
        url: '/config/api-keys/codebuddy-ai',
        body: [existing, { ...created, keys: [] }],
      },
    ]);
  });

  test('starts OAuth through the v8 management login endpoint', async () => {
    const calls: Array<{ url: string; config?: unknown }> = [];
    apiClient.get = (async (url: string, config?: unknown) => {
      calls.push({ url, config });
      return {
        url: 'https://www.codebuddy.ai/authorize',
        state: 'codebuddy-ai-state',
      };
    }) as typeof apiClient.get;

    const provider: BuiltInOAuthProvider = 'codebuddy-ai';
    const response = await oauthApi.startAuth(provider);

    expect(response.state).toBe('codebuddy-ai-state');
    expect(calls).toEqual([
      {
        url: '/oauth/auth-url',
        config: { params: { provider: 'codebuddy-ai' } },
      },
    ]);
  });

  test('matches both CodeBuddy CN and international auth files for quota', () => {
    const cn = { provider: 'codebuddy-cn' } as AuthFileItem;
    const ai = { provider: 'codebuddy-ai' } as AuthFileItem;

    expect(isCodeBuddyFile(cn)).toBe(true);
    expect(isCodeBuddyFile(ai)).toBe(true);
    expect(isCodeBuddyAiFile(cn)).toBe(false);
    expect(isCodeBuddyAiFile(ai)).toBe(true);
  });
});

describe('CodeBuddy AI quota dispatch', () => {
  test('routes international auth files to the codebuddy.ai billing endpoint', async () => {
    const calls: Array<{ url: string; header?: Record<string, string> }> = [];
    apiCallApi.request = (async (options: { url: string; header?: Record<string, string> }) => {
      calls.push({ url: options.url, header: options.header });
      return {
        statusCode: 200,
        body: JSON.stringify({
          code: 0,
          data: {
            Response: {
              Data: {
                Accounts: [
                  {
                    PackageName: 'Pro',
                    CycleStartTime: 1700000000,
                    CycleEndTime: 1700000000 + 30 * 24 * 3600,
                    DeductionEndTime: 1700000000 + 365 * 24 * 3600,
                    CycleCapacitySize: '100',
                    CycleCapacityUsed: '10',
                  },
                ],
              },
            },
          },
        }),
      };
    }) as typeof apiCallApi.request;

    const t = ((key: string) => key) as unknown as TFunction;
    const result = await CODEBUDDY_CONFIG.fetchQuota(
      { name: 'ai.json', provider: 'codebuddy-ai', auth_index: 'auth-1' } as AuthFileItem,
      t
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://www.codebuddy.ai/v2/billing/meter/get-user-resource');
    expect(calls[0].header?.['X-Domain']).toBe('www.codebuddy.ai');
    expect(result.plan).toBe('Pro');
  });

  test('routes CN auth files to the copilot.tencent.com billing endpoint without X-Domain', async () => {
    const calls: Array<{ url: string; header?: Record<string, string> }> = [];
    apiCallApi.request = (async (options: { url: string; header?: Record<string, string> }) => {
      calls.push({ url: options.url, header: options.header });
      return {
        statusCode: 200,
        body: JSON.stringify({
          code: 0,
          data: {
            Response: {
              Data: {
                Accounts: [
                  {
                    PackageName: 'Pro',
                    CycleStartTime: 1700000000,
                    CycleEndTime: 1700000000 + 30 * 24 * 3600,
                    DeductionEndTime: 1700000000 + 365 * 24 * 3600,
                    CycleCapacitySize: '100',
                    CycleCapacityUsed: '10',
                  },
                ],
              },
            },
          },
        }),
      };
    }) as typeof apiCallApi.request;

    const t = ((key: string) => key) as unknown as TFunction;
    await CODEBUDDY_CONFIG.fetchQuota(
      { name: 'cn.json', provider: 'codebuddy-cn', auth_index: 'auth-2' } as AuthFileItem,
      t
    );

    expect(calls[0].url).toBe('https://copilot.tencent.com/v2/billing/meter/get-user-resource');
    expect(calls[0].header?.['X-Domain']).toBeUndefined();
  });
});
