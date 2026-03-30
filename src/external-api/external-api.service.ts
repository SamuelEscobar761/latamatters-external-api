import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetDataDto } from './dto/get-data.dto';
import { Version } from './entities/version.entity';
import { Sheet } from './entities/sheet.entity';
import { SheetRow } from './entities/sheet-row.entity';
import { ExternalClient } from './entities/external-client.entity';
import { Country } from './entities/country.entity';

const PRESIGNED_URL_EXPIRY_SECONDS = 86400;

/**
 * Core service for the external API. Reads exclusively from APPROVED versions.
 * Integrates with AWS S3 for pre-signed download URLs.
 */
@Injectable()
export class ExternalApiService {
  private readonly s3Client: S3Client | null;
  private readonly bucketName: string;

  constructor(
    @InjectRepository(Version)
    private readonly versionRepository: Repository<Version>,
    @InjectRepository(Sheet)
    private readonly sheetRepository: Repository<Sheet>,
    @InjectRepository(SheetRow)
    private readonly sheetRowRepository: Repository<SheetRow>,
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) {
    // Initialize S3 client only if AWS configuration is provided
    const awsRegion = process.env.AWS_REGION;
    const awsBucket = process.env.S3_BUCKET;

    if (awsRegion && awsBucket) {
      this.s3Client = new S3Client({ region: awsRegion });
      this.bucketName = awsBucket;
    } else {
      this.s3Client = null;
      this.bucketName = '';
      console.log('[ExternalApiService] S3 not configured - file download URLs will not be available');
    }
  }

  /**
   * Returns structured JSON data from the most recent Approved version.
   * Data is filtered by the countries the client has access to.
   * @param query - Optional country and variable filters from query params.
   * @param client - The authenticated external client
   * @throws ForbiddenException when client doesn't have access to requested country.
   * @throws NotFoundException when no approved version exists for the given country.
   */
  async getNestedData(query: GetDataDto, client: ExternalClient) {
    const targetCountry = query.country ? query.country.split(',')[0] : null;

    // Get client's authorized country IDs
    const authorizedCountryIds = client.countries.map(c => c.id);

    // Determine which versions to process
    let versions: Version[];

    if (targetCountry) {
      // Case 1: Specific country requested
      const version = await this.findLatestApprovedVersion(targetCountry, authorizedCountryIds);

      if (!version) {
        // Check if the country exists and client just doesn't have access
        const country = await this.countryRepository.findOne({ where: { code: targetCountry } });
        if (country && !authorizedCountryIds.includes(country.id)) {
          throw new ForbiddenException(
            `You do not have access to country: ${targetCountry}`,
          );
        }
        throw new NotFoundException(
          `No approved version found for country: ${targetCountry}`,
        );
      }

      versions = [version];
    } else {
      // Case 2: No country specified - get ALL authorized countries
      versions = await this.findAllLatestApprovedVersions(authorizedCountryIds);

      if (versions.length === 0) {
        throw new NotFoundException(
          'No approved versions found for any authorized country',
        );
      }
    }

    // Process each version (country)
    const allDataArrays = await Promise.all(
      versions.map(async (version) => {
        // Build filter for sheets
        const sheetFilter: Record<string, unknown> = { countryId: version.countryId };
        if (query.variable) {
          sheetFilter['name'] = query.variable;
        }

        // Get ALL sheets for this country (or just one if variable is specified)
        const sheets = await this.sheetRepository.find({
          where: sheetFilter as any,
          order: { originalIndex: 'ASC' }, // Preserve original Excel sheet order
        });

        if (sheets.length === 0) {
          // This country has no sheets, return empty array (continue with other countries)
          return [];
        }

        // Process each sheet and get its rows
        const dataArray = await Promise.all(
          sheets.map(async (sheet) => {
            // Query with correct filters: exclude DELETED rows and empty data
            const rows = await this.sheetRowRepository
              .createQueryBuilder('row')
              .where('row.versionId = :versionId', { versionId: version.id })
              .andWhere('row.sheetId = :sheetId', { sheetId: sheet.id })
              .andWhere("row.operation != 'DELETED'")          // Exclude DELETED rows
              .andWhere("jsonb_typeof(row.data) = 'object'")  // Ensure data is an object
              .andWhere("row.data != '{}'::jsonb")             // Exclude empty objects
              .orderBy('row.rowIndex', 'ASC')
              .getMany();

            // Extract column order from extraction schema
            const extractionSchema = sheet.extractionSchema as any;
            const columnOrder = extractionSchema?.columnOrder || null;

            return {
              country_code: version.countryCode,
              variable_name: sheet.name,
              version_id: version.id,
              last_updated: version.approvedAt?.toISOString() ?? version.createdAt.toISOString(),
              column_order: columnOrder,
              rows: rows.map((r) => this.orderObjectBySchema(r.data, sheet.extractionSchema)),
            };
          }),
        );

        return dataArray;
      }),
    );

    // Flatten array of arrays into single array
    const flattenedData = allDataArrays.flat();

    // Calculate total records across all countries and sheets
    const totalRecords = flattenedData.reduce((sum, dataset) => sum + dataset.rows.length, 0);

    return {
      status: 'success',
      metadata: {
        total_records: totalRecords,
        generated_at: new Date().toISOString(),
      },
      data: flattenedData,
    };
  }

