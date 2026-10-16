import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dir, '..');

const read = (relativePath: string) => readFileSync(join(repoRoot, relativePath), 'utf8');

describe('Xiaohuanxiong OAuth contract', () => {
  test('translates every Xiaohuanxiong label in all four locales', () => {
    const locales = ['en', 'zh-CN', 'zh-TW', 'ru'];
    const required = [
      'xiaohuanxiong_oauth_title',
      'xiaohuanxiong_oauth_button',
      'xiaohuanxiong_oauth_hint',
      'xiaohuanxiong_oauth_url_label',
      'xiaohuanxiong_callback_label',
      'xiaohuanxiong_callback_hint',
      'xiaohuanxiong_callback_placeholder',
      'xiaohuanxiong_callback_required',
      'xiaohuanxiong_copy_link',
      'xiaohuanxiong_open_link',
      'xiaohuanxiong_oauth_status_waiting',
      'xiaohuanxiong_oauth_status_success',
      'xiaohuanxiong_oauth_status_error',
      'xiaohuanxiong_oauth_start_error',
      'xiaohuanxiong_oauth_polling_error',
    ];
    for (const locale of locales) {
      const dict = JSON.parse(read(`src/i18n/locales/${locale}.json`));
      for (const key of required) {
        expect(dict.auth_login?.[key]).toBeTruthy();
      }
      expect(dict.providersPage?.providerNames?.xiaohuanxiong).toBeTruthy();
      for (const key of [
        'refreshToken',
        'refreshTokenHint',
        'refreshTokenCreatePlaceholder',
        'refreshTokenEditPlaceholder',
        'showRefreshToken',
        'hideRefreshToken',
      ]) {
        expect(dict.providersPage?.form?.[key]).toBeTruthy();
      }
    }
  });
});
