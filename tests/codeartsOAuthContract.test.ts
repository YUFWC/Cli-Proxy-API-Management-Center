import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dir, '..');

const read = (relativePath: string) => readFileSync(join(repoRoot, relativePath), 'utf8');

describe('CodeArts OAuth contract', () => {
  test('translates every CodeArts label in all four locales', () => {
    const locales = ['en', 'zh-CN', 'zh-TW', 'ru'];
    const required = [
      'codearts_oauth_title',
      'codearts_oauth_button',
      'codearts_oauth_hint',
      'codearts_oauth_url_label',
      'codearts_copy_link',
      'codearts_open_link',
      'codearts_oauth_status_waiting',
      'codearts_oauth_status_success',
      'codearts_oauth_status_error',
      'codearts_oauth_start_error',
      'codearts_oauth_polling_error',
    ];
    for (const locale of locales) {
      const dict = JSON.parse(read(`src/i18n/locales/${locale}.json`));
      for (const key of required) {
        expect(dict.auth_login?.[key]).toBeTruthy();
      }
      expect(dict.auth_files?.filter_codearts).toBeTruthy();
      expect(dict.providersPage?.providerNames?.codearts).toBeTruthy();
      for (const key of [
        'secretKey',
        'secretKeyHint',
        'secretKeyCreatePlaceholder',
        'secretKeyEditPlaceholder',
        'showSecretKey',
        'hideSecretKey',
        'securityToken',
        'securityTokenHint',
        'securityTokenCreatePlaceholder',
        'securityTokenEditPlaceholder',
        'showSecurityToken',
        'hideSecurityToken',
        'codeartsRefreshTokenHint',
      ]) {
        expect(dict.providersPage?.form?.[key]).toBeTruthy();
      }
    }
  });
});