  /**
   * Generates pre-signed S3 URLs (24h expiry) for approved Excel files.
   * Only returns URLs for countries the client has access to.
   * @param country - Optional alpha-2 country code for single-country download.
   * @param client - The authenticated external client
   * @throws ForbiddenException when client doesn't have access to requested country.
   * @throws NotFoundException when no approved version exists for the given country.
   * @throws InternalServerErrorException when S3 pre-signing fails.
   */
  async getPreSignedUrls(country: string | undefined, client: ExternalClient) {
    const authorizedCountryIds = client.countries.map(c => c.id);

    if (country) {
      const version = await this.findLatestApprovedVersion(country, authorizedCountryIds);

      if (!version) {
        // Check if the country exists and client just doesn't have access
        const countryEntity = await this.countryRepository.findOne({ where: { code: country } });
        if (countryEntity && !authorizedCountryIds.includes(countryEntity.id)) {
          throw new ForbiddenException(
            `You do not have access to country: ${country}`,
          );
        }
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

    // Get approved versions only for client's authorized countries
    const approvedVersions = await this.versionRepository.find({
      where: {
        status: 'Approved',
        countryId: In(authorizedCountryIds),
      },
    });

    const files = await Promise.all(
      approvedVersions.map(async (v) => {
        const url = await this.generatePresignedUrl(v.s3Path);
        const country = client.countries.find(c => c.id === v.countryId);
        return {
          country_code: country?.code ?? 'UNKNOWN',
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
   * Filters by authorized country IDs to enforce client permissions.
   * @param countryCode - Alpha-2 country code, or null to get any approved version.
   * @param authorizedCountryIds - Array of country UUIDs the client has access to.
   * @returns The most recent Approved Version joined with country code, or null.
   */
  private async findLatestApprovedVersion(
    countryCode: string | null,
    authorizedCountryIds: string[],
  ): Promise<Version | null> {
    const qb = this.versionRepository
      .createQueryBuilder('v')
      .innerJoin('countries', 'c', 'c.id = v.country_id')
      .where('v.status = :status', { status: 'Approved' })
      .andWhere('v.country_id IN (:...authorizedIds)', { authorizedIds: authorizedCountryIds })
      .orderBy('v.approved_at', 'DESC');

    if (countryCode) {
      qb.andWhere('c.code = :code', { code: countryCode });
    }

    const version = await qb.getOne();

    if (version) {
      // Get the country code from the authorized countries list
      const country = await this.countryRepository.findOne({ where: { id: version.countryId } });
      if (country) {
        version.countryCode = country.code;
      }
    }

    return version;
  }

  /**
   * Queries the most recent Approved version for EACH authorized country.
   * Used when client doesn't specify a country to get data from all authorized countries.
   * @param authorizedCountryIds - Array of country UUIDs the client has access to.
   * @returns Array of the most recent Approved Version for each country.
   */
  private async findAllLatestApprovedVersions(
    authorizedCountryIds: string[],
  ): Promise<Version[]> {
    // Get all Approved versions for authorized countries
    const versions = await this.versionRepository
      .createQueryBuilder('v')
      .innerJoin('countries', 'c', 'c.id = v.country_id')
      .where('v.status = :status', { status: 'Approved' })
      .andWhere('v.country_id IN (:...authorizedIds)', { authorizedIds: authorizedCountryIds })
      .orderBy('v.country_id', 'ASC')
      .addOrderBy('v.approved_at', 'DESC')
      .getMany();

    // Group by country and take only the most recent for each
    const latestByCountry = new Map<string, Version>();

    for (const version of versions) {
      if (!latestByCountry.has(version.countryId)) {
        latestByCountry.set(version.countryId, version);
      }
    }

    // Enrich with country code
    const result = await Promise.all(
      Array.from(latestByCountry.values()).map(async (version) => {
        const country = await this.countryRepository.findOne({ where: { id: version.countryId } });
        if (country) {
          version.countryCode = country.code;
        }
        return version;
      }),
    );

    return result;
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

  /**
   * Orders object properties according to the columnOrder from extraction schema.
   * This preserves the left-to-right column order from the original Excel file.
   *
   * @param rowData - Object with row data (properties may be in any order)
   * @param extractionSchema - Schema from sheets table containing columnOrder array
   * @returns Object with properties ordered according to schema
   */
  private orderObjectBySchema(rowData: any, extractionSchema: any): any {
    // If no schema or columnOrder, return as-is
    if (!extractionSchema || !Array.isArray(extractionSchema.columnOrder)) {
      return rowData;
    }

    const columnOrder = extractionSchema.columnOrder as string[];
    const orderedObj: Record<string, any> = {};

    // Extract top-level column names (before first ' > ' for hierarchical columns)
    const topLevelColumns = columnOrder.map(col => col.split(' > ')[0]);
    const uniqueTopLevel = [...new Set(topLevelColumns)];

    // Step 1: Add properties in the order defined by columnOrder (top-level)
    for (const topLevelCol of uniqueTopLevel) {
      if (rowData.hasOwnProperty(topLevelCol)) {
        orderedObj[topLevelCol] = rowData[topLevelCol];
      }
    }

    // Step 2: Add any remaining properties not in columnOrder (safety fallback)
    for (const key in rowData) {
      if (!orderedObj.hasOwnProperty(key)) {
        orderedObj[key] = rowData[key];
      }
    }

    return orderedObj;
  }
}
