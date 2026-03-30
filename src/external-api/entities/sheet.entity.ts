import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Maps to the SHEETS table. Defines the structure (variable) of each
 * spreadsheet tab per country. Used to filter data by variable name.
 */
@Entity('sheets')
export class Sheet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'country_id', type: 'uuid' })
  countryId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ name: 'original_index', type: 'int', default: 0 })
  originalIndex: number;

  @Column({ name: 'extraction_schema', type: 'jsonb', nullable: true })
  extractionSchema: object | null;
}