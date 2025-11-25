# Identity, Authorization & Payments

## Goals

1. Seamless onboarding using WhatsApp API flow message.
2. Reliably map each incoming WhatsApp message to a unique user.
3. Enforce per-user feature/usage limits based on **ledgered usage**, not mutable counters (except storage, which is derived from the `resource` table).
4. Offer paid tiers using Meta/WhatsApp Pay.

_No password storage required; WhatsApp itself authenticates the sender._

## Entitlements

Entitlements control what each user can do and how much they can consume. They are split into boolean feature flags and numeric quotas.

### Boolean (feature flags)

- `b_enable_profile_tool`
- `b_enable_file_ingestion`
- `b_enable_file_storage_retrieval`
- `b_enable_web_fetch_tool`
- `b_enable_memory_tool`
- `b_enable_web_search_tool`
- `b_enable_google_places_tool`

### Numeric (quotas)

All numeric entitlements are expressed as **absolute usage counts** (or bytes), never as abstract cost units.

- `n_messages_per_day` – max WhatsApp messages handled per user per calendar day.
- `n_storage_size` – max total stored bytes for that user (lifetime, not per day).
- `n_web_search_calls_per_day` – max web search tool invocations per day.
- `n_google_places_calls_per_day` – max Google Places tool invocations per day.

Notes:

- "Per day" means a calendar day in a chosen reference timezone (e.g. UTC or a Brazil‑specific timezone). This must be consistent and documented.
- "Unlimited" (∞) is represented as **NULL** for numeric values at the plan/override level. Enforcement skips checks when the resolved entitlement is NULL.
- **Daily** limits (`*_per_day`) are enforced against **absolute counts recorded in a ledger table** over the appropriate time window.
- **Storage** limit (`n_storage_size`) is enforced by computing current usage from the canonical `resource` table (not from the ledger).

---

## Data Model

### Canonical tables

`plan`: definition of a product plan (Free, Basic, Pro, etc.)

- `id` (PK)
- `key` (unique, short identifier: `free`, `basic`, `pro`)
- `active` (boolean)
- `metadata` (JSON) for pricing, display name, description, etc.

`user_plan`: current plan for a given user (simple 1:1 for now)

- `user_id` (PK, FK → `user.id`)
- `plan_id` (FK → `plan.id`)

> This keeps the model simple: one active plan per user. If we ever need full subscription history, we can introduce a dedicated `subscription` table and make `user_plan` a view.

`plan_entitlement`: default entitlements per plan

- `plan_id` (FK → `plan.id`)
- `key` (text; one of the entitlement keys, enforced at app level by a union type)
- `value` (text), interpreted as:
  - boolean: `'true'` / `'false'`
  - numeric: integer as text, or `NULL` to mean "unlimited"
- PK: (`plan_id`, `key`)

`user_entitlement_overrides`: per‑user overrides of plan defaults

- `user_id` (FK → `user.id`)
- `key` (same as in `plan_entitlement`)
- `value` (text; same semantics as in `plan_entitlement`)
- `notes` (text; why this override exists — support concession, promo, debug, etc.)
- `updated_at` (timestamp)
- PK: (`user_id`, `key`)

> **Precedence** when resolving an entitlement:
>
> 1. `user_entitlement_overrides` (highest priority)
> 2. `plan_entitlement` for the user's current plan
>
> Plan entitlements must be asserted at server startup. For numeric limits, a resolved value of `NULL` means "unlimited" and disables enforcement for that key.

`usage_ledger`: append‑only record of usage and credits per user & key (for **daily** quotas only)

- `id` (PK)
- `user_id` (FK → `user.id`)
- `key` (text; corresponds to a **daily numeric** entitlement, e.g. `n_messages_per_day`, `n_web_search_calls_per_day`, `n_google_places_calls_per_day`)
- `value` (integer)
  - Negative: usage / consumption (e.g. `-1` message).
  - Positive: credits / add‑ons / corrections (e.g. `+100` extra web search calls).
- `timestamp` (when the usage or credit occurred)
- `source` (enum/text: `usage`, `manual_credit`, `meta_pay_addon`, `correction`, etc.)
- `metadata` (JSON; optional, for audit/debug details)

> **Important:** `n_storage_size` is **not** tracked in `usage_ledger`. Storage usage is derived from the `resource` table.

Indexes:

- `btree (user_id, key, timestamp)` — efficient aggregation of usage for a given user/key over a time window.
- optional: `btree (key, timestamp)` for global reporting/analytics.

