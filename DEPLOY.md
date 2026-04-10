# Netlify Deployment Guide — `aim-apply`

Complete operational runbook for deploying the `aim-apply` repo to **Netlify** alongside the existing GitHub Pages site.

---

## **1. Summary — Dual Deploy Architecture**

This repo serves two deploy targets from the **same source tree** (`docs/`):

| Target | URL | Serves | Functions |
|--------|-----|--------|-----------|
| **GitHub Pages** | `https://ai-mindset-org.github.io/aim-apply/` | Static only (`/docs`) | No |
| **Netlify** | `https://apply-aimindset.netlify.app/` | Static + Functions | **Yes** |

**Why both:**

- **GH Pages** stays live as the canonical static mirror (no config change, zero risk)
- **Netlify** adds server-side capabilities needed for:
  - `/.netlify/functions/umami-stats` — Umami API proxy (hides `UMAMI_API_KEY`)
  - `/.netlify/functions/umami-stats-extended` — richer metrics endpoint
  - `/.netlify/functions/submit` — future application submissions
- **Landing pages** (`jd-marketing.html`, `index.html`, `stats.html`) render on **both** deploys — they are pure static HTML
- **`analytics.html` REQUIRES Netlify** — it fetches `/.netlify/functions/umami-stats` and will 404 on GH Pages

**Key file:** `netlify.toml` (repo root)

```toml
[build]
  publish = "docs"
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/go"
  to = "https://raw.githubusercontent.com/ai-mindset-org/aim-apply/main/scripts/install.sh"
  status = 200

[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Methods = "POST, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type"
```

> **Gotcha noted:** CORS header allows `POST, OPTIONS` only. The `umami-stats` function is called via **GET** from `analytics.html`. Browsers don't block same-origin GETs, so this works, but if you ever front the API from a different domain you'll want to add `GET` to the allowed methods.

---

## **2. Pre-flight Check**

Run before first deploy to verify state:

```bash
cd /Users/alex/Documents/_code/aim-apply

# 1. Auth — should show "info@aimindset.org" in team "AI mindset"
netlify status

# 2. Working tree — commit or stash anything uncommitted
git status

# 3. Config — confirm publish="docs" and functions path
cat netlify.toml

# 4. Function files — all three must be present
ls -la netlify/functions/
# expected: submit.js  umami-stats.js  umami-stats-extended.js

# 5. Confirm docs/ has the landing pages
ls docs/*.html
# expected: analytics.html  index.html  jd-marketing.html  stats.html ...
```

**Stop and fix if:**
- `netlify status` shows "Not logged in" → `netlify login`
- `git status` shows unstaged changes → commit or stash (Netlify builds from the live working tree on manual deploy, but auto-deploy reads from GitHub)
- `netlify.toml` missing → recreate from the snippet above
- Any function file missing → don't deploy partial

---

## **3. First-Time Deploy**

### **Step 3.1 — Create & link site**

**Option A — CLI one-shot (recommended):**

```bash
cd /Users/alex/Documents/_code/aim-apply

# Create site with preferred name (may fail if taken — see 3.1b)
netlify sites:create --name apply-aimindset

# Link the local repo to this site
netlify link --name apply-aimindset
```

> **Name availability:** `apply-aimindset` is a guess — Netlify subdomains are **globally unique**. If it's taken you'll get `Site name already taken`. Fallbacks:
>   - `aim-apply`
>   - `aimindset-apply`
>   - `apply-aim`
>
> Pick an alternative and rerun. The name can also be changed later in the Netlify UI → **Site settings → Site information → Change site name**.

**Option B — Interactive:**

```bash
netlify init
# → "Create & configure a new site"
# → Team: "AI mindset"
# → Site name: apply-aimindset (or alternative)
# → Build command: (leave empty, just press Enter)
# → Directory to deploy: docs
# → Netlify functions folder: netlify/functions
```

This also **links the repo to GitHub**, enabling push-to-deploy.

