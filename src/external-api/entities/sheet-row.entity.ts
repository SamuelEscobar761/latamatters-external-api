import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Maps to the SHEET_ROWS table. Contains the actual data cells
 * in a flexible JSONB column. Read-only access via external API.
 */
@Entity('sheet_rows')
export class SheetRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sheet_id', type: 'uuid' })
  sheetId: string;

  @Column({ name: 'version_id', type: 'uuid' })
  versionId: string;

  @Column({ name: 'row_index', type: 'int' })
  rowIndex: number;

  @Column({ name: 'row_hash', type: 'varchar' })
  rowHash: string;

  @Column({ type: 'jsonb' })
  data: object;

  @Column({ type: 'varchar', nullable: true })
  operation: string | null;
}