# DEPLOYMENT.md

## Render (Backend API)

1. Go to **[render.com](https://render.com)** → Sign in
2. Click **New +** → **Blueprint**
3. Connect your GitHub repo: `Vishal-Deshmukh7/mplads`
4. Render auto-detects `render.yaml` → click **Apply**
5. Click the created service → **Settings** tab
6. Verify these values:

| Field | Value |
|---|---|
| **Root Directory** | `/` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Health Check Path** | `/api/health` |

7. Go to **Environment** tab → Add:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `API_ONLY` | `true` |
| `GEMINI_API_KEY` | *(your key)* |

8. Go to **Disks** → Confirm disk `json-db` is mounted at `/opt/render/project/src/data`
9. Click **Manual Deploy** → **Deploy latest commit**

Your API is live at: `https://jandarpan-api.onrender.com`

---

## Vercel (Frontend)

1. Go to **[vercel.com](https://vercel.com)** → Sign in
2. Click **New Project**
3. Import `Vishal-Deshmukh7/mplads`
4. Click **Deploy** (Vercel auto-detects Vite)
5. After deploy, copy your Vercel URL (e.g. `mplads.vercel.app`)

**Then update `vercel.json` in your repo:**
- Replace `https://jandarpan-api.onrender.com` with your actual Render URL
- Commit and push → Vercel auto-redeploys
