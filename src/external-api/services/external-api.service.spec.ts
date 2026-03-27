import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { ExternalApiService } from '../external-api.service';
import { Version } from '../entities/version.entity';
import { SheetRow } from '../entities/sheet-row.entity';
import { Sheet } from '../entities/sheet.entity';

/**
 * Mock factory for the S3 pre-signer.
 * Allows controlling success/failure per test.
 */
const mockGetSignedUrl = jest.fn();
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  GetObjectCommand: jest.fn().mockImplementation((input) => input),
}));

describe('ExternalApiService', () => {
  let service: ExternalApiService;
  let versionRepo: any;
  let sheetRowRepo: any;
  let sheetRepo: any;

  const approvedVersionCO: Version = {
    id: 10,
    countryId: 1,
    countryCode: 'CO',
    status: 'Approved',
    s3Path: 'approved/CO/v10.xlsx',
    createdAt: new Date('2026-02-23T10:30:00Z'),
    approvedAt: new Date('2026-02-23T11:00:00Z'),
  } as Version;

  const approvedVersionMX: Version = {
    id: 11,
    countryId: 2,
    countryCode: 'MX',
    status: 'Approved',
    s3Path: 'approved/MX/v11.xlsx',
    createdAt: new Date('2026-02-24T09:15:00Z'),
    approvedAt: new Date('2026-02-24T10:00:00Z'),
  } as Version;

  const sheetNaturalGas: Sheet = {
    id: 5,
    countryId: 1,
    name: 'Natural_Gas_Production',
    originalIndex: 0,
  } as Sheet;

  const sheetRows = [
    { id: 1, sheetId: 5, versionId: 10, rowIndex: 0, rowHash: 'h1', data: { Basin: 'Llanos', Production_Volume_McfD: 520000 } },
    { id: 2, sheetId: 5, versionId: 10, rowIndex: 1, rowHash: 'h2', data: { Basin: 'Guajira', Production_Volume_McfD: 285000 } },
  ];

  beforeEach(async () => {
    mockGetSignedUrl.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExternalApiService,
        { provide: getRepositoryToken(Version), useValue: { createQueryBuilder: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(SheetRow), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(Sheet), useValue: { findOne: jest.fn() } },
      ],
    }).compile();

    service = module.get<ExternalApiService>(ExternalApiService);
    versionRepo = module.get(getRepositoryToken(Version));
    sheetRowRepo = module.get(getRepositoryToken(SheetRow));
    sheetRepo = module.get(getRepositoryToken(Sheet));
  });

  // ─── Suite: getNestedData ────────────────────────────────────────────────

  /**
   * T1 — Happy Path: GET data con país y variable válidos + versión aprobada en BD
   * Flujo:
   *   1. versionRepo.createQueryBuilder → versión Approved más reciente para CO
   *   2. sheetRepo.findOne → Sheet 'Natural_Gas_Production' para country_id=1
   *   3. sheetRowRepo.find → rows de esa versión y sheet
   *   4. Respuesta estructurada con metadata y data[]
   */
  it('T1: should return structured data for approved version of given country and variable', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(approvedVersionCO),
    };
    versionRepo.createQueryBuilder.mockReturnValue(qb);
    sheetRepo.findOne.mockResolvedValue(sheetNaturalGas);
    sheetRowRepo.find.mockResolvedValue(sheetRows);

    const result = await service.getNestedData({ country: 'CO', variable: 'Natural_Gas_Production' });

    expect(result.status).toBe('success');
    expect(result.metadata.total_records).toBe(2);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].country_code).toBe('CO');
    expect(result.data[0].variable_name).toBe('Natural_Gas_Production');
    expect(result.data[0].rows).toHaveLength(2);
  });

  /**
   * T4 — Fallo 3: País sin versión Approved en BD
   * Flujo:
   *   1. versionRepo.createQueryBuilder → getOne() → null (no hay versión aprobada para VE)
   *   2. Lanza NotFoundException
   */
  it('T4: should throw NotFoundException when country has no approved version', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    versionRepo.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.getNestedData({ country: 'VE' }),
    ).rejects.toThrow(NotFoundException);
  });

  // ─── Suite: getPreSignedUrls ─────────────────────────────────────────────

  /**
   * T9 — Happy Path: descarga masiva sin country → retorna todos los países aprobados
   * Flujo:
   *   1. versionRepo.find → [approvedVersionCO, approvedVersionMX]
   *   2. getSignedUrl × 2 → URLs con expiración 24h
   *   3. Retorna array con 2 entries
   */
  it('T9: should return pre-signed URLs for all approved countries when no country is specified', async () => {
    versionRepo.find.mockResolvedValue([approvedVersionCO, approvedVersionMX]);
    mockGetSignedUrl
      .mockResolvedValueOnce('https://s3.aws.com/CO.xlsx?Expires=...')
      .mockResolvedValueOnce('https://s3.aws.com/MX.xlsx?Expires=...');

    const result = await service.getPreSignedUrls();

    expect(result.status).toBe('success');
    expect(result.data.files).toHaveLength(2);
    expect(result.data.files[0].country_code).toBe('CO');
    expect(result.data.files[0].expires_in_hours).toBe(24);
    expect(result.data.files[1].country_code).toBe('MX');
  });

  /**
   * T10 — Fallo 1: país específico sin versión Approved
   * Flujo:
   *   1. versionRepo.createQueryBuilder → getOne() → null (AR no tiene versión aprobada)
   *   2. Lanza NotFoundException
   */
  it('T10: should throw NotFoundException when specified country has no approved version for download', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    versionRepo.createQueryBuilder.mockReturnValue(qb);

    await expect(service.getPreSignedUrls('AR')).rejects.toThrow(
      new NotFoundException('No approved version found for country: AR'),
    );
  });

  /**
   * T11 — Fallo 2: S3 falla al generar pre-signed URL
   * Flujo:
   *   1. versionRepo.createQueryBuilder → getOne() → approvedVersionMX
   *   2. getSignedUrl → lanza error
   *   3. Service captura y lanza InternalServerErrorException
   */
  it('T11: should throw InternalServerErrorException when S3 pre-sign fails', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(approvedVersionMX),
    };
    versionRepo.createQueryBuilder.mockReturnValue(qb);
    mockGetSignedUrl.mockRejectedValue(new Error('S3 connection refused'));

    await expect(service.getPreSignedUrls('MX')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
