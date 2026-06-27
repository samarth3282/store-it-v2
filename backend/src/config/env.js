import { z } from 'zod';
import dotenv from 'dotenv';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  FRONTEND_URL: z.string().url(),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  AWS_REGION: z.string(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string(),
  EMAIL_HOST: z.string(),
  EMAIL_PORT: z.string(),
  EMAIL_SECURE: z.string().default('false'),
  EMAIL_USER: z.string(),
  EMAIL_PASS: z.string(),
  EMAIL_FROM: z.string(),
  AGENT_SECRET: z.string().min(16),
  OTP_EXPIRY_MINUTES: z.string().default('10'),
  OTP_MAX_ATTEMPTS: z.string().default('5'),
  DEFAULT_STORAGE_LIMIT_GB: z.string().default('2'),
  MAX_FILE_SIZE_MB: z.string().default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_AUTH_MAX: z.string().default('20'),
  RATE_LIMIT_API_MAX: z.string().default('200'),
  LOG_LEVEL: z.string().default('info'),
  LOG_FILE_PATH: z.string().default('./logs'),
});

let mergedEnv = { ...process.env };

if (process.env.USE_SECRETS_MANAGER === 'true') {
  console.log('🔒 Fetching configuration from AWS Secrets Manager...');
  try {
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const command = new GetSecretValueCommand({ SecretId: process.env.AWS_SECRET_NAME });
    const data = await client.send(command);
    
    if (data.SecretString) {
      const secrets = JSON.parse(data.SecretString);
      // Merge secrets into env, allowing process.env to override secrets
      mergedEnv = { ...secrets, ...process.env };
      console.log('✅ Secrets fetched successfully.');
    }
  } catch (err) {
    console.error('❌ Failed to fetch secrets from AWS Secrets Manager:', err);
    process.exit(1);
  }
}

// Throws at startup if any required variable is missing
const parsed = envSchema.safeParse(mergedEnv);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
