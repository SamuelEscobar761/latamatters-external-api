import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ExternalApiController } from './external-api.controller';
import { ExternalApiService } from './external-api.service';
import { AuditLogService } from './services/audit-log.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

describe('ExternalApiController', () => {
  let controller: ExternalApiController;
  let externalApiService: jest.Mocked<ExternalApiService>;
  let auditLogService: jest.Mocked<AuditLogService>;

  const mockRequest = {
    ip: '192.168.1.100',
    user: { id: 1, clientName: 'Acme Corp' },
  };

  const mockDataResponse = {
    status: 'success',
    metadata: { total_records: 2, generated_at: '2026-02-25T14:00:00Z' },
    data: [
      {
        country_code: 'CO',
        variable_name: 'Natural_Gas_Production',
        version_id: 10,
        last_updated: '2026-02-23T10:30:00Z',
        rows: [
          { Basin: 'Llanos', Production_Volume_McfD: 520000 },
        ],
      },
    ],
  };

  const mockFilesResponse = {
    status: 'success',
    data: {
      files: [
        {
          country_code: 'MX',
          last_updated: '2026-02-24T09:15:00Z',
          download_url: 'https://s3.aws.com/MX.xlsx?Expires=...',
          expires_in_hours: 24,
        },
      ],
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExternalApiController],
      providers: [
        {
          provide: ExternalApiService,
          useValue: {
            getNestedData: jest.fn(),
            getPreSignedUrls: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = mockRequest.user;
          return true;
        },
      })
      .compile();

    controller = module.get<ExternalApiController>(ExternalApiController);
    externalApiService = module.get(ExternalApiService);
    auditLogService = module.get(AuditLogService);
  });

  /**
   * T1 — Happy Path: GET /api/v1/data con país y variable válidos
   * Flujo: Guard pasa → controller llama service.getNestedData → loguea EXTERNAL_DATA_ACCESS → retorna data
   */
  it('T1: should return structured data and log EXTERNAL_DATA_ACCESS on success', async () => {
    externalApiService.getNestedData.mockResolvedValue(mockDataResponse as any);

    const result = await controller.getData(
      { country: 'CO', variable: 'Natural_Gas_Production' },
      mockRequest as any,
    );

    expect(externalApiService.getNestedData).toHaveBeenCalledWith({
      country: 'CO',
      variable: 'Natural_Gas_Production',
    });
    expect(auditLogService.log).toHaveBeenCalledWith({
      action: 'EXTERNAL_DATA_ACCESS',
      ipAddress: '192.168.1.100',
      details: expect.objectContaining({ clientName: 'Acme Corp', query: expect.any(Object) }),
    });
    expect(result).toEqual(mockDataResponse);
  });

  /**
   * T12 — Audit Happy Path: request exitoso loguea con IP y clientName
   * Flujo: service retorna OK → auditLogService.log llamado con action=EXTERNAL_DATA_ACCESS, ip_address, details
   */
  it('T12: should call auditLogService with correct action and ip on successful data request', async () => {
    externalApiService.getNestedData.mockResolvedValue(mockDataResponse as any);

    await controller.getData({ country: 'CO' }, mockRequest as any);

    expect(auditLogService.log).toHaveBeenCalledTimes(1);
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXTERNAL_DATA_ACCESS',
        ipAddress: '192.168.1.100',
      }),
    );
  });

  /**
   * T — Happy Path files: GET /api/v1/files/download retorna pre-signed URLs
   */
  it('should return pre-signed URLs and log audit on files download', async () => {
    externalApiService.getPreSignedUrls.mockResolvedValue(mockFilesResponse as any);

    const result = await controller.downloadFiles('MX', mockRequest as any);

    expect(externalApiService.getPreSignedUrls).toHaveBeenCalledWith('MX');
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'EXTERNAL_FILE_DOWNLOAD',
        ipAddress: '192.168.1.100',
      }),
    );
    expect(result).toEqual(mockFilesResponse);
  });
});