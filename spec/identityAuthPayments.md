# Identity, Authorization & Payments

## System prompt

There should be a **system prompt** for each plan so the model knows its capabilities.

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

> We do **not** physically reset usage counters by deleting rows. Daily quotas naturally "reset" because enforcement only considers `usage_ledger.timestamp >= (now() - interval '24 hours')`. If we ever need to correct past usage, we insert a negative compensating row in the ledger (if supported) or handle it via overrides.

## Decisions To Be Made

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
