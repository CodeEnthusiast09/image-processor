import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer'; // ← CHANGE FROM diskStorage
import { UploadService } from './upload.service';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: 'Upload an image for processing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file to upload',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Image uploaded successfully and queued for processing',
    schema: {
      example: {
        message: 'File uploaded successfully. Processing in background.',
        upload_id: '7448e9cc-8993-4d9d-a6f8-98285726b969',
        status: 'pending',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid file or no file uploaded',
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(), // ← CHANGED: Store in memory instead of disk
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const upload = await this.uploadService.createUpload(file);

    return {
      message: 'File uploaded successfully. Processing in background.',
      upload_id: upload.id,
      status: upload.status,
    };
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get upload processing status' })
  @ApiParam({ name: 'id', description: 'Upload ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Upload status retrieved successfully',
    schema: {
      example: {
        upload_id: '7448e9cc-8993-4d9d-a6f8-98285726b969',
        status: 'completed',
        original_name: 'my-image.jpg',
        created_at: '2025-12-06T07:00:00.000Z',
        completed_at: '2025-12-06T07:00:05.000Z',
        error: null,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Upload not found' })
  async getStatus(@Param('id') id: string) {
    try {
      const upload = await this.uploadService.getUploadStatus(id);

      return {
        upload_id: upload.id,
        status: upload.status,
        original_name: upload.original_name,
        created_at: upload.created_at,
        completed_at: upload.completed_at,
        error: upload.error,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(errMsg);
    }
  }

  @Get(':id/result')
  @ApiOperation({ summary: 'Get processed image URLs' })
  @ApiParam({ name: 'id', description: 'Upload ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Processed image URLs retrieved successfully',
    schema: {
      example: {
        id: '7448e9cc-8993-4d9d-a6f8-98285726b969',
        original_name: 'my-image.jpg',
        status: 'completed',
        original_url:
          'http://localhost:9000/originals/1733481234567-123456789.jpeg',
        resized_url:
          'http://localhost:9000/processed/1733481234567-123456789-resized.jpeg',
        compressed_url:
          'http://localhost:9000/processed/1733481234567-123456789-compressed.jpeg',
        thumbnail_url:
          'http://localhost:9000/thumbnails/1733481234567-123456789-thumbnail.jpeg',
        completed_at: '2025-12-06T07:00:05.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Upload not completed yet or not found',
  })
  async getResult(@Param('id') id: string) {
    try {
      return await this.uploadService.getUploadResult(id);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(errMsg);
    }
  }
}
