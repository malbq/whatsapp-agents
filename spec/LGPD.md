# LGPD Implementation Guide for Developers

Use this checklist to bring your codebase into compliance with Brazil’s Lei Geral de Proteção de Dados (LGPD). Every item is phrased as an action that can be coded, lint-checked, or tested.

## 1. Data Governance Principles

- [ ] **Purpose limitation** – add a `purpose` field to every model and assert it at read/write time (`assert(data.purpose === expectedPurpose)`).
- [ ] **Adequacy & necessity** – validate payloads with Zod/TypeScript and `SELECT` only required columns.
- [ ] **Free data access** – on user message `my data`, compile JSON/CSV export and send as WhatsApp document (fallback: signed URL valid 24 h).
- [ ] **Data quality** – add `updatedAt` columns; schedule weekly cron `validateUserData()`; write immutable audit logs.
- [ ] **Transparency** – include one-time privacy notice in the assistant’s first reply; make `dpo` keyword return DPO contact info.
- [ ] **Non-discrimination** – run `evaluateFairness(modelOutput)` and persist decision logs.
- [ ] **Accountability** – log `actor`, `action`, `timestamp` to append-only `audit_log` table.

## 2. Legal Bases for Processing

- [ ] **Consent** – store `consent:boolean` & `consentTimestamp`; `POST /consent/revoke` hard-deletes or anonymizes data; log scope in `consent_log`.
- [ ] **Contract** – link records to `contractId`; run `cleanupContractData(contractId)` on contract end.
- [ ] **Legal obligation** – isolate mandatory processing in `legal/` module with comments referencing statutes.
- [ ] **Legitimate interest** – implement `assessLegitimateInterest(data, purpose): boolean` and store result.
- [ ] **Sensitive & children’s data** – flag with `isSensitive:boolean`; require double opt-in; store guardian consent for minors.

## 3. Data Subject Rights (WhatsApp Commands)

- [ ] **Confirmation** – reply to `using my data?` with `yes | no` plus short explanation.
- [ ] **Access** – reply to `my data` with export (JSON/CSV doc).
- [ ] **Correction** – parse messages like `update email to user@example.com`, validate, and patch record.
- [ ] **Deletion/Anonymization** – on `delete my data`, trigger purge workflow including backups; confirm when done.
- [ ] **Blocking** – on `block my data`, set `isBlocked` and halt processing until `unblock`.
- [ ] **Portability** – treat `my data csv` or `my data json` as format selector.
- [ ] **Consent revocation** – on `revoke consent`, purge or anonymize data; confirm.
- [ ] **Opposition** – on `I oppose X processing`, store preference and honor it.
- [ ] **Response SLA** – queue requests with `deadline`; cron `notifyDPO()` when nearing.

## 4. Security & Breach Response

- [ ] **Encryption** – AES-256 at rest; TLS 1.3 in transit.
- [ ] **Access control** – role-based checks in middleware.
- [ ] **Rate limiting** – enforce `60 requests/min/user` at gateway.
- [ ] **Pseudonymization** – replace direct identifiers with surrogate keys when possible.
- [ ] **Vulnerability management** – weekly `npm audit --production`; quarterly penetration test.
- [ ] **Breach notification** – script `notifyBreach()` emails ANPD & affected users within 24 h.

## 5. International Transfers

- [ ] **Adequacy check** – `assert(isAdequateCountry(destination))` before transfer.
- [ ] **Standard clauses** – store signed SCC/PBA in `transfer_agreements` table.
- [ ] **Transfer log** – insert into `transfer_log` (`purpose`, `legalBasis`, `dest`, `timestamp`).

## 6. DPO & Governance

- [ ] **DPO contact** – publish on `/privacy` and via `X-DPO-Contact` header.
- [ ] **Routing** – auto-forward rights requests to `dpo@company.com`.
- [ ] **DPIA** – run `npx dpia-cli scan src/` on high-risk modules and archive reports.

## 7. Implementation Toolkit

- [ ] **CI guardrails** – LGPD linter that forbids un-purposed processing.
- [ ] **Tests** – integration tests for each right; mock only AI providers.
- [ ] **Monitoring** – dashboard showing consent stats, purge jobs, transfer logs.
