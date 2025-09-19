import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Define the schema for environment variables
const envSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),
  BETTER_AUTH_URL: z.string().url('BETTER_AUTH_URL must be a valid URL').min(1, 'BETTER_AUTH_URL is required'),
  AUTH_SERVER_COMPANY_NAME: z.string().min(1, 'COMPANY_NAME is required'),
  AUTH_SERVER_COMPANY_PRIVACY_POLICY_URL: z.string().url().optional(),
  AUTH_SERVER_COMPANY_WEBSITE_URL: z.string().url().optional(),
  AUTH_SERVER_COMPANY_HELP_URL: z.string().url().optional(),
  AUTH_SERVER_MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  AUTH_SERVER_SMTP_SERVER: z.string(),
  AUTH_SERVER_SMTP_PORT: z.string(),
  AUTH_SERVER_SMTP_USERNAME: z.string(),
  AUTH_SERVER_SMTP_PASSWORD: z.string(),
  AUTH_SERVER_SMTP_FROM: z.string().email().optional(),
  AUTH_SERVER_RELATED_CLIENT: z.string().url(),
  //S3 Object storage configs
  S3_COMP_BUCKET_ACC_KEY: z.string(),
  S3_COMP_BUCKET_SEC_KEY: z.string(),
  S3_COMP_BUCKET_BKT: z.string(),
  S3_COMP_BUCKET_RGN: z.string(),
  S3_COMP_BUCKET_URL: z.string().url(),
  S3_COMP_VIRT_HOST: z.string().url(),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.issues.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;