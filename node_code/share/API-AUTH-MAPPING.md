# DMlinl API and Authentication Mapping

**Audience:** Frontend implementation team

**Backend source of truth:** `backend/src/routes.ts` and
the related source files referenced in this document.

**Document status:** Replay/security addendum reviewed 2026-10-19; older examples
below may still use legacy shell paths.

## Latest addition: audited webhook replay

`POST /v1/webhook-events/:id/replay` requires Owner/Admin authentication and
CSRF cookie/header/session agreement. No body is needed; extra fields are
rejected. The actor/workspace come exclusively from the session.

Response: HTTP 202, `{ data: { id: replayRequestId, webhookEventId, status: 'pending' } }`.
This confirms durable acceptance, not processing completion or a sent message.
The worker polls the replay outbox. Redis failure does not discard acceptance.

Errors: `400 INVALID_ID`/`VALIDATION_ERROR`, `401 UNAUTHENTICATED`,
`403 FORBIDDEN`/`CSRF_INVALID`, or uniform `404 NOT_FOUND` for missing, foreign,
mixed-workspace, unknown-account and unsupported payloads. Persistence failures
return 500; no replay acceptance is reported.

Only stored Instagram comment payloads whose **every entry account** belongs
to the workspace are eligible. Each accepted request creates a new replay UUID
and an immutable `webhook.replay.requested` audit record. Repeated requests are
independently audited; existing trigger idempotency prevents duplicate matching
results. Recorded triggers are not cleared, and replay uses current live rules.
The API does not expose raw payloads or add an audit-list/status endpoint.
Apply migration `002_webhook_replays.sql` before using this endpoint.

Current role policy: all recognized roles may read workspace resources;
Owner/Admin/Editor may mutate automations; only Owner/Admin may connect
Instagram or replay webhooks. Unknown roles are denied.

> This document describes the API that exists today. It is not a description of
> future endpoints. Items marked **Not implemented** must not be built as if the
> backend already supports them.

## 1. Product and current backend scope

DMlinl is an Instagram comment-to-DM automation product. The current backend
foundation supports:

- User signup, login, logout, current-session lookup, and password reset records.
- Workspace creation during signup and basic workspace-scoped queries.
- Provisional Instagram OAuth account connection.
- Instagram account listing without exposing access tokens.
- Automation creation, listing, detail lookup, event lookup, and status changes.
- Instagram webhook verification and comment matching through a worker.
- Keyword matching and idempotent trigger-event recording.

The current backend **does not send real Instagram DMs or public replies**. A
matching event with `outcome: "queued"` means matching succeeded and was
recorded; it does not mean a message was sent.

## 2. Local API connection

### Default local URLs

| Item | Value |
| --- | --- |
| API base URL | `http://127.0.0.1:3000` |
| Health | `GET /health` |
| Frontend development origin | Usually `http://127.0.0.1:3001` or the configured `WEB_ORIGIN` |
| API prefix | There is no additional `/api` prefix |

Use one host consistently during local development. Cookies are host-only: a
cookie created by `localhost` is not the same cookie as one created by
`127.0.0.1`. If the frontend runs at `http://localhost:3001`, configure the
backend `WEB_ORIGIN` to exactly that origin and use `http://localhost:3000` for
API requests. If the backend `.env` uses `127.0.0.1`, use `127.0.0.1` for both
frontend and API where possible.

### Browser request requirements

The backend uses cookie sessions, not Bearer tokens. Every browser request that
needs authentication must include credentials:

```ts
const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
  credentials: 'include'
});
```

For state-changing automation requests, send the CSRF token in the header. The
frontend can read the non-HTTP-only `csrf_token` cookie:

```ts
const csrfToken = readCookie('csrf_token');

await fetch(`${API_BASE_URL}/v1/automations/${id}/pause`, {
  method: 'POST',
  credentials: 'include',
  headers: {
    'x-csrf-token': csrfToken ?? ''
  }
});
```

Do not try to read the `session` cookie from JavaScript. It is `HttpOnly` by
design. The browser sends it automatically when `credentials: "include"` is
used.

### CORS

The backend enables credentials and allows the configured `WEB_ORIGIN`. The
frontend origin must exactly match that setting, including protocol and port.
Do not use `Access-Control-Allow-Origin: *` with credentials.

### Body and transport

- Send JSON with `Content-Type: application/json` for JSON request bodies.
- Maximum request body size is 1 MiB.
- API errors are JSON except the successful webhook challenge, which is plain
  text.
- There is no generated OpenAPI document yet.

## 3. Response and error conventions

### Success envelopes

Most application endpoints return a `data` envelope:

```json
{
  "data": {}
}
```

List endpoints return:

```json
{
  "data": []
}
```

The health endpoint and webhook receiver are exceptions:

```json
{"status":"ok","database":"up"}
```

```json
{"received":true}
```

### Validation error

```http
400 Bad Request
```

