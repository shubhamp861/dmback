# Meta / Instagram Integration Contract

## Purpose

This document records the Meta integration assumptions used by the first OAuth
implementation. It must be reviewed against the current Meta developer
documentation and a real staging app before production use.

## Verification status

**Status:** provisional implementation; staging verification pending.

On 2026-10-11, the official Meta developer documentation URLs were requested
from the development environment, but the documentation service returned HTTP
400/404 responses for the relevant pages. No Meta app credentials or staging
Instagram account are available in this repository, so the account connection
cannot yet be verified end to end.

The code therefore pins all changeable integration values in environment
configuration and exposes stable internal errors. Before enabling a real app,
the owner must confirm the items in the verification checklist below directly
in Meta's current documentation and app dashboard.

## Current implementation assumptions

### Login flow

The initial implementation uses the Instagram Login authorization flow:

1. Authenticated user requests `GET /v1/auth/instagram/start`.
2. Backend creates a random, single-use state bound to the current session,
   user, workspace, redirect URI, and ten-minute expiry.
3. Backend redirects to:

   `https://www.instagram.com/oauth/authorize`

4. Callback is:

   `GET /v1/auth/instagram/callback`

5. Backend exchanges the authorization code at:

   `https://api.instagram.com/oauth/access_token`

6. Backend exchanges the short-lived token for a long-lived token at the
   configured Graph URL and fetches account profile fields.
7. Backend accepts only professional account types, encrypts the token, and
   stores the Instagram account in the authenticated workspace.

### Configured defaults

These values are in `.env.example` and can be changed without code changes:

```dotenv
META_API_VERSION=v23.0
META_GRAPH_BASE_URL=https://graph.instagram.com
META_OAUTH_BASE_URL=https://api.instagram.com
META_REDIRECT_URI=http://localhost:3000/v1/auth/instagram/callback
META_INSTAGRAM_SCOPES=instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages
```

The API version and scopes are **not approved production decisions** until the
Meta app dashboard and current documentation confirm them.

### Profile request currently used

```text
GET https://graph.instagram.com/{META_API_VERSION}/me
  ?fields=user_id,username,account_type,profile_picture_url
  &access_token={long_lived_token}
```

The code accepts `user_id` and has a compatibility fallback for `id`. It accepts
`BUSINESS`, `CREATOR`, `MEDIA_CREATOR`, and `PROFESSIONAL` as professional
account-type values until the actual response contract is confirmed.

### Token storage

The current local implementation encrypts the long-lived token using AES-256-GCM
with `TOKEN_ENCRYPTION_KEY` and stores ciphertext in `ig_accounts.token_ciphertext`.
The key is a local configuration key and is not a KMS envelope-encryption
implementation. Production must replace this with a KMS-backed data key per row,
key versioning, rotation, and access audit.

## Implemented endpoints

| Method | Endpoint | Behaviour |
| --- | --- | --- |
| GET | `/v1/auth/instagram/start` | Requires login; creates state and redirects to Instagram authorization |
| GET | `/v1/auth/instagram/callback` | Requires the same login session; validates one-time state, exchanges token, loads profile, stores account |
| GET | `/v1/ig-accounts` | Lists connected accounts in the current workspace without token material |

The callback returns stable internal errors including:

- `META_CONFIG_MISSING`
- `INVALID_OAUTH_STATE`
- `META_TOKEN_EXCHANGE_FAILED`
- `META_PROFILE_FAILED`
- `INSTAGRAM_ACCOUNT_TYPE_REQUIRED`
- `INSTAGRAM_ACCOUNT_ALREADY_CONNECTED`

## Verification checklist before staging

- [ ] Confirm the current Instagram product path and whether Instagram Login or
  another Meta product path is required for the target account type.
- [ ] Confirm current Graph API version and support/retirement date.
- [ ] Confirm authorization URL, token exchange URL, long-lived-token URL, and
  required HTTP methods.
- [ ] Confirm exact permission names for basic profile, comments, messaging,
  content publishing, and insights.
- [ ] Confirm whether `instagram_business_basic` and the two manage scopes are
  available to this app and target account.
- [ ] Confirm profile field names and account-type values.
- [ ] Confirm token expiry and refresh rules, including whether long-lived tokens
  can be refreshed and the refresh window.
- [ ] Confirm webhook subscription fields and subscription endpoint for the chosen
  product path.
- [ ] Confirm comment and messaging endpoint paths, recipient format, messaging
  windows, and per-account/app limits.
- [ ] Confirm error payload shape and codes for expired token, rate limit,
  deleted comment, user unreachable, policy rejection, and account restriction.
- [ ] Confirm Meta app review/business verification requirements.
- [ ] Run the complete flow with a real staging professional Instagram account.

## Next Meta implementation work

1. Add a staging `.env` with the confirmed app ID, app secret, redirect URI,
   verified scopes, and API version.
2. Run OAuth start/callback against the staging app.
3. Verify the returned profile and account type against database values.
4. Replace local AES key storage with KMS envelope encryption before production.
5. Add account reconnect/disconnect and token refresh.
6. Subscribe the connected account to confirmed webhook fields.
7. Implement a typed Meta API client shared by media sync, comments, and sending.
8. Add contract tests using recorded/redacted staging responses.

## Security requirements

- Never log authorization codes, access tokens, refresh tokens, or full callback
  query strings.
- Keep OAuth state single-use, short-lived, session-bound, and workspace-bound.
- Store token ciphertext only; never expose it from `/v1/ig-accounts`.
- Keep Meta secrets in the secret manager in staging/production.
- Rotate encryption keys and support decrypting old key versions during rotation.
- Revoke/pause account automations after token invalidation or deauthorization.
