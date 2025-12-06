import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { Upload } from './upload.entity';
import { ImageProcessor } from './image.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Upload]),
    BullModule.registerQueue({
      name: 'image-processing',
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, ImageProcessor],
})
export class UploadModule {}