```json
{
  "code": "VALIDATION_ERROR",
  "message": "The request payload is invalid",
  "fields": {
    "email": ["Invalid email address"]
  }
}
```

`fields` comes from Zod and can contain arrays of messages. Render the field
messages when possible; use the top-level message for a form-level error.

### Standard application error

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable message"
}
```

### Unexpected error

```json
{
  "code": "INTERNAL_ERROR",
  "message": "An internal error occurred",
  "requestId": "request-id"
}
```

Use `requestId` when reporting a problem to the backend team. Do not display raw
database, provider, stack-trace, token, or secret values to users.

### Common status handling

| Status | Meaning | Frontend behavior |
| ---: | --- | --- |
| `200` | Successful read/action | Update local state |
| `201` | Resource created | Add returned resource to state |
| `202` | Accepted for asynchronous/non-disclosing operation | Show accepted/pending state |
| `302` | OAuth redirect | Let the browser follow the redirect for OAuth start |
| `400` | Invalid request or business input | Show validation/business error |
| `401` | No valid session or invalid login | Clear auth state or show login error |
| `403` | CSRF failure or webhook verification failure | Refresh session/CSRF or show configuration error |
| `404` | Resource does not exist or is outside workspace | Show not-found state |
| `409` | Signup email already exists | Show account-exists message |
| `503` | Dependency/configuration unavailable | Show retry/setup state |

## 4. Authentication model

### Session cookies

Successful signup and login set two cookies with `Set-Cookie` headers:

| Cookie | JavaScript-readable | Purpose |
| --- | ---: | --- |
| `session` | No (`HttpOnly`) | Authenticates the browser session |
| `csrf_token` | Yes | Must be echoed in `x-csrf-token` for protected mutations |

Cookie behavior:

- `Path=/`
- `SameSite=Lax`
- `Secure=true` in production, false in local development
- Maximum age: 30 days
- No explicit `Domain`; cookies are host-only

The frontend should treat the response body user as the current user and call
`GET /v1/auth/me` on application startup to restore auth state. Do not store the
session token in localStorage, sessionStorage, IndexedDB, or application state.

### CSRF-protected routes

The CSRF cookie/header pair is currently required for:

- `POST /v1/automations`
- `POST /v1/automations/:id/publish`
- `POST /v1/automations/:id/pause`
- `POST /v1/automations/:id/resume`

The header must exactly equal the `csrf_token` cookie. Missing or invalid CSRF:

```http
403 Forbidden
```

```json
{
  "code": "CSRF_INVALID",
  "message": "CSRF token is missing or invalid"
}
```

Signup, login, logout, password reset routes, and Instagram OAuth routes do not
currently require CSRF. The Instagram webhook POST uses Meta HMAC verification,
not browser session authentication.

### Auth state flow

Recommended frontend flow:

1. App starts with `authStatus: "loading"`.
2. Call `GET /v1/auth/me` with credentials.
3. On `200`, store the returned safe user context in memory.
4. On `401`, clear user state and show logged-out UI.
5. On login/signup success, use the returned `data` user and navigate to the
   authenticated app.
6. On logout, clear local user state regardless of the API response.
7. On any authenticated request returning `401`, clear user state and redirect to
   login, preserving the intended route if desired.

The backend does not return a refresh token. A valid session cookie is the
long-lived browser credential.

## 5. Authentication endpoints

### `POST /v1/auth/signup`

Creates a user, workspace, owner membership, session, and CSRF cookie.

#### Request

```json
{
  "email": "person@example.com",
  "password": "at-least-12-characters",
  "workspaceName": "My workspace"
}
```

| Field | Required | Rules |
| --- | ---: | --- |
| `email` | Yes | Trimmed, valid email, max 320 chars; stored lowercase |
| `password` | Yes | 12–256 chars |
| `workspaceName` | No | Trimmed, 1–120 chars; defaults to `My workspace` |

#### Success

```http
201 Created
```

```json
{
  "data": {
    "id": "user-uuid",
    "email": "person@example.com",
    "workspaceId": "workspace-uuid",
    "role": "owner"
  }
}
```

Cookies are set by the response. The session/CSRF values are not returned in
JSON.

#### Errors

- `400 VALIDATION_ERROR` — invalid email/password/workspace name.
- `409 EMAIL_TAKEN` — an account already exists for the normalized email.

```json
{
  "code": "EMAIL_TAKEN",
  "message": "An account already exists for this email"
}
```

### Email-verification OTP signup

The recommended signup flow is a three-step sequence. The legacy
`POST /v1/auth/signup` endpoint remains available for existing clients.

#### `POST /v1/auth/signup/request-otp`

Request:

```json
{ "email": "person@example.com" }
```

The email is trimmed and normalized to lowercase. The response is intentionally
the same whether the address is new, already registered, or currently inside the
resend cooldown; the endpoint never reveals account existence.

```http
202 Accepted
```

```json
{ "data": { "accepted": true } }
```

For a new address, the development provider records an email containing a
six-digit OTP. OTPs are stored only as challenge-bound hashes, expire after 10
minutes, allow at most five attempts, and have a 60-second resend cooldown.
Production mail delivery is not configured by this backend.

#### `POST /v1/auth/signup/verify-otp`

Request:

```json
{ "email": "person@example.com", "otp": "123456" }
```

On a valid, unexpired, not-yet-consumed code:

```http
200 OK
```

```json
{ "data": { "verificationToken": "opaque-token" } }
```

The returned token expires after 10 minutes and can be consumed only once by the
complete step. Invalid, expired, exhausted, reused, and duplicate-email attempts
use the same generic OTP failure response where applicable:

```http
400 Bad Request
```

```json
{ "code": "INVALID_SIGNUP_OTP", "message": "The verification code is invalid or expired" }
```

#### `POST /v1/auth/signup/complete`

Request:

```json
{
  "verificationToken": "opaque-token",
  "password": "at-least-12-characters",
  "workspaceName": "My workspace"
}
```

`workspaceName` is optional and defaults to `My workspace`; `password` must be
12–256 characters. On success the verified user, owner membership, workspace,
and existing cookie session are created atomically:

```http
201 Created
```

```json
{
  "data": {
    "id": "user-uuid",
    "email": "person@example.com",
    "workspaceId": "workspace-uuid",
    "role": "owner"
  }
}
```

The response sets the existing `session` (HttpOnly) and `csrf_token` cookies;
their JSON values are never returned. Invalid or replayed tokens return
`400 INVALID_VERIFICATION_TOKEN`; a duplicate email at completion returns
`409 EMAIL_TAKEN`.

### `POST /v1/auth/login`

#### Request

```json
{
  "email": "person@example.com",
  "password": "password"
}
```

| Field | Required | Rules |
| --- | ---: | --- |
| `email` | Yes | Trimmed, valid email, max 320 chars |
| `password` | Yes | 1–256 chars |

#### Success

```http
200 OK
```

```json
{
  "data": {
    "id": "user-uuid",
    "email": "person@example.com",
    "workspaceId": "workspace-uuid",
    "role": "owner"
  }
}
```

#### Invalid credentials

```http
401 Unauthorized
```

```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "Email or password is incorrect"
}
```

Do not distinguish “email does not exist” from “password is wrong” in the UI.

### `POST /v1/auth/logout`

Revokes the current session when the `session` cookie is present and clears both
cookies. It is safe to call when already logged out.

```http
200 OK
```

```json
{
  "data": {
    "loggedOut": true
  }
}
```

### `GET /v1/auth/me`

Restores the current session.

#### Success

```http
200 OK
```

```json
{
  "data": {
    "id": "user-uuid",
    "email": "person@example.com",
    "workspaceId": "workspace-uuid",
    "role": "owner"
  }
}
```

#### Not authenticated

```http
401 Unauthorized
```

```json
{
  "code": "UNAUTHENTICATED",
  "message": "Authentication is required"
}
```

### `POST /v1/auth/reset/request`

Requests a password reset. The response intentionally does not reveal whether
the email exists.

#### Request

```json
{
  "email": "person@example.com"
}
```

#### Success

```http
202 Accepted
```

```json
{
  "data": {
    "accepted": true
  }
}
```

#### Current limitation

The backend creates a 30-minute reset record but does not send an email and does
not return the reset token. The frontend can show a generic “If the account
exists, instructions will be sent” message, but a real reset flow cannot be
completed until an email/provider integration exists.

### `POST /v1/auth/reset/confirm`

#### Request

```json
{
  "token": "reset-token-from-email",
  "password": "new-password-at-least-12"
}
```

| Field | Required | Rules |
| --- | ---: | --- |
| `token` | Yes | 20–256 chars |
| `password` | Yes | 12–256 chars |

#### Success

```http
200 OK
```

```json
{
  "data": {
    "reset": true
  }
}
```

All existing sessions for the user are revoked. The endpoint does not create a
new session; send the user to login after success.

#### Invalid/expired token

```http
400 Bad Request
```

```json
{
  "code": "INVALID_RESET_TOKEN",
  "message": "Reset token is invalid or expired"
}
```

## 6. Instagram account connection endpoints

The current OAuth implementation is provisional. Real Meta credentials, current
Meta contract confirmation, and a staging professional Instagram account are
required before this flow can be treated as production-ready.

### `GET /v1/auth/instagram/start`

Requires a valid session. It does not require a CSRF header because it is a GET.

#### Success

```http
302 Found
Location: https://www.instagram.com/oauth/authorize?...
```

The browser should navigate to this endpoint rather than calling it with a JSON
API client. The backend creates a random OAuth state that is:

- Stored hashed in the database.
- Bound to the current session and workspace.
- Single-use.
- Valid for 10 minutes.

Example frontend action:

```ts
window.location.assign(`${API_BASE_URL}/v1/auth/instagram/start`);
```

#### Configuration failure

Local development placeholders intentionally produce:

```http
503 Service Unavailable
```

```json
{
  "code": "META_CONFIG_MISSING",
  "message": "Meta OAuth credentials are not configured"
}
```

#### Frontend callback behavior

The callback currently returns JSON directly from the backend. It does not
redirect back to the frontend after completion. The frontend should either:

1. Use the backend callback URL as a result page and display the JSON/error; or
2. Coordinate a future backend change to redirect to a frontend success/error
   route.

Do not assume a frontend redirect exists today.

### `GET /v1/auth/instagram/callback`

Requires the same valid browser session used to start OAuth. The session check
happens before callback query validation.

#### Query parameters

| Parameter | Required | Rules |
| --- | ---: | --- |
| `code` | Success only | 1–4096 chars |
| `state` | Success only | 20–256 chars |
| `error` | Optional | Provider error string |
| `error_reason` | Optional | Accepted but currently not surfaced |

#### Authorization denied

```http
400 Bad Request
```

```json
{
  "code": "INSTAGRAM_AUTHORIZATION_DENIED",
  "message": "Instagram authorization was not completed"
}
```

#### Missing code/state

```http
400 Bad Request
```

```json
{
  "code": "INVALID_OAUTH_CALLBACK",
  "message": "Instagram callback is missing required parameters"
}
```

#### Known OAuth error codes

| Code | Status | Meaning |
| --- | ---: | --- |
| `META_CONFIG_MISSING` | `503` | Meta credentials are placeholders/missing |
| `INVALID_OAUTH_STATE` | `400` | State is invalid, expired, reused, or belongs to another session/workspace |
| `META_TOKEN_EXCHANGE_FAILED` | `400` | Code/token exchange failed |
| `META_PROFILE_FAILED` | `400` | Profile lookup or response validation failed |
| `INSTAGRAM_ACCOUNT_TYPE_REQUIRED` | `400` | Account is not a supported professional account |
| `INSTAGRAM_ACCOUNT_ALREADY_CONNECTED` | `400` | Account belongs to another workspace |

#### Success

```http
200 OK
```

```json
{
  "data": {
    "id": "internal-account-uuid",
    "workspaceId": "workspace-uuid",
    "igUserId": "instagram-user-id",
    "username": "instagram_username",
    "accountType": "BUSINESS",
    "profilePictureUrl": "https://example.com/profile.jpg",
    "permissions": [
      "instagram_business_basic",
      "instagram_business_manage_comments",
      "instagram_business_manage_messages"
    ],
    "status": "active",
    "tokenExpiresAt": "2026-10-17T00:00:00.000Z"
  }
}
```

The access token is never returned. The callback exchanges the code, obtains a
long-lived token, fetches profile information, checks for a professional account
type, encrypts the token, and stores the account.

### `GET /v1/ig-accounts`

Requires a valid session. No query parameters.

#### Success

```http
200 OK
```

```json
{
  "data": [
    {
      "id": "internal-account-uuid",
      "workspaceId": "workspace-uuid",
      "igUserId": "instagram-user-id",
      "username": "instagram_username",
      "accountType": "BUSINESS",
      "profilePictureUrl": "https://example.com/profile.jpg",
      "permissions": [],
      "status": "active",
      "tokenExpiresAt": null
    }
  ]
}
```

The list is workspace-scoped. It returns `data: []` when no account is connected.
Token material is never included.

## 7. Automation API

### Automation object shape

There is an important current contract detail: automation **requests** use
camelCase, but automation **responses currently return raw database rows using
snake_case**. The frontend should use an adapter at the API boundary and expose
one consistent internal frontend type.

Example response shape:

```json
{
  "id": "automation-uuid",
  "ig_account_id": "account-uuid",
  "name": "Send the guide",
  "status": "draft",
  "trigger": {
    "type": "comment"
  },
  "keyword_rules": [
    {
      "value": "guide",
      "mode": "contains",
      "caseSensitive": false
    }
  ],
  "public_replies": ["Thanks! Check your DMs."],
  "flow_id": null,
  "settings": {
    "exclusions": [],
    "dailyCap": null,
    "schedule": {
      "timezone": "UTC",
      "startHour": 0,
      "endHour": 24
    }
  },
  "created_by": null,
  "created_at": "2026-10-17T00:00:00.000Z",
  "updated_at": "2026-10-17T00:00:00.000Z"
}
```

Recommended frontend normalized type:

```ts
type Automation = {
  id: string;
  igAccountId: string;
  name: string;
  status: 'draft' | 'live' | 'paused' | 'error';
  trigger: { type: 'comment' };
  keywordRules: KeywordRule[];
  publicReplies: string[];
  flowId: string | null;
  settings: AutomationSettings;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};
