import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { s3Client } from '../config/aws.js';

const BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Upload a file buffer to S3.
 * Uses multipart upload for files > 10 MB for reliability.
 */
export const uploadToS3 = async ({ key, buffer, contentType }) => {
  const fileSizeMB = buffer.length / (1024 * 1024);

  if (fileSizeMB > 10) {
    // Multipart upload — recommended by AWS for files > 5 MB
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      },
    });
    await upload.done();
  } else {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    });
    await s3Client.send(command);
  }

  return { key, bucket: BUCKET };
};

/**
 * Generate a pre-signed GET URL valid for the specified TTL.
 * Default: 3600 seconds (1 hour)
 */
export const generatePresignedGetUrl = async (key, expiresInSeconds = 3600) => {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};

/**
 * Generate a pre-signed GET URL with Content-Disposition: attachment
 * for browser download.
 */
export const generateDownloadUrl = async (key, filename, expiresInSeconds = 900) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
};

/**
 * Delete an object from S3.
 * Called on permanent file deletion.
 */
export const deleteFromS3 = async (key) => {
  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
  await s3Client.send(command);
};

/**
 * Fetch the raw file buffer from S3.
 * Used by the /api/agent/files/:fileId/buffer endpoint.
 */
export const getFileBuffer = async (key) => {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3Client.send(command);

  // response.Body is a ReadableStream; convert to Buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};
