import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { Upload } from './upload.entity';
import { ImageProcessingJob } from './interfaces';
import { Logger } from '@nestjs/common';

@Processor('image-processing')
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,
  ) {}

  @Process('process-image')
  async handleImageProcessing(job: Job<ImageProcessingJob>) {
    const { uploadId, filePath } = job.data;

    this.logger.log(`Started processing upload: ${uploadId}`);

    try {
      // Update status to 'processing'
      await this.uploadRepository.update(uploadId, {
        status: 'processing',
      });

      // Get the original file info
      const upload = await this.uploadRepository.findOne({
        where: { id: uploadId },
      });

      if (!upload) {
        throw new Error('Upload not found');
      }

      const originalFileName = path.basename(filePath);
      const fileNameWithoutExt = path.parse(originalFileName).name;
      const ext = path.parse(originalFileName).ext;

      // Define output paths
      const processedDir = path.join(process.cwd(), 'src/uploads/processed');
      const thumbnailDir = path.join(process.cwd(), 'src/uploads/thumbnails');

      // Ensure directories exist
      if (!fs.existsSync(processedDir)) {
        fs.mkdirSync(processedDir, { recursive: true });
      }
      if (!fs.existsSync(thumbnailDir)) {
        fs.mkdirSync(thumbnailDir, { recursive: true });
      }

      const resizedFileName = `${fileNameWithoutExt}-resized${ext}`;
      const compressedFileName = `${fileNameWithoutExt}-compressed${ext}`;
      const thumbnailFileName = `${fileNameWithoutExt}-thumbnail${ext}`;

      const resizedPath = path.join(processedDir, resizedFileName);
      const compressedPath = path.join(processedDir, compressedFileName);
      const thumbnailPath = path.join(thumbnailDir, thumbnailFileName);

      // 1. Resize image (1920x1080 max, maintain aspect ratio)
      this.logger.debug(`Resizing image for upload: ${uploadId}`);
      await sharp(filePath)
        .resize(1920, 1080, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .toFile(resizedPath);

      // 2. Compress image (reduce quality to 80%)
      this.logger.debug(`Compressing image for upload: ${uploadId}`);
      await sharp(filePath).jpeg({ quality: 80 }).toFile(compressedPath);

      // 3. Generate thumbnail (200x200, cover mode)
      this.logger.debug(`Generating thumbnail for upload: ${uploadId}`);
      await sharp(filePath)
        .resize(200, 200, {
          fit: 'cover',
        })
        .toFile(thumbnailPath);

      // Update database with completed status and paths
      await this.uploadRepository.update(uploadId, {
        status: 'completed',
        resized_path: resizedPath,
        compressed_path: compressedPath,
        thumbnail_path: thumbnailPath,
        completed_at: new Date(),
      });

      this.logger.log(`Completed processing upload: ${uploadId}`);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown processing error';

      await this.uploadRepository.update(uploadId, {
        status: 'failed',
        error: message,
      });

      throw error;
    }
  }
}