```

The backend stores `exclusions` inside `settings.exclusions`, although the
create request accepts it as a top-level `exclusions` field. Keep that mapping
inside the frontend API adapter.

### Create request schema

Used by `POST /v1/automations`.

```json
{
  "name": "Send the guide",
  "igAccountId": "33333333-3333-4333-8333-333333333333",
  "trigger": {
    "type": "comment"
  },
  "keywordRules": [
    {
      "value": "guide",
      "mode": "contains",
      "caseSensitive": false
    }
  ],
  "exclusions": [],
  "publicReplies": ["Thanks! Check your DMs."],
  "flowId": null,
  "settings": {
    "dailyCap": null,
    "schedule": {
      "timezone": "UTC",
      "startHour": 0,
      "endHour": 24
    }
  }
}
```

| Field | Required | Rules/default |
| --- | ---: | --- |
| `name` | Yes | Trimmed, 1–120 chars |
| `igAccountId` | Yes | UUID; must belong to current workspace |
| `trigger` | No | Defaults to `{ "type": "comment" }`; only `comment` accepted |
| `keywordRules` | Yes | 1–50 rules |
| `exclusions` | No | 0–50 rules; defaults to `[]` |
| `publicReplies` | No | 0–20 strings, each 1–1000 chars; defaults to `[]` |
| `flowId` | No | UUID or `null`; defaults to `null` |
| `settings` | No | Defaults to no cap and full-day UTC schedule |

Keyword rule:

```json
{
  "value": "guide",
  "mode": "contains",
  "caseSensitive": false
}
```

| Rule field | Required | Rules/default |
| --- | ---: | --- |
| `value` | Yes | Trimmed, 1–200 chars |
| `mode` | No | `contains`, `exact`, `starts_with`, or `regex`; defaults to `contains` |
| `caseSensitive` | No | Boolean; defaults to `false` |

Settings:

| Field | Rules/default |
| --- | --- |
| `dailyCap` | Positive integer or `null`; defaults to `null` |
| `schedule.timezone` | Non-empty string; defaults to `UTC` |
| `schedule.startHour` | Integer 0–23; defaults to `0` |
| `schedule.endHour` | Integer 1–24; defaults to `24` |
| Schedule relation | `endHour` must be greater than `startHour` |

Overnight schedules are not supported. Unknown properties are stripped by the
current Zod schemas rather than rejected.

### `GET /v1/automations`

Requires a valid session. No query parameters, pagination, or filtering exist.

```http
200 OK
```

```json
{
  "data": [
    {
      "id": "automation-uuid",
      "ig_account_id": "account-uuid",
      "name": "Send the guide",
      "status": "live",
      "keyword_rules": [],
      "public_replies": [],
      "settings": {}
    }
  ]
}
```

### `POST /v1/automations`

Requires a valid session, the `csrf_token` cookie, and a matching
`x-csrf-token` header.

#### Success

```http
201 Created
```

Returns the created raw database automation row under `data`.

#### Errors

- `400 VALIDATION_ERROR` — invalid body.
- `401 UNAUTHENTICATED` — no valid session.
- `403 CSRF_INVALID` — missing/mismatched CSRF token.
- `404 ACCOUNT_NOT_FOUND` — account is missing or belongs to another workspace.

### `GET /v1/automations/:id`

Requires a valid session. `id` must be a UUID.

#### Success

```http
200 OK
```

Returns one raw automation row under `data`.

#### Errors

- `400 INVALID_ID` — path ID is not a UUID.
- `401 UNAUTHENTICATED` — no valid session.
- `404 NOT_FOUND` — automation is missing or outside the current workspace.

```json
{
  "code": "NOT_FOUND",
  "message": "Automation not found"
}
```

### `GET /v1/automations/:id/events`

Requires a valid session. `id` must be a UUID. The endpoint first confirms the
automation belongs to the current workspace.

#### Success

```http
200 OK
```

```json
{
  "data": [
    {
      "id": "trigger-event-uuid",
      "ig_account_id": "account-uuid",
      "automation_id": "automation-uuid",
      "comment_id": "instagram-comment-id",
      "comment_text": "Can I get the guide?",
      "matched_keyword": "guide",
      "outcome": "queued",
      "reason_code": null,
      "attempts": 0,
      "created_at": "2026-10-17T00:00:00.000Z",
      "sent_at": null
    }
  ]
}
```

Current outcomes:

- `queued` — keyword matched; no message has been sent yet.
- `skipped` — matching/planning skipped the comment.
- `failed` — reserved for failed processing/sending behavior.
- `sent` — reserved for future sending behavior.

Current reason codes include:

- `NO_KEYWORD_MATCH`
- `EXCLUDED_WORD`
- `NOT_TOP_LEVEL`

#### Errors

- `400 INVALID_ID`
- `401 UNAUTHENTICATED`
- `404 NOT_FOUND`

There is no pagination, date filter, outcome filter, or search parameter yet.

### Automation status actions

These routes have no request body. They require a valid session, CSRF cookie, and
matching `x-csrf-token` header.

| Method | Path | New status |
| --- | --- | --- |
| `POST` | `/v1/automations/:id/publish` | `live` |
| `POST` | `/v1/automations/:id/pause` | `paused` |
| `POST` | `/v1/automations/:id/resume` | `live` |

#### Success

```http
200 OK
```

Returns the updated raw database automation row under `data`.

#### Errors

- `400 INVALID_ID`
- `401 UNAUTHENTICATED`
- `403 CSRF_INVALID`
- `404 NOT_FOUND`

Role authorization is enforced, but full publish and state-transition validation
are not implemented. The frontend should show confirmation/loading states but should not
assume that `publish` validates Meta account readiness, flow completeness, plan
limits, or message configuration yet.

### Routes not currently available

Do not call or build against these as if they exist:

- `PATCH /v1/automations/:id`
- `DELETE /v1/automations/:id`
- Duplicate automation
- Test-send
- Retry event
- Media list/sync/detail
- Contacts and templates
- Flows and flow runs
- Conversations/inbox
- Analytics
- Billing/usage
- Notifications
- Team/membership management
- Account disconnect/reconnect/token refresh

## 8. Webhook and matching behavior

Webhook routes are normally called by Meta, not by the frontend. They are
documented here so the frontend can understand the event activity shown in the
automation event screen.

### `GET /v1/webhooks/instagram`

Meta challenge verification. No session/cookies.

Query parameters:

| Parameter | Requirement |
| --- | --- |
| `hub.mode` | Must be `subscribe` |
| `hub.verify_token` | Must match backend configuration |
| `hub.challenge` | Returned as plain text |

Success returns `200 text/plain` with the challenge. Failure returns:

```http
403 Forbidden
```

```json
{
  "code": "WEBHOOK_VERIFICATION_FAILED",
  "message": "Verification failed"
}
```

### `POST /v1/webhooks/instagram`

No browser session or CSRF. Requires:

```http
x-hub-signature-256: sha256=<64 hexadecimal characters>
```

The signature is HMAC-SHA256 over the exact raw request body using the Meta app
secret. The API returns:

```http
200 OK
```

```json
{
  "received": true
}
```

Invalid signature:

```http
401 Unauthorized
```

```json
{
  "code": "INVALID_SIGNATURE",
  "message": "Invalid webhook signature"
}
```

Invalid JSON or top-level payload:

```http
400 Bad Request
```

```json
{
  "code": "INVALID_PAYLOAD",
  "message": "Invalid webhook payload"
}
```

The backend stores the event and attempts Redis/BullMQ dispatch. A durable
PostgreSQL outbox allows worker retry if immediate Redis dispatch fails. Duplicate
payloads are protected by payload hash and trigger idempotency.

### Supported comment payload concept

The worker recognizes comment changes shaped approximately as:

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "local-ig-account",
      "time": 1700000000,
      "changes": [
        {
          "field": "comments",
          "value": {
            "id": "comment-id",
            "text": "guide please",
            "from": {
              "id": "commenter-id",
              "username": "commenter"
            },
            "media": {
              "id": "media-id"
            },
            "parent_id": "optional-parent-comment-id"
          }
        }
      ]
    }
  ]
}
```

