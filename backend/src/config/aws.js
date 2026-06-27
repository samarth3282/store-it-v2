import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

const clientConfig = {
  region: env.AWS_REGION,
};

// Only explicitly attach credentials if provided via env.
// Otherwise, AWS SDK defaults to the IAM role (EC2 Instance Profile)
if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  };
}

export const s3Client = new S3Client(clientConfig);
