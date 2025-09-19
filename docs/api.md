# API Reference

Base URL
- Local development: `http://localhost:8000`

Authentication
- All upload routes require authentication via Better Auth. Two supported modes:
  - Session cookies (if using Better Auth session mechanism in a browser)
  - Bearer token with JWT: `Authorization: Bearer <token>`

Better Auth Endpoints
- Proxied under `/api/auth/*` and handled by Better Auth's `toNodeHandler`.
- Refer to Better Auth documentation for sign-in/up, verification, 2FA, etc.

Session Helper
- GET `/api/me`
  - Returns `{ session, user }` or `null` if not authenticated.

Health Checks
- GET `/healthz` → `ok`
- GET `/api/auth/ok` → `ok`

Uploads API (protected)
- Root: `/v1/uploads`

1) POST `/v1/uploads/`
   - Multipart form-data with field `file`
   - Headers: `Authorization: Bearer <token>` (or cookie-based session)
   - Response 201
     - `{ id, filename, mimeType, type, size, s3Key, src, preview, details, uploadedBy, uploadedAt }`
   - Notes
     - Images may be resized for preview; videos get a poster image (requires FFmpeg); audio uses the original as preview.

2) GET `/v1/uploads/search`
   - Query params (all optional)
     - `query`: text match on filename
     - `type`: `image|video|audio|document|other`
     - `mimeType`: exact MIME type filter
     - `minSize`, `maxSize`: bytes
     - `startDate`, `endDate`: ISO strings
     - `page` (default 1), `limit` (default 20, max 100)
     - `sortBy`: `uploadedAt|size|originalName` (uploadedAt default)
     - `sortOrder`: `asc|desc` (desc default)
   - Response 200
     - `{ items, hasMore, pagination, filters }`

3) GET `/v1/uploads/:fileId`
   - Returns a single item with convenience fields: `id`, `hasPreview`, `downloadUrl`, `previewUrl`

4) DELETE `/v1/uploads/:fileId`
   - Deletes the DB record and associated S3 objects (including preview/poster if present)

5) POST `/v1/uploads/bulk-delete`
   - JSON body: `{ "fileIds": ["<id1>", "<id2>", ...] }`
   - Limit: 100 IDs per request
   - Performs S3 batch deletion in chunks and removes DB records

Errors
- `401 UNAUTHORIZED`: Missing/invalid auth
- `400`: Validation issues (e.g., file too large, bad ID)
- `404`: Not found or not owned by the user
- `500`: Unexpected server error
