import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly endpoint: string;
  private readonly port: string;

  constructor(private readonly configService: ConfigService) {
    this.endpoint =
      this.configService.get<string>('MINIO_ENDPOINT') ?? 'localhost';
    this.port = this.configService.get<string>('MINIO_PORT') ?? '9000';

    const accessKeyId = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('MINIO_SECRET_KEY');

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be set.');
    }

    this.s3Client = new S3Client({
      endpoint: `http://${this.endpoint}:${this.port}`,
      region: 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });

    this.logger.log('S3 Service initialized with Minio');
  }

  async uploadFile(
    bucketName: string,
    fileName: string,
    filePath: string,
  ): Promise<string> {
    try {
      const fileBuffer = fs.readFileSync(filePath);

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: this.getContentType(fileName),
      });

      await this.s3Client.send(command);

      const url = this.getPublicUrl(bucketName, fileName);
      this.logger.log(`Uploaded file to: ${url}`);

      return url;
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`Error uploading file: ${error.message}`, error.stack);
      throw error;
    }
  }

  async uploadBuffer(
    bucketName: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: this.getContentType(fileName),
      });

      await this.s3Client.send(command);

      const url = this.getPublicUrl(bucketName, fileName);
      this.logger.log(`Uploaded buffer to: ${url}`);

      return url;
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Error uploading buffer: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async downloadFile(bucketName: string, fileName: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      });

      const response = await this.s3Client.send(command);

      const stream = response.Body as Readable;
      const chunks: Uint8Array[] = [];

      return await new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(
        `Error downloading file: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  getPublicUrl(bucketName: string, fileName: string): string {
    return `http://${this.endpoint}:${this.port}/${bucketName}/${fileName}`;
  }

  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    return contentTypes[ext ?? ''] ?? 'application/octet-stream';
  }
}
