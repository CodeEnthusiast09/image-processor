import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { Upload } from './upload.entity';
import { S3Service } from './s3.service';
import * as path from 'path';
import { UploadResult } from './interfaces';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    @InjectRepository(Upload)
    private uploadRepository: Repository<Upload>,

    @InjectQueue('image-processing')
    private imageQueue: Queue,

    private s3Service: S3Service,
    private configService: ConfigService,
  ) {}

  async createUpload(file: Express.Multer.File): Promise<Upload> {
    this.logger.log(`Received upload: ${file.originalname}`);

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const s3FileName = `${uniqueSuffix}${ext}`;

    // Upload original file to S3
    const bucketName = this.configService.get<string>('MINIO_BUCKET_ORIGINALS');

    if (!bucketName) {
      throw new Error('MINIO_BUCKET_ORIGINALS is not defined in environment');
    }

    const s3Url = await this.s3Service.uploadBuffer(
      bucketName,
      s3FileName,
      file.buffer,
    );

    this.logger.log(`Uploaded to S3: ${s3Url}`);

    // Create database record
    const upload = this.uploadRepository.create({
      original_name: file.originalname,
      original_path: s3FileName, // Store S3 key
      original_url: s3Url, // Store S3 URL
      status: 'pending',
    });

    const savedUpload = await this.uploadRepository.save(upload);
    this.logger.log(`Created upload record with ID: ${savedUpload.id}`);

    // Add job to queue for background processing
    await this.imageQueue.add('process-image', {
      uploadId: savedUpload.id,
      s3FileName: s3FileName,
      bucketName: bucketName,
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
      original_url: upload.original_url,
      resized_url: upload.resized_url,
      compressed_url: upload.compressed_url,
      thumbnail_url: upload.thumbnail_url,
      completed_at: upload.completed_at,
    };
  }
}