Unknown changes are accepted by the broad parser but ignored by the current
worker. Comment replies with `parent_id` are recorded as `NOT_TOP_LEVEL`.

### Matching order

For each live automation:

1. Reject if the automation is not live.
2. Check exclusions.
3. Check keyword rules.
4. Record the first matching keyword as `queued`.

Supported modes:

- `contains`
- `exact`
- `starts_with`
- `regex`

Non-case-sensitive matching normalizes Unicode, case, punctuation/symbols,
whitespace, and trimming. Invalid regex patterns currently produce no match
rather than a frontend-visible validation error.

## 9. Seed data for frontend development

Run from `C:\Drive-D\dmlinkProject\node_code`:

```bash
npm run db:migrate
npm run db:seed
```

The seed is repeatable and creates/updates:

| Record | Value |
| --- | --- |
| Workspace ID | `11111111-1111-4111-8111-111111111111` |
| User ID | `22222222-2222-4222-8222-222222222222` |
| User email | `developer@example.local` |
| User password | `local-development-password` |
| Role | `owner` |
| Instagram account ID | `33333333-3333-4333-8333-333333333333` |
| Instagram user ID | `local-ig-account` |
| Instagram username | `local_account` |
| Automation ID | `44444444-4444-4444-8444-444444444444` |
| Automation name | `Local guide automation` |
| Automation status | `live` |
| Keyword | `guide` / `contains` |

