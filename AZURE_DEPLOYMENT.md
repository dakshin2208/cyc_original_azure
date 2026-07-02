# Azure Deployment Guide — CYC Originals (Next.js 14, SSR)

Production deployment of this full-stack Next.js app to **Azure Container Apps (ACA)**,
with a passwordless (OIDC) **GitHub Actions** CI/CD pipeline that builds a Docker image,
pushes it to **Azure Container Registry (ACR)**, and rolls a new revision on every push
to `main`.

---

## 1. Architecture

```
GitHub (push to main)
   │
   ▼
GitHub Actions ──(OIDC, no stored password)──► Azure
   │  1. npm ci + lint
   │  2. docker build  (NEXT_PUBLIC_* baked in as build args)
   │  3. push image ──────────────────────────► Azure Container Registry
   │  4. az containerapp update --image <sha> ─► Azure Container Apps
   ▼
Azure Container Apps (Linux container, Next.js standalone server on :3000)
   ├── Supabase        (managed Postgres + Auth)      [external]
   ├── Razorpay        (payments)                     [external]
   └── Google Sheets/Drive APIs                       [external]
```

**Why Azure Container Apps?** The app is full-stack SSR (React Server Components,
27 Node.js API routes, a Server Action) — so Azure Static Web Apps and Azure Functions
are not a fit. `next.config.mjs` already sets `output: 'standalone'`, the container-optimized
Next.js target, making ACA the lowest-friction, highest-parity choice, with scale-to-zero
and revision-based rollouts. (Azure App Service Linux is a viable simpler alternative.)

---

## 2. Azure resources required

| Resource | Purpose | Example name |
|---|---|---|
| Resource Group | Container for all resources | `cyc-rg` |
| Azure Container Registry (ACR) | Stores the Docker image | `cycacr` (→ `cycacr.azurecr.io`) |
| Container Apps Environment | Managed environment (Log Analytics-backed) | `cyc-env` |
| Container App | Runs the app | `cyc-app` |
| Log Analytics Workspace | Logs/metrics (auto-created with the env) | `cyc-logs` |
| Microsoft Entra App Registration + Service Principal | OIDC identity for GitHub Actions | `cyc-github-oidc` |

> Supabase and Razorpay are **external managed services** — nothing to provision in Azure.

---

## 3. GitHub configuration

### 3a. Actions **Secrets** (`Settings → Secrets and variables → Actions → Secrets`)

| Secret | What it is |
|---|---|
| `AZURE_CLIENT_ID` | App Registration (client) ID for OIDC |
| `AZURE_TENANT_ID` | Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL *(build arg — public)* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key *(build arg — public)* |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay public key id *(build arg — public)* |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics id *(build arg — public)* |
| `NEXT_PUBLIC_SITE_URL` | Public site URL, e.g. `https://cyc-app.<region>.azurecontainerapps.io` *(build arg)* |

> The `NEXT_PUBLIC_*` values are stored as secrets for tidiness, but they are **public by design** — Next.js inlines them into the browser bundle. Real secrets never enter the image (see §5).

### 3b. Actions **Variables** (`… → Variables`)

| Variable | Example |
|---|---|
| `AZURE_RESOURCE_GROUP` | `cyc-rg` |
| `AZURE_CONTAINER_APP` | `cyc-app` |
| `ACR_NAME` | `cycacr` |

---

## 4. One-time bootstrap (Azure CLI)

Run locally with the Azure CLI (`az login` first). Adjust names/region as needed.

