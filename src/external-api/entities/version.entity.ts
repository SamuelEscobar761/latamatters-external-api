import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

/**
 * Maps to the VERSIONS table. Only versions with status='Approved' are
 * exposed through the external API endpoints.
 */
@Entity('versions')
export class Version {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'country_id', type: 'uuid' })
  countryId: string;

  /**
   * Denormalized country code (alpha-2) joined from COUNTRIES table.
   * Populated via QueryBuilder joins, not stored in this column.
   */
  countryCode?: string;

  @Column({ type: 'varchar' })
  status: string;

  @Column({ name: 's3_path', type: 'varchar' })
  s3Path: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;
}