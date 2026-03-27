import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetDataDto } from './dto/get-data.dto';
import { Version } from './entities/version.entity';
import { Sheet } from './entities/sheet.entity';
import { SheetRow } from './entities/sheet-row.entity';

const PRESIGNED_URL_EXPIRY_SECONDS = 86400;

/**
 * Core service for the external API. Reads exclusively from APPROVED versions.
 * Integrates with AWS S3 for pre-signed download URLs.
 */
@Injectable()
export class ExternalApiService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(
    @InjectRepository(Version)
    private readonly versionRepository: Repository<Version>,
    @InjectRepository(Sheet)
    private readonly sheetRepository: Repository<Sheet>,
    @InjectRepository(SheetRow)
    private readonly sheetRowRepository: Repository<SheetRow>,
  ) {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION ?? 'us-east-1',
    });
    this.bucketName = process.env.AWS_S3_BUCKET ?? '';
  }

  /**
   * Returns structured JSON data from the most recent Approved version.
   * Supports optional filtering by country (alpha-2) and variable (sheet name).
   * @param query - Optional country and variable filters from query params.
   * @throws NotFoundException when no approved version exists for the given country.
   */
  async getNestedData(query: GetDataDto) {
    const targetCountry = query.country ? query.country.split(',')[0] : null;

    const version = await this.findLatestApprovedVersion(targetCountry);

    if (!version) {
      throw new NotFoundException(
        `No approved version found for country: ${targetCountry ?? 'any'}`,
      );
    }

    const sheetFilter: Record<string, unknown> = { countryId: version.countryId };
    if (query.variable) {
      sheetFilter['name'] = query.variable;
    }

    const sheet = await this.sheetRepository.findOne({ where: sheetFilter as any });

    if (!sheet) {
      throw new NotFoundException(
        `Variable '${query.variable}' not found for country ${version.countryCode}`,
      );
    }

    const rows = await this.sheetRowRepository.find({
      where: { versionId: version.id, sheetId: sheet.id },
      order: { rowIndex: 'ASC' },
    });

    return {
      status: 'success',
      metadata: {
        total_records: rows.length,
        generated_at: new Date().toISOString(),
      },
      data: [
        {
          country_code: version.countryCode,
          variable_name: sheet.name,
          version_id: version.id,
          last_updated: version.approvedAt?.toISOString() ?? version.createdAt.toISOString(),
          rows: rows.map((r) => r.data),
        },
      ],
    };
  }

  /**
   * Generates pre-signed S3 URLs (24h expiry) for approved Excel files.
   * If no country is specified, returns URLs for all approved countries.
   * @param country - Optional alpha-2 country code for single-country download.
   * @throws NotFoundException when no approved version exists for the given country.
   * @throws InternalServerErrorException when S3 pre-signing fails.
   */
  async getPreSignedUrls(country?: string) {
    if (country) {
      const version = await this.findLatestApprovedVersion(country);

      if (!version) {
        throw new NotFoundException(
          `No approved version found for country: ${country}`,
        );
      }

      const url = await this.generatePresignedUrl(version.s3Path);

      return {
        status: 'success',
        data: {
          files: [
            {
              country_code: version.countryCode,
              last_updated: version.approvedAt?.toISOString() ?? version.createdAt.toISOString(),
              download_url: url,
              expires_in_hours: 24,
            },
          ],
        },
      };
    }

    const approvedVersions = await this.versionRepository.find({
      where: { status: 'Approved' },
    });

    const files = await Promise.all(
      approvedVersions.map(async (v) => {
        const url = await this.generatePresignedUrl(v.s3Path);
        return {
          country_code: v.countryCode,
          last_updated: v.approvedAt?.toISOString() ?? v.createdAt.toISOString(),
          download_url: url,
          expires_in_hours: 24,
        };
      }),
    );

    return { status: 'success', data: { files } };
  }

  /**
   * Queries the most recent Approved version for a given country code.
   * @param countryCode - Alpha-2 country code, or null to get any approved version.
   * @returns The most recent Approved Version joined with country code, or null.
   */
  private async findLatestApprovedVersion(countryCode: string | null): Promise<Version | null> {
    const qb = this.versionRepository
      .createQueryBuilder('v')
      .innerJoin('countries', 'c', 'c.id = v.country_id')
      .where('v.status = :status', { status: 'Approved' })
      .orderBy('v.approved_at', 'DESC');

    if (countryCode) {
      qb.andWhere('c.code = :code', { code: countryCode });
    }

    const version = await qb.getOne();

    if (version && countryCode) {
      version.countryCode = countryCode;
    }

    return version;
  }

  /**
   * Issues a pre-signed GET URL valid for 24 hours for the given S3 object key.
   * @param s3Key - The object path within the configured S3 bucket.
   * @throws InternalServerErrorException if the S3 signing operation fails.
   */
  private async generatePresignedUrl(s3Key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      return await getSignedUrl(this.s3Client, command, {
        expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
      });
    } catch {
      throw new InternalServerErrorException(
        'Internal server error generating pre-signed URL',
      );
    }
  }
}
