# Auth-Auth Server

An Express + TypeScript authentication and uploads service built around Better Auth, MongoDB, and S3-compatible object storage. Ships with email verification/reset via SMTP, JWT support, and media upload with automatic previews (images/videos) using Sharp and FFmpeg.

## Features
- Authentication: Better Auth with MongoDB adapter, JWT, multi-session, bearer, 2FA, username, phone, API key, admin, org plugins
- Email: SMTP via Nodemailer for verification and password reset
- Uploads: Multer (memory) + S3 client; image resize, video poster extraction
- Search: Filter, sort, and paginate user uploads
- Delete: Single and bulk deletes with S3 cleanup
- Security: CORS, Helmet, proxy awareness

## Quick Start
1. Prerequisites
   - Node.js 18+
   - MongoDB instance/URI
   - S3-compatible bucket (AWS S3, R2, MinIO, etc.)
   - FFmpeg installed on the host (needed for video posters)
2. Install
   - npm install
3. Configure
   - Copy .env and set values. See docs/env.md
4. Run
   - Development: npm run dev
   - Build: npm run build

## Environment
- Validated via Zod in `src/configs/env.ts`
- See full list and examples: docs/env.md

## API Overview
- Auth routes are handled by Better Auth under `/api/auth/*` (proxied by `toNodeHandler`). Refer to Better Auth docs for full endpoints.
- Upload routes under `/v1/uploads` require authentication. See docs/api.md for request/response examples.
- Health checks: `/healthz` and `/api/auth/ok`
- Session helper: `/api/me` returns the current session/user

## Common Use Cases
- Email/password sign-up with verification and reset emails
- Issue JWT and call uploads API with `Authorization: Bearer <token>`
- Upload images/videos/audio and get preview/poster URLs back
- Search and delete previously uploaded assets

See docs/use-cases.md for end-to-end examples.

## Architecture
- Express server: `src/server.ts`
- Auth config: `src/modules/authentication/auth.ts`
- Auth middleware: `src/modules/authentication/middleware.ts`
- Uploads: router/controller/utils under `src/modules/core`
- Storage: `src/database/s3-object-store.ts`
- Mongo: `src/database/mongo-connection.ts`

Details in docs/architecture.md

## Deployment
- Provision environment variables and secrets
- Ensure FFmpeg is installed on the target image/host
- Configure CORS origins and `trust proxy` behind a load balancer

See docs/deployment.md for production notes.

## Known Issues
- Bulk delete uses `process.env.S3_BUCKET_NAME` while the rest of the code uses `S3_COMP_BUCKET_BKT`. Align these env vars before production (or update code to use the validated `env` object consistently).
- Start script references `dist/index.js` but the entry is `src/server.ts`. Adjust start to `node dist/server.js` after build.

## License
MIT (see LICENSE)
