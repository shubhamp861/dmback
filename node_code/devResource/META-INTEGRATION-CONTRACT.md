# Meta / Instagram Integration Contract

## Purpose

This document records the Meta integration assumptions used by the first OAuth
implementation. It must be reviewed against the current Meta developer
documentation and a real staging app before production use.

## Verification status

**Status:** public documentation confirmed on 2026-10-24; app-dashboard access,
scope availability, and staging verification are still pending.

On 2026-10-11, the official Meta developer documentation URLs returned HTTP
400/404 in the development environment. On 2026-10-24 the relevant pages were
retrieved successfully; results are recorded below. No Meta app credentials or
staging Instagram account are available in this repository, so the account
connection cannot yet be verified end to end.

The code pins all changeable integration values in environment configuration
and exposes stable internal errors. Before enabling a real app, the owner must
confirm the remaining dashboard-dependent items in the verification checklist
below.

## Confirmed contract — 2026-10-24

Sources (Meta for Developers):

- Instagram API with Instagram Login:
  https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login
- Business Login for Instagram:
  https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
- Get started:
  https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started
- Instagram webhooks:
  https://developers.facebook.com/documentation/instagram-platform/webhooks
- Webhook fields:
  https://developers.facebook.com/documentation/instagram-platform/webhooks/fields
- Webhook examples:
  https://developers.facebook.com/documentation/instagram-platform/webhooks/examples
- Private replies:
  https://developers.facebook.com/documentation/instagram-platform/private-replies
- Comment replies:
  https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-comment/replies
- IG User reference:
  https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user
- Messaging API:
  https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api
- Rate limits:
  https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
- Graph API changelog:
  https://developers.facebook.com/docs/graph-api/changelog/
- Instagram Platform error codes:
  https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/error-codes
- Messenger Platform error codes:
  https://developers.facebook.com/documentation/business-messaging/messenger-platform/error-codes
- Messaging policy:
  https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy
- App review:
  https://developers.facebook.com/documentation/instagram-platform/app-review

### Product path and version

| Item | Confirmed value |
| --- | --- |
| Product path | Instagram API with Instagram Login (Business Login for Instagram) |
| Account types | Instagram professional accounts: Business and Creator |
| Facebook Page | Not required for this path |
| Graph API version | v26.0 released 2026-07-29 (latest in the changelog); v23.0 expires 2027-10-08 |

### Permissions

Path A scopes (exact names):

- `instagram_business_basic`
- `instagram_business_manage_comments`
- `instagram_business_manage_messages`
- `instagram_business_content_publish`
- `instagram_business_manage_insights`

MVP (comment to DM) needs only `instagram_business_basic`,
`instagram_business_manage_comments`, and
`instagram_business_manage_messages`.

Access levels: Standard Access needs no review but only works for accounts with
a role on the app. Advanced Access requires App Review (use case, screencast,
and one recorded API call). Going live also requires the app settings, Business
Verification, and permission requests in the App Dashboard.

### OAuth and tokens

| Step | Confirmed contract |
| --- | --- |
| Authorization | `GET https://www.instagram.com/oauth/authorize` with `client_id`, `redirect_uri`, `response_type=code`, `scope`, `state` |
| Code exchange | `POST https://api.instagram.com/oauth/access_token` (form encoded) |
| Long-lived exchange | `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token` |
| Long-lived lifetime | 60 days |
| Refresh | `GET https://graph.instagram.com/refresh_access_token`; token must be at least 24 hours old and unexpired; repeatable; returns a new 60-day token |
| Expiry | An expired long-lived token cannot be refreshed; the account must reconnect |

### Profile

`GET https://graph.instagram.com/{version}/me` with `user_id` and `username` is
the documented minimal request. The IG User reference lists `id`, `username`,
`profile_picture_url`, `followers_count`, `follows_count`, and `media_count`.
`account_type` appears in working examples but is not listed in the IG User
reference, so its return value must be verified on a staging account before the
OAuth flow depends on it.

### Webhooks

| Item | Confirmed value |
| --- | --- |
| Configuration | Callback URL and verify token in the App Dashboard; app-level subscription via `POST /{app-id}/subscriptions` |
| Comment fields | `comments`, `live_comments`, `mentions` (require `instagram_business_basic` + `instagram_business_manage_comments`) |
| Messaging fields | `messages`, `messaging_postbacks`, `messaging_seen`, `messaging_referral`, `message_reactions`, `message_echoes`, `standby`, `messaging_handover`, `messaging_optins`, `messaging_policy_enforcement`, `response_feedback` (require `instagram_business_manage_messages`) |
| Comment payload | `entry[].changes[].value` uses `comment_id` (not `id`), plus `text`, `from{id,username}`, `media{id,...}`, `parent_id` |
| Message payload | `entry[].messaging[]` with `sender`, `recipient`, `timestamp`, and `message{mid,text,...}` |

### Sending limits

| Capability | Confirmed rule |
| --- | --- |
| Public comment reply | `POST /{ig-comment-id}/replies?message=...`; only top-level comments; hidden comments and live-video comments cannot be replied to |
| Private reply | `POST /{ig-user-id}/messages` with `recipient.comment_id`; one reply per comment within 7 days; for Instagram Live, only during the broadcast |
| DM send | `POST /{ig-user-id}/messages`; text, media, stickers, reactions, templates, and posts |
| Messaging window | Standard 24 hours; Human Agent tag allows a separate 7-day period; ads conversations allow 7 days |
| Graph rate limit | 4800 × number of impressions calls per 24 hours per app + app-user pair; BUC usage headers such as `X-Business-Use-Case-Usage` |
| Messaging per-second limit | Not documented on the official pages reviewed; community reports of 100 calls/second for text and 10 calls/second for audio/video are unconfirmed |