### Entitlement resolution (logical API)

We define a logical function (implemented in application code, not necessarily in SQL):

```ts
resolveEntitlement(userId: string, key: string): ResolvedEntitlement
// Returns either a boolean or numeric value, or null for unlimited numerics.
```

Algorithm:

1. Look up `user_entitlement_overrides` for (`userId`, `key`).

   - If found, parse `value` as boolean or numeric and return.

2. Otherwise, join `user_plan` → `plan_entitlement` to find (`plan_id`, `key`).

   - If found, parse `value` and return.

3. Otherwise, fail fast (misconfigured plan catalogue) — for safety, do **not** fall back silently.

4. For numeric quotas, a resolved value of `NULL` means "unlimited".

## System prompt

There should be a **system prompt** for each plan so the model knows its capabilities.

## Usage Ledger & Derived Views (daily metrics)

`usage_ledger` is the **single source of truth** for consumption and quota credits/add‑ons for **daily** metrics:

- Every operation that consumes a daily quota writes a **negative** row.
- Every manual or purchased boost writes a **positive** row.
- We never "reset counters" by updating rows; we only add new rows.

Application and reporting code derive "current state" by aggregating ledger rows over the relevant time window.

### Helper view: daily usage

For per‑day metrics (`n_messages_per_day`, `n_web_search_calls_per_day`, `n_google_places_calls_per_day`), we aggregate per user, key and calendar day.

```sql
CREATE VIEW v_daily_usage AS
SELECT
  user_id,
  key,
  date_trunc('day', "timestamp") AS day,
  -- Total usage (positive number)
  COALESCE(-SUM(CASE WHEN value < 0 THEN value ELSE 0 END), 0) AS used,
  -- Total credits/add-ons (positive number)
  COALESCE(SUM(CASE WHEN value > 0 THEN value ELSE 0 END), 0) AS credits
FROM usage_ledger
GROUP BY user_id, key, date_trunc('day', "timestamp");
```

### View: remaining daily usage per user & key

We then conceptually combine resolved entitlements with `v_daily_usage` to compute remaining quota.

```sql
-- Pseudo-code / reference: join resolved entitlements to daily usage
CREATE VIEW v_user_daily_remaining AS
SELECT
  u.id AS user_id,
  e.key,
  CURRENT_DATE AS day,
  e.limit_value AS limit,        -- NULL = unlimited
  du.used,
  du.credits,
  CASE
    WHEN e.limit_value IS NULL THEN NULL -- unlimited
    ELSE GREATEST(e.limit_value + COALESCE(du.credits, 0) - COALESCE(du.used, 0), 0)
  END AS remaining
FROM "user" u
CROSS JOIN LATERAL resolve_entitlements_for_user(u.id) AS e
LEFT JOIN v_daily_usage du
  ON du.user_id = u.id
 AND du.key = e.key
 AND du.day = date_trunc('day', now())
WHERE e.key IN (
  'n_messages_per_day',
  'n_web_search_calls_per_day',
  'n_google_places_calls_per_day'
);
```

In practice, `resolve_entitlements_for_user` may live in application code, with the app querying `v_daily_usage` and doing the final subtraction.

---

## Storage Usage (from `resource` table)

Storage usage is **not** tracked in the ledger. Instead, we rely on the existing `resource` table as the single source of truth:

- Each stored file/resource already has:
  - `user_id`.
  - `size_bytes` (or equivalent size field).
  - soft‑delete flag or status if applicable.

We derive per‑user storage usage by aggregating over `resource`:

```sql
CREATE VIEW v_user_storage_usage AS
SELECT
  user_id,
  COALESCE(SUM(size_bytes), 0) AS used_bytes
FROM resource
WHERE deleted_at IS NULL -- or equivalent soft-delete condition
GROUP BY user_id;
```

Enforcement compares, for each user:

- Resolved `n_storage_size` limit (bytes, possibly NULL for unlimited).
- vs `used_bytes` from `v_user_storage_usage`.

If `n_storage_size` is NULL, storage is effectively unlimited.

Add‑ons that increase storage capacity should be modeled as **persistent entitlement changes** (via `user_entitlement_overrides` or plan changes), not as ledger credits.

---

## Enforcement Middleware

Limits are enforced in a middleware that runs **after** we resolve the user from the incoming WhatsApp message and **before** we call the agent pipeline.

### Responsibilities

1. **Identify user**

   - Given the WhatsApp webhook payload, map to:
     - `user.id`.
     - ensure `user_plan` exists (default Free on first contact).
     - ensure consent / onboarding state is valid for usage.

