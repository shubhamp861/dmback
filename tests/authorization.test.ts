import { describe, expect, it } from 'vitest';
import { hasPermission, type Permission } from '../src/authorization.js';

describe('deny-by-default authorization policy', () => {
  it.each(['unknown', 'OWNER', 'toString', '__proto__', '', null, undefined, 1])('denies unrecognized role %s', (role) => {
    for (const permission of ['accounts:read', 'automations:read', 'events:read', 'instagram:connect',
      'automations:create', 'automations:publish', 'automations:pause', 'automations:resume'] as const) {
      expect(hasPermission(role, permission)).toBe(false);
    }
  });

  it.each(['unknown', 'toString', '__proto__'])('denies an unregistered permission %s', (permission) => {
    expect(hasPermission('owner', permission as Permission)).toBe(false);
  });
});