No real Instagram access token is seeded. The seeded account is a local test
account, not a connected Meta account.

## 10. Recommended frontend API client

The frontend should centralize transport behavior instead of calling `fetch`
directly throughout components.

### Suggested types

```ts
type ApiError = {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
  requestId?: string;
};

type ApiResponse<T> = { data: T };

type AuthUser = {
  id: string;
  email: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
};

type InstagramAccount = {
  id: string;
  workspaceId: string;
  igUserId: string;
  username: string;
  accountType: string | null;
  profilePictureUrl: string | null;
  permissions: string[];
  status: 'active' | 'needs_reauth' | 'disconnected' | string;
  tokenExpiresAt: string | null;
};

type KeywordRule = {
  value: string;
  mode: 'contains' | 'exact' | 'starts_with' | 'regex';
  caseSensitive: boolean;
};

type AutomationSettings = {
  exclusions?: KeywordRule[];
  dailyCap: number | null;
  schedule: {
    timezone: string;
    startHour: number;
    endHour: number;
  };
};

type TriggerEvent = {
  id: string;
  ig_account_id: string;
  automation_id: string;
  comment_id: string;
  comment_text: string | null;
  matched_keyword: string | null;
  outcome: 'sent' | 'skipped' | 'failed' | 'queued';
  reason_code: string | null;
  attempts: number;
  created_at: string;
  sent_at: string | null;
};
```

