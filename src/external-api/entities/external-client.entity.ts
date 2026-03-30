import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { Country } from './country.entity';

/**
 * Represents an external API client with API key authentication.
 * Maps to the EXTERNAL_CLIENTS table.
 */
@Entity('external_clients')
export class ExternalClient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_name', type: 'varchar' })
  companyName: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ name: 'api_key_hash', type: 'varchar' })
  apiKeyHash: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'request_count', type: 'int', default: 0 })
  requestCount: number;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @ManyToMany(() => Country)
  @JoinTable({
    name: 'external_client_countries',
    joinColumn: { name: 'external_client_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'country_id', referencedColumnName: 'id' },
  })
  countries: Country[];
}
