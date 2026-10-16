import type { CheckinCapability, CheckinProviderConfig } from '@/services/api/autoCheckin';

export interface HeaderDraft {
  key: string;
  value: string;
}

export interface CheckinDraft {
  enabled: boolean;
  timezone: string;
  start: string;
  end: string;
  headers: HeaderDraft[];
}

export function effectiveConfig(
  value: Partial<CheckinProviderConfig> | undefined,
  defaults: CheckinProviderConfig
): CheckinProviderConfig {
  return {
    enabled: value?.enabled ?? defaults.enabled ?? false,
    timezone: value?.timezone || defaults.timezone || 'Asia/Shanghai',
    window: {
      start: value?.window?.start || defaults.window?.start || '00:10',
      end: value?.window?.end || defaults.window?.end || '03:10',
    },
    headers: { ...(value?.headers ?? defaults.headers ?? {}) },
  };
}

export function toDraft(config: CheckinProviderConfig): CheckinDraft {
  return {
    enabled: config.enabled,
    timezone: config.timezone,
    start: config.window.start,
    end: config.window.end,
    headers: Object.entries(config.headers).map(([key, value]) => ({ key, value })),
  };
}

function minutes(value: string, allowEnd: boolean): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour > 23) return allowEnd && hour === 24 && minute === 0 ? 1440 : null;
  return hour * 60 + minute;
}

export function validateDraft(draft: CheckinDraft, capability: CheckinCapability): string | null {
  if (!draft.timezone.trim()) return 'timezone_required';
  const start = minutes(draft.start, false);
  const end = minutes(draft.end, true);
  if (start === null || end === null || start >= end) return 'window_invalid';
  const seen = new Set<string>();
  const protectedNames = new Set(capability.protectedHeaders.map((name) => name.toLowerCase()));
  for (const header of draft.headers) {
    const key = header.key.trim();
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key)) return 'header_invalid';
    const normalized = key.toLowerCase();
    if (seen.has(normalized)) return 'header_duplicate';
    if (protectedNames.has(normalized)) return 'header_protected';
    if (/[\r\n\0]/.test(header.value)) return 'header_invalid';
    seen.add(normalized);
  }
  return null;
}

export function serializeDraft(draft: CheckinDraft): CheckinProviderConfig {
  return {
    enabled: draft.enabled,
    timezone: draft.timezone.trim(),
    window: { start: draft.start.padStart(5, '0'), end: draft.end.padStart(5, '0') },
    headers: Object.fromEntries(draft.headers.map(({ key, value }) => [key.trim(), value])),
  };
}

export function draftChanged(draft: CheckinDraft, saved: CheckinProviderConfig): boolean {
  const current = serializeDraft(draft);
  if (
    current.enabled !== saved.enabled ||
    current.timezone !== saved.timezone ||
    current.window.start !== saved.window.start ||
    current.window.end !== saved.window.end
  )
    return true;
  const headers = Object.entries(saved.headers);
  return (
    draft.headers.length !== headers.length ||
    headers.some(([key, value]) => current.headers[key] !== value)
  );
}