The `Automation` response type should initially model the raw snake_case
response or be normalized immediately in the API client. Do not mix raw and
normalized naming in UI components.

### Suggested request helper

```ts
async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers
    }
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw body satisfies ApiError;
  }
  return body as T;
}
```

For mutations, add the CSRF header in one helper:

```ts
function csrfHeaders(): HeadersInit {
  return {
    'x-csrf-token': readCookie('csrf_token') ?? ''
  };
}
```

### Suggested API client methods

```ts
const authApi = {
  signupRequestOtp: (email: string) =>
    apiRequest<ApiResponse<{ accepted: boolean }>>('/v1/auth/signup/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),
  signupVerifyOtp: (email: string, otp: string) =>
    apiRequest<ApiResponse<{ verificationToken: string }>>('/v1/auth/signup/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    }),
  signupComplete: (verificationToken: string, password: string, workspaceName?: string) =>
    apiRequest<ApiResponse<AuthUser>>('/v1/auth/signup/complete', {
      method: 'POST',
      body: JSON.stringify({ verificationToken, password, ...(workspaceName ? { workspaceName } : {}) })
    }),
  signup: (input: SignupInput) =>
    apiRequest<ApiResponse<AuthUser>>('/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  login: (input: LoginInput) =>
    apiRequest<ApiResponse<AuthUser>>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  me: () => apiRequest<ApiResponse<AuthUser>>('/v1/auth/me'),
  logout: () =>
    apiRequest<ApiResponse<{ loggedOut: boolean }>>('/v1/auth/logout', {
      method: 'POST'
    }),
  requestReset: (email: string) =>
    apiRequest<ApiResponse<{ accepted: boolean }>>('/v1/auth/reset/request', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),
  confirmReset: (token: string, password: string) =>
    apiRequest<ApiResponse<{ reset: boolean }>>('/v1/auth/reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, password })
    })
};

const workspaceApi = {
  accounts: () =>
    apiRequest<ApiResponse<InstagramAccount[]>>('/v1/ig-accounts'),
  automations: () =>
    apiRequest<ApiResponse<unknown[]>>('/v1/automations'),
  automation: (id: string) =>
    apiRequest<ApiResponse<unknown>>(`/v1/automations/${id}`),
  events: (id: string) =>
    apiRequest<ApiResponse<TriggerEvent[]>>(`/v1/automations/${id}/events`),
  createAutomation: (input: AutomationCreateInput) =>
    apiRequest<ApiResponse<unknown>>('/v1/automations', {
      method: 'POST',
      headers: csrfHeaders(),
      body: JSON.stringify(input)
    }),
  setAutomationStatus: (id: string, action: 'publish' | 'pause' | 'resume') =>
    apiRequest<ApiResponse<unknown>>(`/v1/automations/${id}/${action}`, {
      method: 'POST',
      headers: csrfHeaders()
    })
};
```