### Error codes to classify

| Code / subcode | Meaning |
| --- | --- |
| `4`, `613-2534040` | Rate limit |
| `10-1404170`, `200` | Permission error |
| `190` | Invalid or expired access token |
| `200-1545041`, `551` | User unavailable / unreachable |
| `10-2534022`, `10-2018278` | Outside the allowed messaging window |
| `10-1893063`, `100-2534029` | Policy rejection |
| `100-2018001` | Recipient not found |
| `24` / `2207006` | Media not found |
| `25` / `2207050` | Instagram account restricted |

Error payloads should be logged by code and subcode only, never by echoing the
full Meta response into an HTTP response.

## Corrections required in this repository

1. **Dashboard scope mismatch (not a code issue).** The scopes supplied on
   2026-10-24 — `instagram_basic`, `instagram_manage_messages`,
   `instagram_manage_comments`, `instagram_manage_insights`,
   `instagram_content_publishing`, `pages_show_list`, `pages_read_engagement`,
   `pages_manage_metadata`, `business_management` — are Facebook Login scopes
   for Instagram API with Facebook Login. For path A the mapping is:
   `instagram_basic` → `instagram_business_basic`,
   `instagram_manage_comments` → `instagram_business_manage_comments`,
   `instagram_manage_messages` → `instagram_business_manage_messages`,
   `instagram_content_publishing` → `instagram_business_content_publish`,
   `instagram_manage_insights` → `instagram_business_manage_insights`.
   The `pages_*` and `business_management` scopes are not used by path A.
2. **Webhook comment parser.** `src/instagram/webhook.ts` requires
   `value.id`, but the documented Instagram Login comment event uses
   `value.comment_id`. As written, every comment event fails validation and is
   skipped. Accept `comment_id` first with `id` as a fallback, and add a payload
   regression test.
3. **API version (resolved 2026-10-24).** The config default, env templates,
   `README.md`, bootstrap scripts, and this document now use `v26.0`. Keep
   `v25.0` as a fallback only if the app rejects `v26.0`.
4. **`account_type` dependency.** OAuth completion rejects any profile without
   `account_type`. Confirm it on staging; if it is absent, store it only when
   present and determine professional status from the successful `/me` response.

## Current implementation assumptions

### Login flow

The initial implementation uses the Instagram Login authorization flow:

1. Authenticated user requests `GET /v1/auth/instagram/start`.
2. Backend creates a random, single-use state bound to the current session,
   user, workspace, redirect URI, and ten-minute expiry.
3. Backend redirects to:

   `https://www.instagram.com/oauth/authorize`

4. Callback is:

   `GET /v1/auth/instagram/relay` when the registered redirect URI is the HTTPS
   tunnel used for local development, which then redirects the browser to
   `GET /v1/auth/instagram/callback` on `http://localhost`. Hosted deployments
   register the callback URI directly.

5. Backend exchanges the authorization code at:

   `https://api.instagram.com/oauth/access_token`

6. Backend exchanges the short-lived token for a long-lived token at the
   configured Graph URL and fetches account profile fields.
7. Backend accepts only professional account types, encrypts the token, and
   stores the Instagram account in the authenticated workspace.

### Local development redirect (confirmed 2026-10-24)

Instagram business login rejects `http://` redirect URIs in the App Dashboard —
saving `http://localhost:3000/v1/auth/instagram/callback` fails with "Error
saving redirect URIs", and authorizing with it fails with `Invalid redirect_uri`.
The Facebook Login auto-allowance for localhost does not apply here.

Local development therefore runs the API behind a temporary HTTPS tunnel and
registers `https://<tunnel-host>/v1/auth/instagram/relay` as the OAuth redirect
URI, with `META_REDIRECT_URI` set to the same value. The relay is the only
publicly reachable Instagram OAuth route; it forwards `code`, `state`, and the
optional `error` parameters to the loopback callback, which keeps requiring the
session cookie and owns the token exchange.

Free keyless tunnels (localhost.run, Cloudflare quick tunnels) assign a new
random host on every reconnect, so both the dashboard entry and `META_REDIRECT_URI`
must be updated whenever the tunnel is restarted. A stable host requires an
account-bound tunnel domain or a deployed origin.

### Configured defaults

These values are in `.env.example` and can be changed without code changes:

```dotenv
META_API_VERSION=v26.0
META_GRAPH_BASE_URL=https://graph.instagram.com
META_OAUTH_BASE_URL=https://api.instagram.com
META_REDIRECT_URI=http://localhost:3000/v1/auth/instagram/callback
META_INSTAGRAM_SCOPES=instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages
```

The localhost default only works against the stub credentials in `.env.example`.
With real Meta app credentials it must be replaced by the HTTPS relay value
described above.

The API version and scopes were confirmed against current Meta documentation on
2026-10-24. The app dashboard must still confirm that this specific app has the
scopes available for the chosen use case.

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
| GET | `/v1/auth/instagram/relay` | Public HTTPS tunnel landing route; forwards the OAuth query to the loopback callback |
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
