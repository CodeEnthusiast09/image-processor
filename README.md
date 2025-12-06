<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  # Image Processing Service

A NestJS-based backend service that handles image uploads and processes them asynchronously in the background. Images are resized, compressed, and thumbnails are generated using a queue-based worker system.

## 🚀 Features

- **Async Image Processing**: Upload images and receive instant response while processing happens in the background
- **Multiple Processing Operations**:
  - Resize (max 1920x1080, maintains aspect ratio)
  - Compress (80% quality)
  - Thumbnail generation (200x200, cover fit)
- **Job Queue System**: Uses Bull + Redis for reliable background job processing
- **Status Tracking**: Check processing status and retrieve results via REST API
- **PostgreSQL Database**: Persistent storage of upload metadata and processing status
- **Swagger Documentation**: Interactive API documentation at `/api/docs`
- **Structured Logging**: Professional logging using NestJS Logger

## 🛠️ Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL + TypeORM
- **Queue**: Bull (BullMQ) + Redis
- **Image Processing**: Sharp
- **File Upload**: Multer
- **API Documentation**: Swagger/OpenAPI
- **Language**: TypeScript

## 📋 Prerequisites

Before running this project, ensure you have:

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **PostgreSQL** (running locally or accessible remotely)
- **Docker** (for running Redis)

## 🔧 Installation

### 1. Clone the repository
```bash
git clone <your-repo-url>
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

### 4. Configure Environment Variables

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
```

**Replace the database credentials with your PostgreSQL configuration.**

### 5. Create PostgreSQL Database
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
  "original_url": "/uploads/original/my-image.jpg",
  "resized_url": "/uploads/processed/1765005321550-11259599-resized.jpeg",
  "compressed_url": "/uploads/processed/1765005321550-11259599-compressed.jpeg",
  "thumbnail_url": "/uploads/thumbnails/1765005321550-11259599-thumbnail.jpeg",
  "completed_at": "2025-12-06T07:00:05.000Z"
}
```

**Access the images**:
```
http://localhost:3000/uploads/processed/1765005321550-11259599-resized.jpeg
http://localhost:3000/uploads/processed/1765005321550-11259599-compressed.jpeg
http://localhost:3000/uploads/thumbnails/1765005321550-11259599-thumbnail.jpeg
```

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

6. **View processed images** in your browser using the URLs from step 5.

### Using Swagger UI

1. Go to http://localhost:3000/api/docs
2. Click on `POST /upload`
3. Click "Try it out"
4. Choose a file
5. Click "Execute"
6. Copy the `upload_id` from the response
7. Use the other endpoints to check status and get results

## 📁 Project Structure
```
image-processor/
├── src/
│   ├── upload/
│   │   ├── upload.entity.ts       # Database entity
│   │   ├── upload.service.ts      # Business logic
│   │   ├── upload.controller.ts   # API endpoints
│   │   ├── upload.module.ts       # Module configuration
│   │   └── image.processor.ts     # Background worker
│   ├── uploads/
│   │   ├── original/              # Original uploaded images
│   │   ├── processed/             # Resized and compressed images
│   │   └── thumbnails/            # Generated thumbnails
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
                │ POST /upload
                ↓
┌─────────────────────────────────┐
│   UPLOAD CONTROLLER/SERVICE     │
│  1. Save file to disk           │
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
│  1. Update status: processing   │
│  2. Resize image                │
│  3. Compress image              │
│  4. Generate thumbnail          │
│  5. Update status: completed    │
└─────────────────────────────────┘
```

### Processing Details

1. **Resize**: Images are resized to a maximum of 1920x1080 pixels while maintaining aspect ratio. Smaller images are not enlarged.

2. **Compress**: Images are compressed to 80% quality using JPEG compression, significantly reducing file size.

3. **Thumbnail**: A 200x200 pixel thumbnail is generated using cover fit (crops to fill the square).

## 🐛 Troubleshooting

### Redis Connection Error

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution**: Ensure Redis is running:
```bash
docker ps  # Check if redis-queue is running
docker start redis-queue  # If not running
```

### PostgreSQL Connection Error

**Error**: `password authentication failed`

**Solution**: 
1. Check your `.env` credentials match your PostgreSQL setup
2. Ensure PostgreSQL is running
3. Verify the database exists: `psql -U your_username -l`

### Upload Directory Not Found

**Error**: `ENOENT: no such file or directory`

**Solution**: Create upload directories:
```bash
mkdir -p src/uploads/original
mkdir -p src/uploads/processed
mkdir -p src/uploads/thumbnails
```

### Image Processing Fails

Check the logs for specific errors. Common issues:
- **Unsupported format**: Only jpg, jpeg, png, gif, webp are supported
- **File too large**: Maximum file size is 10MB
- **Corrupted image**: Ensure the uploaded file is a valid image

## 🛑 Stopping the Application

### Stop the NestJS server
Press `Ctrl+C` in the terminal

### Stop Redis
```bash
docker stop redis-queue
```

### Stop PostgreSQL (if using Docker)
```bash
docker stop postgres-db
```

### Remove containers (optional)
```bash
docker rm redis-queue
docker rm postgres-db  # if applicable
```

