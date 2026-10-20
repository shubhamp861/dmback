import type { AuthContext } from './auth.js';

type Role = AuthContext['role'];

const readers: readonly Role[] = ['owner', 'admin', 'editor', 'viewer'];
const managers: readonly Role[] = ['owner', 'admin'];
const editors: readonly Role[] = ['owner', 'admin', 'editor'];

const permissions = {
  'accounts:read': readers,
  'automations:read': readers,
  'events:read': readers,
  'webhooks:replay': managers,
  'instagram:connect': managers,
  'automations:create': editors,
  'automations:publish': editors,
  'automations:pause': editors,
  'automations:resume': editors
} satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissions;

// Validate runtime values too: session data must never grant an unknown role
// (or a future permission without an explicit policy) access by default.
export function hasPermission(role: unknown, permission: Permission): boolean {
  if (!Object.hasOwn(permissions, permission)) return false;
  return permissions[permission].some((allowedRole) => allowedRole === role);
}