```bash
# ---- variables ----
export SUB_ID=$(az account show --query id -o tsv)
export RG=cyc-rg
export LOC=centralindia
export ACR=cycacr                 # must be globally unique, alphanumeric
export ENV=cyc-env
export APP=cyc-app
export GH_REPO="dakshin2208/cyc_original_azure"

# ---- core resources ----
az group create -n $RG -l $LOC

az acr create -n $ACR -g $RG --sku Basic

az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

az containerapp env create -n $ENV -g $RG -l $LOC

# ---- OIDC identity for GitHub Actions (no passwords stored) ----
az ad app create --display-name cyc-github-oidc
export APP_ID=$(az ad app list --display-name cyc-github-oidc --query "[0].appId" -o tsv)
az ad sp create --id $APP_ID

# Federated credentials: allow the main branch AND the manual (workflow_dispatch)
az ad app federated-credential create --id $APP_ID --parameters '{
  "name":"gh-main",
  "issuer":"https://token.actions.githubusercontent.com",
  "subject":"repo:'"$GH_REPO"':ref:refs/heads/main",
  "audiences":["api://AzureADTokenExchange"]
}'

# Role assignments: push images to ACR + manage the container app
export SP_OID=$(az ad sp show --id $APP_ID --query id -o tsv)
az role assignment create --assignee-object-id $SP_OID --assignee-principal-type ServicePrincipal \
  --role AcrPush --scope $(az acr show -n $ACR --query id -o tsv)
az role assignment create --assignee-object-id $SP_OID --assignee-principal-type ServicePrincipal \
  --role Contributor --scope /subscriptions/$SUB_ID/resourceGroups/$RG

# ---- create the Container App with an initial placeholder image ----
# (The pipeline will replace this image on the first deploy.)
az containerapp create \
  -n $APP -g $RG --environment $ENV \
  --image mcr.microsoft.com/k8se/quickstart:latest \
  --target-port 3000 --ingress external \
  --min-replicas 0 --max-replicas 3 \
  --cpu 0.5 --memory 1.0Gi

# ---- let the Container App pull from ACR via managed identity ----
az containerapp identity assign -n $APP -g $RG --system-assigned
export APP_MI=$(az containerapp identity show -n $APP -g $RG --query principalId -o tsv)
az role assignment create --assignee-object-id $APP_MI --assignee-principal-type ServicePrincipal \
  --role AcrPull --scope $(az acr show -n $ACR --query id -o tsv)
az containerapp registry set -n $APP -g $RG \
  --server $ACR.azurecr.io --identity system
```

### 4b. Runtime environment variables & secrets (server-side)

These are the values the **running container** reads (distinct from the build-time
`NEXT_PUBLIC_*` args). Set sensitive ones as ACA **secrets** and reference them.

```bash
# Sensitive -> ACA secrets
az containerapp secret set -n $APP -g $RG --secrets \
  supabase-service-role-key="<SUPABASE_SERVICE_ROLE_KEY>" \
  supabase-anon-key="<SUPABASE_ANON_KEY>" \
  razorpay-key-id="<RAZORPAY_KEY_ID>" \
  razorpay-key-secret="<RAZORPAY_KEY_SECRET>" \
  google-credentials='<GOOGLE_CREDENTIALS_JSON_STRING>'

# Env vars (plain + secretref). NEXT_PUBLIC_* are also read server-side at
# runtime (e.g. lib/supabase.ts), so set them here too.
az containerapp update -n $APP -g $RG --set-env-vars \
  NODE_ENV=production \
  SUPABASE_URL="<SUPABASE_URL>" \
  NEXT_PUBLIC_SUPABASE_URL="<...>" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="<...>" \
  NEXT_PUBLIC_RAZORPAY_KEY_ID="<...>" \
  NEXT_PUBLIC_GA_MEASUREMENT_ID="<...>" \
  NEXT_PUBLIC_SITE_URL="<...>" \
  GOOGLE_DRIVE_FOLDER_ID="<...>" \
  GOOGLE_SHEET_ID="<...>" \
  GOOGLE_VOTE_SHEET_ID="<...>" \
  SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role-key \
  SUPABASE_ANON_KEY=secretref:supabase-anon-key \
  RAZORPAY_KEY_ID=secretref:razorpay-key-id \
  RAZORPAY_KEY_SECRET=secretref:razorpay-key-secret \
  GOOGLE_CREDENTIALS=secretref:google-credentials
```

---

## 5. How secrets are handled (build-time vs runtime)

