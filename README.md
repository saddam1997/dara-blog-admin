# DARA Blog Admin

Standalone admin panel (React + Vite + TipTap) for the DARA Blog API (`dara-blog-backend`).
It is a static site: every page except the login screen needs an admin login, and the API checks
every `/api/v1/admin/*` request using the Bearer token.

## Development

```bash
npm install
npm run dev        # http://localhost:5173 — proxies /api to http://localhost:8004
```

Run the backend in parallel (`cd ../dara-blog-backend && npm run dev`).

## Production

1. Set the env vars in the hosting dashboard (or edit `.env` before building):
   - `VITE_API_URL=https://api.darabuddy.com/api/v1`
   - `VITE_SITE_URL=https://www.dara-website.com`
2. `npm run build`, then deploy the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages, nginx).
3. Add the admin's origin (e.g. `https://admin.darabuddy.com`) to `CORS_ORIGINS` in the backend `.env`.

The env vars are baked in at build time, so rebuild after you change them.

SPA routing: `vercel.json` (Vercel) and `public/_redirects` (Netlify/Cloudflare) are included.
For nginx:

```nginx
server {
    server_name admin.darabuddy.com;
    root /var/www/dara-blog-admin/dist;
    location / { try_files $uri /index.html; }
}
```
