# Architecture

Overview
- Express 5 server in TypeScript: `src/server.ts`
- Better Auth for identity: `src/modules/authentication/auth.ts`
- MongoDB adapter for Better Auth: `src/database/mongo-connection.ts`
- Auth middleware to guard routes: `src/modules/authentication/middleware.ts`
- Uploads module (router/controller/utils): `src/modules/core`
- S3 client (v3): `src/database/s3-object-store.ts`

Auth
- Better Auth configured with plugins: jwt, multiSession, bearer, organization, admin, apiKey, phoneNumber, anonymous, username, twoFactor.
- Email verification and password reset send via Nodemailer (templated HTML) using SMTP settings from env.
- The auth handler is mounted at `/api/auth/*` via `toNodeHandler(auth)`.

Uploads
- `multer` uses in-memory storage; files come as buffers.
- `upload.controller.ts` orchestrates metadata extraction and preview generation:
  - `file-type` to detect mime
  - `image-size` to detect width/height
  - `sharp` to resize images (720px max) for previews
  - `fluent-ffmpeg` to grab a video poster (requires ffmpeg binary on host)
- Files and previews are uploaded to S3 via `@aws-sdk/client-s3`.
- Public URLs are constructed using `S3_COMP_VIRT_HOST` + key; adjust to match your CDN/virtual-hosting setup.

Data Model
- Mongo collection `files` stores metadata, including `src` and `preview` URLs, S3 object key, type, and detail fields.
- `uploadedBy` links records to the authenticated user id (from Better Auth).

Security
- CORS with an allowlist (adjust `origin` in `src/server.ts`).
- Helmet for sane defaults.
- `app.set('trust proxy', 1)` for correct secure cookie behavior behind proxies.

Performance Notes
- In-memory uploads are convenient but consider limits in `FILE_CONSTRAINTS` and server memory.
- Previews are optional; for small images, original is reused as preview.
- Video poster extraction writes temp files under OS temp dir; ensure adequate disk and permissions.
