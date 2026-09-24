import { describe, expect, it, vi } from 'vitest';
import { logMissingSettings, missingSettings } from '../../src/lib/startup-checks';

// What a production server reports missing at start (lib/startup-checks.ts): names only, never values.

const COMPLETE = {
  NODE_ENV: 'production',
  INVITES_LEGAL_NAME: 'Badook Ltd',
  INVITES_LEGAL_ID: '515555555',
  INVITES_LEGAL_ADDRESS: 'Tel Aviv',
  INVITES_ACCESSIBILITY_COORDINATOR: 'Dana',
  INVITES_ACCESSIBILITY_PHONE: '03-5555555',
  INVITES_SUPPORT_EMAIL: 'help@example.com',
  INVITES_PUBLIC_BASE_URL: 'https://invitations.example.com',
};

describe('startup checks', () => {
  it('a complete setup has nothing to report', () => {
    expect(missingSettings(COMPLETE)).toEqual([]);
  });

  it('names what is missing, including a public address that is still a placeholder', () => {
    const missing = missingSettings({
      ...COMPLETE,
      INVITES_ACCESSIBILITY_PHONE: ' ',
      INVITES_PUBLIC_BASE_URL: 'https://main.d1.amplifyapp.com',
    });
    expect(missing.map((m) => m.split(' ')[0])).toEqual([
      'INVITES_ACCESSIBILITY_PHONE',
      'INVITES_PUBLIC_BASE_URL',
    ]);
  });

  it('logs only in production, and never a value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logMissingSettings({ ...COMPLETE, NODE_ENV: 'development', INVITES_LEGAL_NAME: '' });
    expect(warn).not.toHaveBeenCalled();
    logMissingSettings({ ...COMPLETE, INVITES_LEGAL_NAME: '' });
    expect(warn).toHaveBeenCalledOnce();
    const text = String(warn.mock.calls[0]?.[0]);
    expect(text).toContain('INVITES_LEGAL_NAME');
    expect(text).not.toContain('515555555');
    warn.mockRestore();
  });
});
