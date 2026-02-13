import {S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand} from '@aws-sdk/client-s3';
import {config} from '../config/index.js';

export interface R2UploadInput {
    bucket: string;
    key: string;
    body: Buffer | string;
    contentType?: string;
    metadata?: Record<string, string>;
}

export interface R2UploadResult {
    key: string;
    bucket: string;
    etag: string;
    location: string;
    size: number;
}

export interface R2ObjectInfo {
    key: string;
    bucket: string;
    size: number;
    lastModified: Date;
    etag: string;
    contentType?: string;
    metadata?: Record<string, string>;
}

class R2Client {
    private client: S3Client;

    constructor() {
        this.client = new S3Client({
            region: 'auto',
            endpoint: config.env.s3Endpoint,
            credentials: {
                accessKeyId: config.env.s3AccessKeyId,
                secretAccessKey: config.env.s3SecretAccessKey,
            },
        });
    }

    async uploadFile(input: R2UploadInput): Promise<R2UploadResult> {
        const command = new PutObjectCommand({
            Bucket: input.bucket,
            Key: input.key,
            Body: input.body,
            ContentType: input.contentType || 'application/octet-stream',
            Metadata: input.metadata || {},
        });

        try {
            const response = await this.client.send(command);
            
            return {
                key: input.key,
                bucket: input.bucket,
                etag: response.ETag?.replace(/"/g, '') || '',
                location: `https://${input.bucket}.${config.env.s3Endpoint}/${input.key}`,
                size: Buffer.isBuffer(input.body) ? input.body.length : Buffer.byteLength(input.body),
            };
        } catch (error) {
            throw new Error(`Failed to upload file to R2: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getObjectInfo(bucket: string, key: string): Promise<R2ObjectInfo | null> {
        const command = new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        try {
            const response = await this.client.send(command);
            
            return {
                key,
                bucket,
                size: response.ContentLength || 0,
                lastModified: response.LastModified || new Date(),
                etag: response.ETag?.replace(/"/g, '') || '',
                contentType: response.ContentType,
                metadata: response.Metadata as Record<string, string> | undefined,
            };
        } catch (error) {
            if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
                return null;
            }
            throw new Error(`Failed to get object info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async deleteObject(bucket: string, key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        try {
            await this.client.send(command);
        } catch (error) {
            throw new Error(`Failed to delete object: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async downloadObject(bucket: string, key: string): Promise<Buffer> {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        try {
            const response = await this.client.send(command);
            
            if (!response.Body) {
                throw new Error('No content returned from R2');
            }

            const chunks: Buffer[] = [];
            for await (const chunk of response.Body as any) {
                chunks.push(Buffer.from(chunk));
            }
            
            return Buffer.concat(chunks);
        } catch (error) {
            throw new Error(`Failed to download object: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

let r2ClientInstance: R2Client | null = null;

function getR2Client(): R2Client {
    if (!r2ClientInstance) {
        r2ClientInstance = new R2Client();
    }
    return r2ClientInstance;
}

export async function uploadToR2(input: R2UploadInput): Promise<R2UploadResult> {
    const client = getR2Client();
    return client.uploadFile(input);
}

export async function getR2ObjectInfo(bucket: string, key: string): Promise<R2ObjectInfo | null> {
    const client = getR2Client();
    return client.getObjectInfo(bucket, key);
}

export async function deleteFromR2(bucket: string, key: string): Promise<void> {
    const client = getR2Client();
    return client.deleteObject(bucket, key);
}

export async function downloadFromR2(bucket: string, key: string): Promise<Buffer> {
    const client = getR2Client();
    return client.downloadObject(bucket, key);
}

export function buildR2Url(bucket: string, key: string): string {
    return `https://${bucket}.${config.env.s3Endpoint}/${key}`;
}