## 11. Frontend screen-to-API mapping

| Frontend screen/feature | API calls |
| --- | --- |
| App boot/auth restore | `GET /v1/auth/me` |
| Login | `POST /v1/auth/login` |
| Signup/onboarding | `POST /v1/auth/signup/request-otp` → `POST /v1/auth/signup/verify-otp` → `POST /v1/auth/signup/complete` |
| Logout menu | `POST /v1/auth/logout` |
| Forgot password request | `POST /v1/auth/reset/request` |
| Reset password page | `POST /v1/auth/reset/confirm` |
| Connected accounts list | `GET /v1/ig-accounts` |
| Connect Instagram button | Browser navigation to `GET /v1/auth/instagram/start` |
| OAuth result page | Current callback JSON at `GET /v1/auth/instagram/callback` |
| Automation list | `GET /v1/automations` |
| Automation detail/edit read | `GET /v1/automations/:id` |
| Create automation | `POST /v1/automations` + CSRF |
| Publish/pause/resume control | Status action endpoint + CSRF |
| Automation activity | `GET /v1/automations/:id/events` |
| Local webhook test | `npm run webhook:smoke` outside the frontend |

## 12. Example frontend user journeys

### First app load

```text
Loading -> GET /v1/auth/me
  200 -> store user and load accounts/automations
  401 -> clear session state and show login
  5xx -> show retryable connection error
```

