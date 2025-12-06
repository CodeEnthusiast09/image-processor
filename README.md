<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

# Image Processing Service

A NestJS-based backend service that handles image uploads and processes them asynchronously in the background. Images are stored in Minio (S3-compatible storage), resized, compressed, and thumbnails are generated using a queue-based worker system.

## 🌐 Live Demo
**Live API**: https://image-processor-production-6ad4.up.railway.app
**API Documentation**: https://image-processor-production-6ad4.up.railway.app/api/docs

## 🚀 Features

- **Async Image Processing**: Upload images and receive instant response while processing happens in the background
- **S3-Compatible Storage**: Uses Minio for scalable object storage (easily switchable to AWS S3)
- **Multiple Processing Operations**:
  - Resize (max 1920x1080, maintains aspect ratio)
  - Compress (80% quality)
  - Thumbnail generation (200x200, cover fit)
- **Job Queue System**: Uses Bull + Redis for reliable background job processing
- **Status Tracking**: Check processing status and retrieve results via REST API
- **PostgreSQL Database**: Persistent storage of upload metadata and processing status
- **Swagger Documentation**: Interactive API documentation at `/api/docs`
- **Structured Logging**: Professional logging using NestJS Logger
- **Memory-Efficient**: Files processed in memory, no local disk storage needed

## 🛠️ Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL + TypeORM
- **Queue**: Bull (BullMQ) + Redis
- **Storage**: Minio (S3-compatible)
- **Image Processing**: Sharp
- **File Upload**: Multer (memory storage)
- **API Documentation**: Swagger/OpenAPI
- **Language**: TypeScript

## 📋 Prerequisites

Before running this project, ensure you have:

- **Node.js** (v16 or higher)
- **npm**
- **PostgreSQL** (running locally or accessible remotely)
- **Docker** (for running Redis and Minio)

## 🔧 Installation

### 1. Clone the repository
```bash
git clone https://github.com/CodeEnthusiast09/image-processor
cd image-processor
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start Redis (using Docker)
```bash
docker run -d -p 6379:6379 --name redis-queue redis:alpine
```

To verify Redis is running:
```bash
docker ps
```

### 4. Start Minio (using Docker)
```bash
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin123" \
  quay.io/minio/minio server /data --console-address ":9001"
```

**Access Minio Console**: http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin123`

### 5. Create Minio Buckets

**Option A: Via Web Console**
1. Go to http://localhost:9001 and login
2. Click "Buckets" → "Create Bucket"
3. Create three buckets: `originals`, `processed`, `thumbnails`

**Option B: Via Docker Command**
```bash
# Set up Minio alias
docker exec minio mc alias set myminio http://localhost:9000 minioadmin minioadmin123

# Set buckets to public (read-only)
docker exec minio mc anonymous set download myminio/originals
docker exec minio mc anonymous set download myminio/processed
docker exec minio mc anonymous set download myminio/thumbnails
```

### 6. Configure Environment Variables

Create a `.env` file in the project root:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=image_processor

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Application
PORT=3000

# Minio (S3-compatible storage)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_ORIGINALS=originals
MINIO_BUCKET_PROCESSED=processed
MINIO_BUCKET_THUMBNAILS=thumbnails
```

**Replace the database credentials with your PostgreSQL configuration.**

### 7. Create PostgreSQL Database
```bash
# Connect to PostgreSQL
psql -U your_username

# Create database
CREATE DATABASE image_processor;

# Exit
\q
```

The `uploads` table will be created automatically when you start the application (thanks to `synchronize: true`).

## 🚀 Running the Application

### Development Mode
```bash
npm run start:dev
```

The server will start on `http://localhost:3000`

**Access Points:**
- API: http://localhost:3000
- Swagger Docs: http://localhost:3000/api/docs
- Minio Console: http://localhost:9001

### Production Mode
```bash
npm run build
npm run start:prod
```

## 📚 API Documentation

Once the server is running, access the interactive Swagger documentation:

