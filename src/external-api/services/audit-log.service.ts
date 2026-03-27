import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * Payload required to register an external API audit event.
 */
export interface AuditLogPayload {
  action: string;
  ipAddress: string;
  details: Record<string, unknown>;
}

/**
 * Records external API access events in the AUDIT_LOGS table.
 * Satisfies US-35 AC-3: traceability of who extracts data and from which IP.
 */
@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Persists an audit event for an external API request.
   * @param payload - Action identifier, originating IP and contextual details.
   */
  async log(payload: AuditLogPayload): Promise<void> {
    const entry = this.auditLogRepository.create({
      action: payload.action,
      ipAddress: payload.ipAddress,
      details: JSON.stringify(payload.details),
      userId: null,
      countryId: null,
    });

    await this.auditLogRepository.save(entry);
  }
}
