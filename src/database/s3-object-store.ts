import AWS from 'aws-sdk';
import {env} from '../configs/env'

import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  PutObjectCommandInput 
} from '@aws-sdk/client-s3';

// Initialize S3 Client (v3)
export const s3Client = new S3Client({
  endpoint: env.S3_COMP_BUCKET_URL,
  region: env.S3_COMP_BUCKET_RGN || 'us-east-1',
  credentials: {
    accessKeyId: env.S3_COMP_BUCKET_ACC_KEY!,
    secretAccessKey: env.S3_COMP_BUCKET_SEC_KEY!,
  },
})

/**
 * Upload buffer to S3 using AWS SDK v3
 */
export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
  acl: string = 'public-read'
): Promise<string | null> {
  const params: PutObjectCommandInput = {
    Bucket: env.S3_COMP_BUCKET_BKT!,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: acl as any, // Type assertion needed for ACL
  };
  if(!env.S3_COMP_BUCKET_URL){
    return null
  }
  try {
    await s3Client.send(new PutObjectCommand(params));
    return `${env.S3_COMP_VIRT_HOST}/${key}`;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw error;
  }
}
