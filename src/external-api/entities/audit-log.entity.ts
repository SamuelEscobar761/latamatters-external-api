import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Maps to the AUDIT_LOGS table. External API access events are recorded
 * here with action, ip_address, and JSON details for legal traceability.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', nullable: true })
  userId: number | null;

  @Column({ name: 'country_id', nullable: true })
  countryId: number | null;

  @Column()
  action: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  details: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
