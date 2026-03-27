import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Maps to the SHEETS table. Defines the structure (variable) of each
 * spreadsheet tab per country. Used to filter data by variable name.
 */
@Entity('sheets')
export class Sheet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'country_id' })
  countryId: number;

  @Column()
  name: string;

  @Column({ name: 'original_index' })
  originalIndex: number;
}