**http://localhost:3000/api/docs**

## 🔌 API Endpoints

### 1. Upload Image

**Endpoint**: `POST /upload`

**Description**: Upload an image file for processing

**Request**:
- Content-Type: `multipart/form-data`
- Body: `image` (file, max 10MB, formats: jpg, jpeg, png, gif, webp)

**Example using curl**:
```bash
curl -X POST http://localhost:3000/upload \
  -F "image=@/path/to/your/image.jpg"
```

**Response** (201):
```json
{
  "message": "File uploaded successfully. Processing in background.",
  "upload_id": "7448e9cc-8993-4d9d-a6f8-98285726b969",
  "status": "pending"
}
```

---

### 2. Get Upload Status

**Endpoint**: `GET /upload/:id/status`

**Description**: Check the processing status of an upload

**Example**:
```bash
curl http://localhost:3000/upload/7448e9cc-8993-4d9d-a6f8-98285726b969/status
```

**Response** (200):
```json
{
  "upload_id": "7448e9cc-8993-4d9d-a6f8-98285726b969",
  "status": "completed",
  "original_name": "my-image.jpg",
  "created_at": "2025-12-06T07:00:00.000Z",
  "completed_at": "2025-12-06T07:00:05.000Z",
  "error": null
}
```

**Possible status values**:
- `pending` - Upload received, waiting for processing
- `processing` - Currently being processed
- `completed` - Processing finished successfully
- `failed` - Processing failed (check `error` field)

---

### 3. Get Processed Image URLs

**Endpoint**: `GET /upload/:id/result`

**Description**: Get URLs to all processed images (only available when status is `completed`)

**Example**:
```bash
curl http://localhost:3000/upload/7448e9cc-8993-4d9d-a6f8-98285726b969/result
```

**Response** (200):
```json
{
  "id": "7448e9cc-8993-4d9d-a6f8-98285726b969",
  "original_name": "my-image.jpg",
  "status": "completed",
  "original_url": "http://localhost:9000/originals/1733481234567-123456789.jpeg",
  "resized_url": "http://localhost:9000/processed/1733481234567-123456789-resized.jpeg",
  "compressed_url": "http://localhost:9000/processed/1733481234567-123456789-compressed.jpeg",
  "thumbnail_url": "http://localhost:9000/thumbnails/1733481234567-123456789-thumbnail.jpeg",
  "completed_at": "2025-12-06T07:00:05.000Z"
}
```

**Access the images**: Simply paste the URLs in your browser or use them directly in your application.

## 🧪 Testing the Application

### Test Flow

1. **Upload an image**:
```bash
curl -X POST http://localhost:3000/upload \
  -F "image=@/path/to/your/image.jpg"
```
Save the `upload_id` from the response.

2. **Check status immediately** (should be `pending` or `processing`):
```bash
curl http://localhost:3000/upload/<upload-id>/status
```

3. **Wait a few seconds** (processing time depends on image size).

4. **Check status again** (should be `completed`):
```bash
curl http://localhost:3000/upload/<upload-id>/status
```

5. **Get results**:
```bash
curl http://localhost:3000/upload/<upload-id>/result
```

6. **View processed images** in your browser using the returned Minio URLs.

### Using Swagger UI

1. Go to http://localhost:3000/api/docs
2. Click on `POST /upload`
3. Click "Try it out"
4. Choose a file
5. Click "Execute"
6. Copy the `upload_id` from the response
7. Use the other endpoints to check status and get results

### Using Minio Console

1. Go to http://localhost:9001
2. Login with `minioadmin` / `minioadmin123`
3. Click on "Buckets"
4. Browse `originals`, `processed`, and `thumbnails` buckets
5. View uploaded and processed images directly

