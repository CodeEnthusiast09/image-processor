import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';
import * as path from 'path';
import { Upload } from './upload.entity';
import { S3Service } from './s3.service';
import { ImageProcessingJob } from './interfaces';

@Processor('image-processing')
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
    private s3Service: S3Service,
    private configService: ConfigService,
  ) {}

  @Process('process-image')
  async handleImageProcessing(job: Job<ImageProcessingJob>) {
    const { uploadId, s3FileName, bucketName } = job.data;

    this.logger.log(`Started processing upload: ${uploadId}`);

    try {
      // Update status to 'processing'
      await this.uploadRepository.update(uploadId, {
        status: 'processing',
      });

      // Download original image from S3
      this.logger.debug(`Downloading original image from S3: ${s3FileName}`);
      const originalBuffer = await this.s3Service.downloadFile(
        bucketName,
        s3FileName,
      );

      const fileNameWithoutExt = path.parse(s3FileName).name;
      const ext = path.parse(s3FileName).ext;

      const resizedFileName = `${fileNameWithoutExt}-resized${ext}`;
      const compressedFileName = `${fileNameWithoutExt}-compressed${ext}`;
      const thumbnailFileName = `${fileNameWithoutExt}-thumbnail${ext}`;

      const processedBucket = this.configService.get<string>(
        'MINIO_BUCKET_PROCESSED',
      );

      const thumbnailBucket = this.configService.get<string>(
        'MINIO_BUCKET_THUMBNAILS',
      );

      if (!processedBucket || !thumbnailBucket) {
        throw new Error(
          'MINIO_BUCKET_PROCESSED or MINIO_BUCKET_THUMBNAILS is missing',
        );
      }

      // 1. Resize image
      this.logger.debug(`Resizing image for upload: ${uploadId}`);
      const resizedBuffer = await sharp(originalBuffer)
        .resize(1920, 1080, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toBuffer();

      const resizedUrl = await this.s3Service.uploadBuffer(
        processedBucket,
        resizedFileName,
        resizedBuffer,
      );

      // 2. Compress image
      this.logger.debug(`Compressing image for upload: ${uploadId}`);
      const compressedBuffer = await sharp(originalBuffer)
        .jpeg({ quality: 80 })
        .toBuffer();

      const compressedUrl = await this.s3Service.uploadBuffer(
        processedBucket,
        compressedFileName,
        compressedBuffer,
      );

      // 3. Generate thumbnail
      this.logger.debug(`Generating thumbnail for upload: ${uploadId}`);
      const thumbnailBuffer = await sharp(originalBuffer)
        .resize(200, 200, {
          fit: 'cover',
        })
        .toBuffer();

      const thumbnailUrl = await this.s3Service.uploadBuffer(
        thumbnailBucket,
        thumbnailFileName,
        thumbnailBuffer,
      );

      // Update database with completed status and URLs
      await this.uploadRepository.update(uploadId, {
        status: 'completed',
        resized_path: resizedFileName,
        resized_url: resizedUrl,
        compressed_path: compressedFileName,
        compressed_url: compressedUrl,
        thumbnail_path: thumbnailFileName,
        thumbnail_url: thumbnailUrl,
        completed_at: new Date(),
      });

      this.logger.log(`✅ Completed processing upload: ${uploadId}`);
    } catch (err: unknown) {
      const error = err as Error;

      this.logger.error(
        `Error processing upload ${uploadId}: ${error.message}`,
        error.stack,
      );

      // Update database with failed status
      await this.uploadRepository.update(uploadId, {
        status: 'failed',
        error: error.message,
      });

      throw error;
    }
  }
}
