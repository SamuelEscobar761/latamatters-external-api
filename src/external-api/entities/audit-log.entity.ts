import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Maps to the AUDIT_LOGS table. External API access events are recorded
 * here with action, ip_address, and JSON details for legal traceability.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'country_id', type: 'uuid', nullable: true })
  countryId: string | null;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
