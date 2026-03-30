import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

/**
 * Payload required to register an external API audit event.
 */
export interface AuditLogPayload {
  action: string;
  userId?: string | null;
  countryId?: string | null;
  ipAddress: string;
  details: string;
}

/**
 * Records external API access events in the AUDIT_LOGS table.
 * Tracks which external client accessed what data and from which IP.
 */
@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Persists an audit event for an external API request.
   * @param payload - Action identifier, user ID, country ID, originating IP and contextual details.
   */
  async log(payload: AuditLogPayload): Promise<void> {
    const entry = this.auditLogRepository.create({
      action: payload.action,
      userId: payload.userId ?? null,
      countryId: payload.countryId ?? null,
      ipAddress: payload.ipAddress,
      details: payload.details,
    });

    await this.auditLogRepository.save(entry);
  }
}
