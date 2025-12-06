export interface UploadResult {
  id: string;
  original_name: string | null;
  status: string;
  original_url: string;
  resized_url: string | null;
  compressed_url: string | null;
  thumbnail_url: string | null;
  completed_at: Date | null;
}

export interface ImageProcessingJob {
  uploadId: string;
  filePath: string;
  s3FileName: string;
  bucketName: string;
}
