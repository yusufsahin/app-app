# Rotating SCM and deploy webhook secrets

ALM stores GitHub, GitLab, Azure DevOps SCM tokens, and the deploy webhook secret in **project settings**. Values are never returned by the API after save.

## Recommended order (no double-secret support yet)

1. **Generate** a new random secret (for example 32+ bytes, URL-safe).
2. **Save** the new value in ALM under **Project → Integrations** (replace the field and save). Until step 3 completes, deliveries still using the **old** secret will fail authentication.
3. **Update** the provider immediately after save:
   - **GitHub** — repository or organization webhook “Secret”.
   - **GitLab** — webhook “Secret token”.
   - **Azure DevOps** — Service Hook custom header `X-ALM-AzureDevOps-Token`.
   - **Deploy CI** — pipeline variables / GitHub Actions secrets matching `ALM_DEPLOY_WEBHOOK_SECRET` (or your chosen name).
4. **Smoke-test** with a no-op push or a manual `curl` using the new secret (Integrations card shows signing examples).
5. If you previously leaked or lost the old secret, no extra step is required in ALM once the provider uses the new value.

## Reducing downtime

Schedule rotation in a quiet window and perform steps 2 and 3 within minutes. If you need **zero** failed deliveries, coordinate a short freeze on merges/pushes or accept brief `401`/`404` responses until both sides match.

## Vault and external secret managers

This repository does not sync ALM settings from HashiCorp Vault or cloud secret stores automatically. If you use an external manager, treat ALM as the **consumer**: your automation should PATCH project settings with the current active secret after rotation in the vault.
