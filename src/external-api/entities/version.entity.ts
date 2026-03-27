import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

/**
 * Maps to the VERSIONS table. Only versions with status='Approved' are
 * exposed through the external API endpoints.
 */
@Entity('versions')
export class Version {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'country_id' })
  countryId: number;

  /**
   * Denormalized country code (alpha-2) joined from COUNTRIES table.
   * Populated via QueryBuilder joins, not stored in this column.
   */
  countryCode?: string;

  @Column()
  status: string;

  @Column({ name: 's3_path' })
  s3Path: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'approved_at', nullable: true })
  approvedAt: Date;
}