import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Represents an institutional API client registered in the system.
 * Maps to the EXTERNAL_API_KEYS table defined in the database schema.
 */
@Entity('external_api_keys')
export class ExternalApiKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'client_name' })
  clientName: string;

  @Column({ name: 'api_key_hash' })
  apiKeyHash: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
