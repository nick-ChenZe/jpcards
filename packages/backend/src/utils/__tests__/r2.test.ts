import {describe, expect, it, beforeAll, afterAll} from 'vitest';
import {config} from '../../config/index.js';
import {uploadToR2, getR2ObjectInfo, deleteFromR2, downloadFromR2, buildR2Url} from '../r2.js';

const hasRealR2Config = Boolean(
    config.env.s3AccessKeyId && 
    config.env.s3SecretAccessKey && 
    config.env.s3Endpoint &&
    config.env.s3Bucket
);

const TEST_BUCKET = config.env.s3Bucket;
const TEST_KEY = `test/r2-integration-test-${Date.now()}.txt`;
const TEST_CONTENT = `R2 integration test content - ${new Date().toISOString()}`;

describe('Cloudflare R2 real integration', () => {
    beforeAll(async () => {
        // 清理可能存在的旧测试文件
        if (hasRealR2Config) {
            try {
                await deleteFromR2(TEST_BUCKET, TEST_KEY);
            } catch (error) {
                // 忽略不存在的文件错误
            }
        }
    });

    afterAll(async () => {
        // 测试完成后清理测试文件
        if (hasRealR2Config) {
            try {
                await deleteFromR2(TEST_BUCKET, TEST_KEY);
            } catch (error) {
                // 忽略清理错误
            }
        }
    });

    it.runIf(hasRealR2Config)(
        'uploads file to R2 and verifies attributes',
        async () => {
            const result = await uploadToR2({
                bucket: TEST_BUCKET,
                key: TEST_KEY,
                body: TEST_CONTENT,
                contentType: 'text/plain',
                metadata: {
                    'test-file': 'true',
                    'upload-time': new Date().toISOString()
                }
            });

            // 验证上传结果
            expect(result.key).toBe(TEST_KEY);
            expect(result.bucket).toBe(TEST_BUCKET);
            expect(result.etag).toBeTruthy();
            expect(result.etag.length).toBeGreaterThan(0);
            expect(result.location).toBe(buildR2Url(TEST_BUCKET, TEST_KEY));
            expect(result.size).toBe(Buffer.byteLength(TEST_CONTENT));
        },
        30000
    );

    it.runIf(hasRealR2Config)(
        'retrieves object info from R2',
        async () => {
            // 首先确保文件存在
            await uploadToR2({
                bucket: TEST_BUCKET,
                key: TEST_KEY,
                body: TEST_CONTENT,
                contentType: 'text/plain',
                metadata: {
                    'test-file': 'true'
                }
            });

            const info = await getR2ObjectInfo(TEST_BUCKET, TEST_KEY);

            // 验证对象信息
            expect(info).toBeTruthy();
            expect(info!.key).toBe(TEST_KEY);
            expect(info!.bucket).toBe(TEST_BUCKET);
            expect(info!.size).toBe(Buffer.byteLength(TEST_CONTENT));
            expect(info!.contentType).toBe('text/plain');
            expect(info!.etag).toBeTruthy();
            expect(info!.metadata?.['test-file']).toBe('true');
            expect(info!.lastModified).toBeInstanceOf(Date);
        },
        30000
    );

    it.runIf(hasRealR2Config)(
        'downloads file from R2',
        async () => {
            // 首先确保文件存在
            await uploadToR2({
                bucket: TEST_BUCKET,
                key: TEST_KEY,
                body: TEST_CONTENT,
                contentType: 'text/plain'
            });

            const downloadedContent = await downloadFromR2(TEST_BUCKET, TEST_KEY);

            // 验证下载内容
            expect(downloadedContent).toBeTruthy();
            expect(downloadedContent.toString()).toBe(TEST_CONTENT);
            expect(downloadedContent.length).toBe(Buffer.byteLength(TEST_CONTENT));
        },
        30000
    );
});