| Class | Examples | Where injected |
|---|---|---|
| **Public / build-time** (`NEXT_PUBLIC_*`) | Supabase URL & anon key, Razorpay key id, GA id, site URL | Docker **build args** (GitHub secrets) — inlined into the browser bundle. Public by design. |
| **Server-only / runtime** | `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `GOOGLE_CREDENTIALS`, ... | **ACA secrets**, referenced as env at runtime. **Never** baked into the image. |

---

## 6. Step-by-step deployment

1. Run the **§4 bootstrap** once (creates RG, ACR, ACA env, app, OIDC identity, roles).
2. Set the **§4b runtime env/secrets** on the Container App.
3. Add the **§3 GitHub Secrets and Variables**.
4. Commit the deployment files (`Dockerfile`, `.dockerignore`, `.github/workflows/deploy.yml`) and push to `main`.
5. Watch **GitHub → Actions**. The pipeline will `npm ci` + lint → build → push → deploy.
6. Grab the URL from the workflow summary, or:
   ```bash
   az containerapp show -n cyc-app -g cyc-rg \
     --query properties.configuration.ingress.fqdn -o tsv
   ```
7. Update Supabase Auth **Redirect URLs**, Razorpay **webhooks/allowed origins**, and
   Google service-account **sheet/drive sharing** to use the new production URL.

---

## 7. Manual Azure Portal checklist

- [ ] **Ingress**: Container App → *Ingress* is **External**, target port **3000**.
- [ ] **Scaling**: min replicas `0` (scale-to-zero) or `1` (no cold starts) as you prefer; review the HTTP scale rule.
- [ ] **Registry auth**: Container App → *Containers → Registry* uses **system-assigned managed identity** with **AcrPull** (no admin username/password).
- [ ] **Secrets**: all §4b secrets present under *Secrets*; env vars use `secretref:` for sensitive values.
- [ ] **Custom domain + TLS**: add your domain under *Custom domains* and bind a managed certificate; then update `NEXT_PUBLIC_SITE_URL` and rebuild.
- [ ] **Health/logs**: confirm the revision is *Running* and healthy; check *Log stream* / Log Analytics.
- [ ] **CORS / redirect URLs** updated in Supabase, Razorpay, and Google as per §6.7.
- [ ] **OIDC**: no publish profile or ACR admin credentials stored anywhere in GitHub.

---

## 8. 🔴 Security action required — leaked Google credential

`config/google-credentials.json` is **committed to the repository and contains a live
OAuth `client_secret`**. The application code does **not** read this file (it uses the
`GOOGLE_CREDENTIALS` environment variable instead), so the file is unused at runtime.

Per the current decision the file is being left in place, but the exposed secret is
**still live in git history**. Strongly recommended:

1. **Rotate/reset the OAuth client secret** in Google Cloud Console → *APIs & Services →
   Credentials* for project `neural-stacker-455816-f3`. Treat the committed value as compromised.
2. When ready, remove the file from the repo (`git rm config/google-credentials.json`) and
   purge it from history (`git filter-repo` / BFG), since it is not needed by the app.
3. Keep all Google auth flowing through the `GOOGLE_CREDENTIALS` ACA secret only.

---

## 9. Notes & assumptions surfaced during analysis

- **Package manager**: repo shipped both `package-lock.json` and `pnpm-lock.yaml`. This
  deployment standardizes on **npm** (matches the build script's internal `npm run obfuscate`
  and the old `netlify.toml`). Consider deleting `pnpm-lock.yaml` to remove ambiguity.
- **Node**: no version was pinned; this deployment uses **Node 20 LTS** (satisfies Next 14's
  `>=18.17` requirement). Consider adding `"engines": { "node": "20.x" }` to `package.json`.
- **Tests**: no unit/integration test suite exists. The CI "test" stage runs `next lint`
  (non-blocking, as no ESLint config is committed). Add real tests + a strict lint config to
  harden the gate.
- **Build obfuscation**: `npm run build` runs `javascript-obfuscator` over `.next/static`.
  This is preserved as-is (no business-logic change); verify the obfuscated bundle behaves
  correctly in the deployed environment.
- **Netlify**: `netlify.toml` is now superseded by this Azure setup; remove it if Netlify is retired.
```
