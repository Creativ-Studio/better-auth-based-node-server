# Use Cases

Sign Up + Verify Email
- POST to the appropriate Better Auth sign-up endpoint (see Better Auth docs). A verification email is sent using your SMTP config.
- The verification link in the email will confirm the user.

Password Reset
- Trigger reset via Better Auth endpoint; an email is sent with a token.
- Frontend should direct the user to: `${AUTH_SERVER_RELATED_CLIENT}/auth/reset-password?token=<token>`

Get Session in App
- Request: GET `/api/me`
- Response: current `{ session, user }` or `null` if unauthenticated

Issue JWT for API Calls
- Use Better Auth login to obtain a JWT (via configured plugin)
- Include in headers: `Authorization: Bearer <token>` for protected routes

Upload a File
- Endpoint: POST `/v1/uploads/`
- Headers: `Authorization: Bearer <token>`
- Multipart body:
  - `file`: the binary file
- Response:
  - Metadata including `src` (public URL) and `preview` (image/video poster)

Search Files
- Endpoint: GET `/v1/uploads/search?type=image&page=1&limit=20`
- Returns a paginated list with `items` and `pagination` info

Delete
- Single: DELETE `/v1/uploads/:fileId`
- Bulk: POST `/v1/uploads/bulk-delete` with `{ "fileIds": ["..."] }`
- Removes S3 objects (original and preview/poster) and DB records

Notes
- Video poster extraction depends on FFmpeg; ensure it’s installed in dev/prod.
- For audio uploads, `preview` equals the original `src`.
