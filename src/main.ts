import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files
  app.useStaticAssets(join(__dirname, '..', 'src/uploads'), {
    prefix: '/uploads/',
  });

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Image Processing API')
    .setDescription(
      'API for uploading images and processing them in the background',
    )
    .setVersion('1.0')
    .addTag('upload')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);

  logger.log('Server running on http://localhost:3000');
  logger.log('API Documentation: http://localhost:3000/api/docs');
}

bootstrap().catch((error) => {
  console.error('Unhandled error in bootstrap:', error);

  process.exit(1);
});