## 📁 Project Structure
```
image-processor/
├── src/
│   ├── upload/
│   │   ├── upload.entity.ts       # Database entity with S3 URLs
│   │   ├── upload.service.ts      # Business logic
│   │   ├── upload.controller.ts   # API endpoints
│   │   ├── upload.module.ts       # Module configuration
│   │   ├── image.processor.ts     # Background worker
│   │   └── s3.service.ts          # S3/Minio integration
│   ├── app.module.ts              # Root module
│   └── main.ts                    # Application entry point
├── .env                           # Environment variables
├── package.json
└── README.md
```

## 🔍 How It Works

### Architecture Overview
```
┌─────────────┐
│   CLIENT    │
└──────┬──────┘
       │
       │ POST /upload (image in memory)
       ↓
┌─────────────────────────────────┐
│   UPLOAD CONTROLLER/SERVICE     │
│  1. Upload to Minio (originals) │
│  2. Create DB record (pending)  │
│  3. Add job to queue            │
│  4. Return upload_id instantly  │
└────────────┬────────────────────┘
             │
             ↓
      ┌──────────────┐
      │  REDIS QUEUE │ ← Job waits here
      └──────┬───────┘
             │
             │ Worker picks up job
             ↓
┌─────────────────────────────────┐
│   IMAGE PROCESSOR WORKER        │
│  1. Download from Minio         │
│  2. Process in memory           │
│     - Resize                    │
│     - Compress                  │
│     - Generate thumbnail        │
│  3. Upload results to Minio     │
│  4. Update DB with URLs         │
└─────────────────────────────────┘
```

### Processing Details

1. **Upload**: Files are uploaded directly to Minio's `originals` bucket from memory (no local disk writes)

2. **Background Processing**:
   - Worker downloads original from Minio
   - Processes images in memory using Sharp
   - Uploads processed images to respective Minio buckets
   
3. **Resize**: Images are resized to a maximum of 1920x1080 pixels while maintaining aspect ratio. Smaller images are not enlarged.

4. **Compress**: Images are compressed to 80% quality using JPEG compression, significantly reducing file size.

5. **Thumbnail**: A 200x200 pixel thumbnail is generated using cover fit (crops to fill the square).

6. **Storage**: All files are stored in Minio with public read access, accessible via direct URLs.

## 🐛 Troubleshooting

### Redis Connection Error

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution**: Ensure Redis is running:
```bash
docker ps  # Check if redis-queue is running
docker start redis-queue  # If not running
```

### Minio Connection Error

**Error**: `Error connecting to Minio` or `NetworkingError`

**Solution**: 
1. Check if Minio is running: `docker ps`
2. Verify Minio is accessible: `curl http://localhost:9000/minio/health/live`
3. Restart if needed: `docker restart minio`

### PostgreSQL Connection Error

**Error**: `password authentication failed`

**Solution**: 
1. Check your `.env` credentials match your PostgreSQL setup
2. Ensure PostgreSQL is running
3. Verify the database exists: `psql -U your_username -l`

### Buckets Not Found Error

**Error**: `The specified bucket does not exist`

**Solution**: Create the buckets in Minio console or via command:
```bash
docker exec minio mc alias set myminio http://localhost:9000 minioadmin minioadmin123
docker exec minio mc mb myminio/originals
docker exec minio mc mb myminio/processed
docker exec minio mc mb myminio/thumbnails
docker exec minio mc anonymous set download myminio/originals
docker exec minio mc anonymous set download myminio/processed
docker exec minio mc anonymous set download myminio/thumbnails
```

### Image Processing Fails

Check the logs for specific errors. Common issues:
- **Unsupported format**: Only jpg, jpeg, png, gif, webp are supported
- **File too large**: Maximum file size is 10MB
- **Corrupted image**: Ensure the uploaded file is a valid image
- **Memory issues**: Very large images might need more memory allocation

## 🛑 Stopping the Application

### Stop the NestJS server
Press `Ctrl+C` in the terminal

### Stop Docker containers
```bash
docker stop redis-queue minio
```

### Remove containers (optional)
```bash
docker rm redis-queue minio
```