### Signup

```text
Signup email -> POST /v1/auth/signup/request-otp
  202 -> show generic “If eligible, a code was sent” state
OTP form -> POST /v1/auth/signup/verify-otp
  200 -> keep verificationToken in memory and show password/workspace form
Signup completion -> POST /v1/auth/signup/complete
  201 -> browser has session + csrf_token cookies; show workspace app
  400 -> render validation/invalid-code errors
  409 -> show email already registered
```

### Login

```text
Login form -> POST /v1/auth/login
  200 -> store returned user in memory and load dashboard
  401 -> show generic invalid credentials message
  400 -> render field errors
```

### Create automation

```text
Automation form -> validate client-side -> POST /v1/automations
  credentials: include
  x-csrf-token: csrf_token cookie
  201 -> normalize returned snake_case row and show draft
  400 -> show field errors
  403 -> refresh auth/CSRF state and retry once or show session error
  404 -> selected account is unavailable
```

### Connect Instagram

```text
Connect button -> browser navigation to /v1/auth/instagram/start
  302 -> Instagram authorization page
  callback success -> backend currently returns account JSON directly
  callback error -> render code/message and offer retry
```

## 13. Development verification checklist

Start the backend API and worker first. Then use the seeded account and user to
verify the frontend integration:

```powershell
Set-Location C:\Drive-D\dmlinkProject\node_code
npm run db:migrate
npm run db:seed
npm run dev
```

In a second terminal:

```powershell
Set-Location C:\Drive-D\dmlinkProject\node_code
npm run dev:worker
```

Basic checks:

```bash
curl --fail-with-body http://127.0.0.1:3000/health
redis-cli -h 127.0.0.1 -p 6379 ping
```

The signed local webhook smoke test is:

```bash
npm run webhook:smoke
```

Then request the seeded automation events endpoint with an authenticated cookie
session. Expected matching result:

```text
outcome: queued
matched_keyword: guide
```

Send the same smoke webhook again and confirm that a duplicate trigger event is
not created.

## 14. Current limitations and frontend planning gaps

1. **Real message sending is not implemented.** Do not show `queued` as “DM
   sent.” Use labels such as “Matched” or “Queued for processing.”
2. **OAuth is provisional.** Real Meta credentials and API contract confirmation
   are required.
3. **OAuth callback does not redirect to the frontend.** A frontend callback
   experience needs a backend contract decision.
4. **Password reset email delivery is not implemented.** The request endpoint is
   only a persistence placeholder.
5. **Role policy is enforced on current resources.** Viewer is read-only;
   account connection/replay require Owner/Admin. Broader membership/audit work
   is still incomplete.
6. **No workspace switcher.** Login selects one membership by role priority; the
   backend has no workspace-selection endpoint.
7. **No pagination/filtering.** Lists may grow without cursor support.
8. **No OpenAPI/client package.** Keep API types in one frontend adapter until a
   shared contract is introduced.
9. **Naming mismatch.** Automation response data is snake_case while requests and
   auth/account responses are camelCase.
10. **Stored settings are not fully enforced.** Daily cap, schedule, public reply,
    and flow fields are not yet a complete sending implementation.
11. **Health is liveness only.** Use `/ready` for PostgreSQL/Redis readiness;
    it returns 503 when either dependency is unavailable or times out.
12. **No account reconnect/disconnect/refresh UI contract exists yet.**

## 15. Backend/frontend coordination decisions needed

Before building production UI around the following, confirm with the backend and
product owner:

- Whether the API should redirect OAuth callbacks to a frontend route.
- Whether automation responses should be changed to camelCase or the frontend
  adapter should own normalization permanently.
- The final role permissions for owner/admin/editor/viewer.
- The final workspace switching/membership model.
- Pagination/filter/sort requirements for automation and event lists.
- The final Meta API product path, scopes, account lifecycle, and messaging rules.
- Which capabilities are MVP versus V2: inbox, teams, flows, analytics, billing,
  notifications, and publishing.

## 16. Source files for contract questions

| Concern | Backend source |
| --- | --- |
| Route paths/status/errors | `backend/src/routes.ts` |
| Session/password/reset behavior | `backend/src/auth.ts` |
| Request automation schema | `backend/src/domain/automation.ts` |
| Keyword matching | `backend/src/domain/keyword-matcher.ts` |
| Database response shapes | `backend/src/db.ts` |
| Instagram OAuth | `backend/src/instagram/oauth.ts` |
| Webhook payload parsing | `backend/src/instagram/webhook.ts` |
| HMAC signature rules | `backend/src/instagram/signature.ts` |
| Seed IDs/data | `backend/scripts/seed.ts` |
| Runtime setup | `node_code/README.md` and `node_code/INSTALL_PREREQUISITES.md` |
| Detailed future backlog | `backend/devResource/BACKEND-PENDING-TASKS.md` |

When this document and source code disagree, treat the source and live tests as
authoritative and update this mapping as part of the API change.