### **Step 3.2 — Set environment variable**

The `umami-stats` function reads `UMAMI_API_KEY` from `process.env`. Without it, it returns `500`.

```bash
netlify env:set UMAMI_API_KEY api_3Lbiaua4Q3j1WeW5vNdQ5khEUibuXVRe \
  --scope production \
  --context production
```

**Also set for deploy previews and branch deploys** (optional, if you want analytics to work in PR previews):

```bash
netlify env:set UMAMI_API_KEY api_3Lbiaua4Q3j1WeW5vNdQ5khEUibuXVRe \
  --scope production \
  --context deploy-preview

netlify env:set UMAMI_API_KEY api_3Lbiaua4Q3j1WeW5vNdQ5khEUibuXVRe \
  --scope production \
  --context branch-deploy
```

**Verify it's set:**

```bash
netlify env:list --context production
# Should show UMAMI_API_KEY (value masked)
```

### **Step 3.3 — Deploy**

```bash
netlify deploy --prod --dir=docs --functions=netlify/functions
```

CLI will print:
- **Website URL:** `https://apply-aimindset.netlify.app`
- **Unique deploy URL:** `https://<hash>--apply-aimindset.netlify.app`
- **Logs URL:** admin panel link

### **Step 3.4 — Verify**

Save the API key locally first (for the test script in Part 2):

```bash
mkdir -p ~/.config/aim-apply
echo "api_3Lbiaua4Q3j1WeW5vNdQ5khEUibuXVRe" > ~/.config/aim-apply/umami-key
chmod 600 ~/.config/aim-apply/umami-key
```

Then run the automated smoke test:

```bash
NETLIFY_URL=https://apply-aimindset.netlify.app \
  bash scripts/test-deploy.sh
```

**Or verify manually:**

```bash
# Root page
curl -sSI https://apply-aimindset.netlify.app/ | head -1
# → HTTP/2 200

# Landing
curl -sSI https://apply-aimindset.netlify.app/jd-marketing.html | head -1
# → HTTP/2 200

# Function — should return JSON with pageviews, visitors
curl -sS "https://apply-aimindset.netlify.app/.netlify/functions/umami-stats?period=24h" | jq .

# Analytics page (needs function)
open https://apply-aimindset.netlify.app/analytics.html
```

---

## **4. Subsequent Deploys**

### **Auto-deploy (if linked to GitHub via `netlify init`)**

```bash
git add .
git commit -m "update landing copy"
git push origin main
# Netlify builds automatically on push, ~30s
```

Check build status:

```bash
netlify watch          # tail latest build
netlify open:admin     # open admin dashboard
```

### **Manual CLI deploy**

If the repo is **not** linked to GitHub, or you want to push a local-only change:

```bash
# Draft preview (doesn't touch production)
netlify deploy --dir=docs --functions=netlify/functions

# Production
netlify deploy --prod --dir=docs --functions=netlify/functions
```

---

## **5. Custom Subdomain (Optional)**

To serve from e.g. `apply.aimindset.org` or `apply-analytics.aimindset.org`:

### **Step 5.1 — Add DNS record via Timeweb**

Use the `/AIM-domain` skill (it handles `aimindset.org` via Timeweb Cloud API):

```
/AIM-domain add apply CNAME apply-aimindset.netlify.app
```

Or manually via Timeweb API (token at `~/.config/timeweb/token`):

```bash
curl -X POST "https://api.timeweb.cloud/api/v1/domains/aimindset.org/dns-records" \
  -H "Authorization: Bearer $(cat ~/.config/timeweb/token)" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","subdomain":"apply","value":"apply-aimindset.netlify.app"}'
```

> **No trailing dot** on the CNAME value (Timeweb gotcha).

### **Step 5.2 — Attach domain in Netlify**

**Via CLI:**

```bash
netlify domains:add apply.aimindset.org
# or via admin UI: Site settings → Domain management → Add custom domain
```

