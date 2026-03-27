import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Maps to the SHEET_ROWS table. Contains the actual data cells
 * in a flexible JSONB column. Read-only access via external API.
 */
@Entity('sheet_rows')
export class SheetRow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sheet_id' })
  sheetId: number;

  @Column({ name: 'version_id' })
  versionId: number;

  @Column({ name: 'row_index' })
  rowIndex: number;

  @Column({ name: 'row_hash' })
  rowHash: string;

  @Column({ type: 'jsonb' })
  data: Record<string, unknown>;
}