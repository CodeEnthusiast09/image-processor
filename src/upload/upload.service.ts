import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Upload } from './upload.entity';
import { UploadResult } from './interfaces';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,

    @InjectQueue('image-processing')
    private imageQueue: Queue,
  ) {}

  async createUpload(file: Express.Multer.File): Promise<Upload> {
    this.logger.log(`Received upload: ${file.originalname}`);

    // 1. Create database record
    const upload = this.uploadRepository.create({
      original_name: file.originalname,
      original_path: file.path,
      status: 'pending',
    });

    const savedUpload = await this.uploadRepository.save(upload);
    this.logger.log(`Created upload record with ID: ${savedUpload.id}`);

    // 2. Add job to queue for background processing
    await this.imageQueue.add('process-image', {
      uploadId: savedUpload.id,
      filePath: savedUpload.original_path,
    });

    this.logger.log(`Queued processing job for upload: ${savedUpload.id}`);

    return savedUpload;
  }

  async getUploadStatus(id: string): Promise<Upload> {
    const upload = await this.uploadRepository.findOne({ where: { id } });

    if (!upload) {
      this.logger.warn(`Upload not found: ${id}`);

      throw new NotFoundException('Upload not found');
    }

    this.logger.debug(`Status check for upload: ${id} - ${upload.status}`);
    return upload;
  }

  async getUploadResult(id: string): Promise<UploadResult> {
    const upload = await this.uploadRepository.findOne({ where: { id } });

    if (!upload) {
      this.logger.warn(`Upload not found: ${id}`);

      throw new NotFoundException('Upload not found');
    }

    if (upload.status !== 'completed') {
      this.logger.warn(`Upload ${id} is ${upload.status}, not completed yet`);

      throw new Error(`Upload is ${upload.status}, not completed yet`);
    }

    this.logger.log(`Returning results for upload: ${id}`);

    return {
      id: upload.id,
      original_name: upload.original_name,
      status: upload.status,
      original_url: `/uploads/original/${upload.original_name}`,
      resized_url: upload.resized_path
        ? `/uploads/processed/${upload.resized_path.split('/').pop()}`
        : null,
      compressed_url: upload.compressed_path
        ? `/uploads/processed/${upload.compressed_path.split('/').pop()}`
        : null,
      thumbnail_url: upload.thumbnail_path
        ? `/uploads/thumbnails/${upload.thumbnail_path.split('/').pop()}`
        : null,
      completed_at: upload.completed_at,
    };
  }
}