**Via UI:** Site settings → **Domain management** → **Add custom domain** → `apply.aimindset.org` → Verify → Assign.

### **Step 5.3 — SSL**

Netlify auto-provisions **Let's Encrypt** once DNS resolves (usually 1–5 min; up to 24h if propagation is slow). Force renewal:

```bash
netlify api provisionSiteTLSCertificate --data '{"site_id":"<SITE_ID>"}'
```

**Verify:**

```bash
curl -sSI https://apply.aimindset.org/ | head -1
# → HTTP/2 200
```

---

## **6. Troubleshooting**

| Symptom | Cause | Fix |
|---------|-------|-----|
| Function returns **500** with `UMAMI_API_KEY not configured` | Env var not set in production scope | `netlify env:set UMAMI_API_KEY <key> --context production`, redeploy |
| Function **times out** (>10s) | Umami API slow, default Netlify function timeout is 10s | Add `[functions]` block: `timeout = 26` in `netlify.toml` (max 26s on free plan, 900s Pro) |
| **404** on `/.netlify/functions/umami-stats` | `functions` path mismatch | Check `netlify.toml` has `functions = "netlify/functions"` and file is `netlify/functions/umami-stats.js` |
| **CORS blocked** when analytics.html fetches function | Function didn't return CORS headers | `umami-stats.js` already includes `Access-Control-Allow-Origin: *` in responses — verify file hasn't regressed |
| **Build fails** with "missing build command" | Netlify tries to run a build step | Leave build command empty — `publish = "docs"` is enough, no build needed |
| **Stale content** after deploy | CDN cache | `netlify deploy --prod` always invalidates. For manual bust: `netlify api purgeCache --data '{"site_id":"<SITE_ID>"}'` |
| `site name already taken` during `sites:create` | Subdomain taken globally | Pick alternative name (see 3.1) |
| **Auto-deploy not firing** on `git push` | Repo not linked via Netlify UI | Go to Site settings → Build & deploy → Continuous deployment → Link repository |

**View function logs:**

```bash
netlify logs:function umami-stats
# or tail: netlify logs:function umami-stats --live
```

**View build logs:**

```bash
netlify watch
netlify api listSiteDeploys --data '{"site_id":"<SITE_ID>"}' | jq '.[0]'
```

---

## **7. Rollback**

**List recent deploys:**

```bash
netlify api listSiteDeploys --data "{\"site_id\":\"$(netlify api getSite --data '{}' | jq -r .id)\"}" \
  | jq '.[0:5] | .[] | {id, created_at, state, deploy_url}'
```

**Rollback to previous deploy:**

```bash
# Via CLI (interactive)
netlify rollback

# Or pin a specific deploy via UI:
# → Deploys tab → pick a successful deploy → "Publish deploy"
```

**Emergency: disable site entirely (keeps deploy history):**

```bash
netlify api updateSite --data '{"site_id":"<SITE_ID>","body":{"published_deploy":null}}'
```

---

## **8. Quick Reference**

```bash
# Status
netlify status
netlify open              # open admin
netlify watch             # tail current build

# Deploy
netlify deploy --prod --dir=docs --functions=netlify/functions

# Env
netlify env:list --context production
netlify env:set KEY value --context production
netlify env:unset KEY --context production

# Logs
netlify logs:function umami-stats --live

# Domains
netlify domains:list
netlify domains:add apply.aimindset.org

# Rollback
netlify rollback
```

**Local dev (optional):**

```bash
netlify dev
# serves docs/ + functions on http://localhost:8888
```

---

## **Appendix — Env Vars Required**

| Name | Scope | Purpose |
|------|-------|---------|
| `UMAMI_API_KEY` | production | Auth for `api.umami.is/v1` from server functions |

**Current value:** `api_3Lbiaua4Q3j1WeW5vNdQ5khEUibuXVRe` (rotate via Umami Cloud → Profile → API keys if compromised)
