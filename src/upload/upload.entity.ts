import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('uploads')
export class Upload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  original_name: string;

  @Column()
  original_path: string; // Now stores S3 key/filename

  @Column({ type: 'varchar', nullable: true })
  original_url: string; // ← ADD: S3 public URL

  @Column({ type: 'varchar', default: 'pending' })
  status: string; // 'pending', 'processing', 'completed', 'failed'

  @Column({ type: 'varchar', nullable: true })
  resized_path: string; // S3 key

  @Column({ type: 'varchar', nullable: true })
  resized_url: string; // ← ADD: S3 public URL

  @Column({ type: 'varchar', nullable: true })
  compressed_path: string; // S3 key

  @Column({ type: 'varchar', nullable: true })
  compressed_url: string; // ← ADD: S3 public URL

  @Column({ type: 'varchar', nullable: true })
  thumbnail_path: string; // S3 key

  @Column({ type: 'varchar', nullable: true })
  thumbnail_url: string; // ← ADD: S3 public URL

  @Column({ type: 'text', nullable: true })
  error: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;
}
