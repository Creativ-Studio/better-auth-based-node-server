# Environment Variables

All variables are validated in `src/configs/env.ts` using Zod. Missing or invalid values will abort startup with a descriptive error.

Core
- BETTER_AUTH_SECRET: Secret for Better Auth token/signing.
- BETTER_AUTH_URL: Public URL where this server is reachable (e.g., https://api.example.com).
- AUTH_SERVER_MONGO_URI: MongoDB connection string.
- AUTH_SERVER_RELATED_CLIENT: Frontend base URL used in password reset links.

Company/Links
- AUTH_SERVER_COMPANY_NAME: Display name used in emails.
- AUTH_SERVER_COMPANY_WEBSITE_URL: Company website URL.
- AUTH_SERVER_COMPANY_HELP_URL: Help/Support URL.
- AUTH_SERVER_COMPANY_PRIVACY_POLICY_URL: Privacy policy URL (optional).

SMTP (Nodemailer)
- AUTH_SERVER_SMTP_SERVER: SMTP host (e.g., smtp.gmail.com).
- AUTH_SERVER_SMTP_PORT: SMTP port (e.g., 465 for SSL, 587 for TLS).
- AUTH_SERVER_SMTP_USERNAME: SMTP username.
- AUTH_SERVER_SMTP_PASSWORD: SMTP password.
- AUTH_SERVER_SMTP_FROM: From address (e.g., no-reply@example.com).

S3-Compatible Storage
- S3_COMP_BUCKET_ACC_KEY: Access key ID.
- S3_COMP_BUCKET_SEC_KEY: Secret access key.
- S3_COMP_BUCKET_BKT: Bucket name.
- S3_COMP_BUCKET_RGN: Region (e.g., us-east-1).
- S3_COMP_BUCKET_URL: Endpoint URL (e.g., https://s3.amazonaws.com or R2/MinIO endpoint).
- S3_COMP_VIRT_HOST: URL host used to construct public object URLs (e.g., https://bucket.s3.amazonaws.com or custom CDN domain).

Example (.env)
- BETTER_AUTH_SECRET=change-me
- BETTER_AUTH_URL=http://localhost:8000
- AUTH_SERVER_MONGO_URI=mongodb://127.0.0.1:27017/auth-auth
- AUTH_SERVER_RELATED_CLIENT=http://localhost:5173
- AUTH_SERVER_COMPANY_NAME=YourCo
- AUTH_SERVER_COMPANY_WEBSITE_URL=https://yourco.com
- AUTH_SERVER_COMPANY_HELP_URL=https://help.yourco.com
- AUTH_SERVER_SMTP_SERVER=smtp.mailprovider.com
- AUTH_SERVER_SMTP_PORT=465
- AUTH_SERVER_SMTP_USERNAME=smtp-user
- AUTH_SERVER_SMTP_PASSWORD=smtp-pass
- AUTH_SERVER_SMTP_FROM=no-reply@yourco.com
- S3_COMP_BUCKET_ACC_KEY=...
- S3_COMP_BUCKET_SEC_KEY=...
- S3_COMP_BUCKET_BKT=media
- S3_COMP_BUCKET_RGN=us-east-1
- S3_COMP_BUCKET_URL=https://s3.amazonaws.com
- S3_COMP_VIRT_HOST=https://media.yourco.com

Notes
- FFmpeg must be installed on the host for video poster generation.
- If using Cloudflare R2 or MinIO, S3_COMP_BUCKET_URL points to the service endpoint, and S3_COMP_VIRT_HOST should be the public hostname used to serve files (can be a custom domain/CNAME).