2. **Resolve entitlements**

   - For the current `user.id`, resolve booleans and numeric entitlements using the precedence:
     - `user_entitlement_overrides` → `plan_entitlement`.

3. **Check quotas (pre‑usage)**

   - For the incoming message:

     - Check `n_messages_per_day` for this user using `usage_ledger` aggregates (e.g. via `v_daily_usage`).
     - If `remaining` is 0 and limit is not `NULL`, send a "daily message limit reached" response and short‑circuit.

   - For tools invoked by the model (tool layer):
     - `b_enable_*` decides if the tool is available at all.
     - Before calling external services:
       - Web search tool → check `n_web_search_calls_per_day` for this user.
       - Google Places tool → check `n_google_places_calls_per_day`.
     - Before storing new files/resources:
       - Compute `used_bytes` from `v_user_storage_usage` (or cached equivalent).
       - Resolve `n_storage_size` entitlement.
       - If limit is not `NULL` and `used_bytes + new_file_size > limit`, deny storage and inform the user.

4. **Record usage (post‑success)**

   - On each allowed **daily‑metered** operation, insert into `usage_ledger`:

     - Messages:

       ```sql
       INSERT INTO usage_ledger (user_id, key, value, source)
       VALUES ($1, 'n_messages_per_day', -1, 'usage');
       ```

     - Web search:

       ```sql
       INSERT INTO usage_ledger (user_id, key, value, source)
       VALUES ($1, 'n_web_search_calls_per_day', -1, 'usage');
       ```

     - Google Places:

       ```sql
       INSERT INTO usage_ledger (user_id, key, value, source)
       VALUES ($1, 'n_google_places_calls_per_day', -1, 'usage');
       ```

   - **Storage:** no ledger writes. Storage usage is implicitly updated when `resource` rows are created/updated/deleted.

## Onboarding, Identity & WhatsApp Mapping

### Identity

- WhatsApp is the **authentication provider**:

  - Each incoming message carries a WhatsApp user identifier (`wa_id`).
  - We treat (`wa_id`, phone number) as a globally unique identity for Zapid.

- `user` table should include at least:
  - `id` (PK).
  - `wa_id` (unique; required).
  - `phone_number`.
  - `locale`.
  - `onboarding_state` (enum: `new`, `consent_pending`, `active`, `blocked`).
  - `consent_version` (text).
  - `consent_accepted_at` (timestamp, nullable).
  - `joined_at`.

### Onboarding flow (via WhatsApp Flows)

