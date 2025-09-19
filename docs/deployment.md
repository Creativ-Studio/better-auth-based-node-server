# Deployment

Build and Runtime
- Build: `npm run build` (emits JS to `dist/`)
- Start: use a process manager (PM2/systemd/Docker) to run Node 18+
- Ensure FFmpeg is installed in the runtime image/host

Environment
- Provide all variables in a secure store (platform secrets) — see docs/env.md
- Set `BETTER_AUTH_URL` to the public origin of this server (https://api.example.com)
- Configure CORS origins in `src/server.ts` to your frontend domains

Proxies and HTTPS
- `app.set('trust proxy', 1)` is enabled for correct cookie handling behind proxies (ELB/NGINX/Cloudflare)
- Terminate TLS at the load balancer or at Node — either way, Better Auth should see the correct origin set via `BETTER_AUTH_URL`

S3/Storage
- For S3-compatible providers (R2, MinIO), ensure
  - `S3_COMP_BUCKET_URL` points to the API endpoint
  - `S3_COMP_VIRT_HOST` is your public CDN/virtual-hosting domain used to build asset URLs
- Consider private buckets + signed URLs if public access is not desired (code currently uploads with `public-read` ACL)

MongoDB
- Use a managed cluster where possible
- Configure indices and backup strategy according to your org’s policy

Logging/Monitoring
- Pipe stdout/stderr to your logging system
- Track 5xx rates on `/v1/uploads/*` and Better Auth `/api/auth/*`

Hardening Checklist
- Restrict CORS to your known origins
- Verify FFmpeg version is patched
- Limit request sizes (already `1mb` for JSON) and consider rate limiting
- Rotate `BETTER_AUTH_SECRET` appropriately