Onboarding and consent are handled via [WhatsApp Flows](https://developers.facebook.com/docs/whatsapp/flows), a native UI for multi‑step interactions inside the WhatsApp client.

#### WhatsApp Flows overview

- Flows let us define screens with text, inputs, checkboxes, buttons, etc.
- The user completes the flow entirely inside WhatsApp (no external browser).
- On completion, our server receives a callback with structured response data (e.g. which checkboxes were ticked, form values).
- Flows are defined via JSON and registered with Meta; they can be triggered by sending an interactive message of type `flow`.

#### Onboarding flow design

We define a single **onboarding flow** with the following screens:

1. **Welcome screen**

   - Brief intro to Zapid (what it does, value prop).
   - "Continue" button.

2. **Terms & Privacy screen**

   - Summary of Terms of Service and Privacy Policy.
   - Links to full documents (hosted on our website).
   - Checkbox: "I have read and agree to the Terms of Service and Privacy Policy" (required).
   - "Accept & Continue" button (disabled until checkbox is checked).

3. **Confirmation screen**
   - "You're all set!" message.
   - Brief explanation of what happens next.
   - "Start chatting" button to close the flow.

#### Server‑side flow

1. **First incoming message from unknown `wa_id`**

   - Create a `user` row with:
     - `wa_id`, `phone_number` from webhook.
     - Infer `locale` from phone number country code.
     - `onboarding_state = 'consent_pending'`.
   - Attach default `user_plan` with `plan_id = Free`.
   - Send an interactive message of type `flow` to trigger the onboarding flow.
   - Do **not** process the user's original message yet; reply only with the flow.

2. **Flow completion callback**

   - When the user completes the flow, Meta sends a webhook with the flow response.
   - Extract consent data from the response (e.g. `terms_accepted: true`, `consent_version`).
   - If consent is granted:
     - Set `onboarding_state = 'active'`.
     - Record `consent_version` (flow version / document version) and `consent_accepted_at = now()`.
     - Set `joined_at = now()`.
     - Send a welcome message confirming activation.
   - If consent is declined (user dismisses the flow or unchecks required fields):
     - Set `onboarding_state = 'blocked'`.
     - Send a brief message explaining they cannot use the service without consent.

3. **Subsequent messages from `consent_pending` or `blocked` users**

   - If `onboarding_state = 'consent_pending'`:
     - Re‑send the onboarding flow (in case they dismissed it accidentally).
   - If `onboarding_state = 'blocked'`:
     - Send a message explaining they declined consent and how to restart if they change their mind.

4. **Normal usage**

   - For `onboarding_state = 'active'`, enforcement middleware applies entitlements & usage limits.
   - For other states, only serve onboarding or opt‑out flows; do not run the full agent pipeline.

#### Consent versioning

- Each time we update ToS or Privacy Policy, we increment `consent_version`.
- On significant policy changes, we may require re‑consent:
  - Check `user.consent_version` against the current required version.
  - If outdated, temporarily set `onboarding_state = 'consent_pending'` and re‑trigger the flow.
- Minor/non‑material changes may not require re‑consent (decision to be documented per release).

## Plans

Current high‑level product plan matrix (values to be finalized):

| Feature             | Free                                     | Basic                       | Pro                                 |
| ------------------- | ---------------------------------------- | --------------------------- | ----------------------------------- |
| **Model**           | GPT-5-mini (flex service, low verbosity) | GPT-5-mini (normal service) | Can choose model                    |
| **Messages**        | x/day                                    | 100x/day                    | ∞                                   |
| **Media Ingestion** | Audio/Voice                              | + Image, Document           | + Video                             |
| **Profile**         | ✓                                        | ✓                           | ✓                                   |
| **Web Fetch**       | ✓                                        | ✓                           | ✓                                   |
| **Memory**          | ✗                                        | ✓                           | ✓                                   |
| **File Storage**    | ✗                                        | Store and retrieve files    | External drive (Google Drive, etc.) |
| **Web Search**      | ✗                                        | ✓                           | ✓                                   |
| **Google Places**   | ✗                                        | ✓                           | ✓                                   |

These plan properties should be mapped concretely into `plan_entitlement` rows:

- Booleans via `b_enable_*` keys.
- Daily limits via `n_messages_per_day`, `n_web_search_calls_per_day`, `n_google_places_calls_per_day`.
- Storage limit via `n_storage_size` (enforced using `resource` aggregates).

---

## Payments (Meta/WhatsApp Pay) & Plan Changes

### Flow (one‑time upgrade / subscription‑like renewals)

1. User taps an "Upgrade" or "Renew" button in the chat.
2. Server sends a `payment_request` interactive message containing:
   - Plan identifier.
   - Amount.
   - Reference/order ID (idempotency key).
3. User confirms in‑chat; Meta returns a `payment_callback` to our webhook.
4. On successful callback:
   - Update `user_plan` for the `user_id`:
     - set `plan_id` to the new plan.
     - set `assigned_at = now()`.
     - optionally set `expires_at` if this is a time‑bounded plan.
   - Optionally grant add‑on credits into `usage_ledger` for daily metrics (e.g. welcome bonus rows for search).
   - Send confirmation message via WhatsApp.
   - Trigger invoice email (e.g. via Postmark).

> We do **not** physically reset usage counters by deleting rows. Daily quotas naturally "reset" because enforcement only considers `usage_ledger.timestamp >= start_of_day`. If we ever need to correct past usage, we insert a positive compensating row in the ledger.

## Decisions To Be Made

1. **Plan catalogue** – exact quotas & pricing.

   - Concrete values for:
     - `n_messages_per_day` by plan.
     - `n_web_search_calls_per_day` / `n_google_places_calls_per_day`.
     - `n_storage_size` (bytes or MB) by plan.
   - Confirm representation of "unlimited" as `NULL` in entitlements.

2. **Timezone & day boundary** for per-day limits.

   - Which timezone defines "today" for `*_per_day` metrics (UTC vs user locale vs fixed region timezone)?

3. **Retry strategy** – what if payment callback fails?

   - Make callback handler idempotent using the reference/order ID.
   - Implement a retry/backfill job that:
     - periodically reconciles statuses with Meta,
     - re-applies plan changes if a webhook was missed.

4. **Grace period** – how long until downgrade after failed renewal?

   - For subscription-like behavior:
     - use `user_plan.expires_at + N days` of grace.
     - enforcement uses the paid plan during grace but logs warnings.
