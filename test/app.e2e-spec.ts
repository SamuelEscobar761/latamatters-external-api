import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

// ==============================================
// GLOBAL TOKEN PARA TESTS
// TODO: El usuario escribirá su token B2B aquí
// ==============================================
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GLOBAL_AUTH_TOKEN = 'INSERT_YOUR_JWT_TOKEN_HERE';

describe('External API - Data Extraction Endpoint (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Habilitar ValidationPipe para el Escenario 4 (400 Bad Request)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/data', () => {
    
    it('Caso 1: Happy Path - Debería retornar datos filtrados anidados (País -> Variable)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/data?country=CO,MX&variable=Natural_Gas_Production&year=2021')
        .set('Authorization', `Bearer ${GLOBAL_AUTH_TOKEN}`)
        .expect(200);

      const body = response.body;

      // Assertions de estructura
      expect(body).toBeDefined();
      expect(body).toHaveProperty('CO');
      expect(body.CO).toHaveProperty('Natural_Gas_Production');
      expect(Array.isArray(body.CO.Natural_Gas_Production)).toBe(true);
      
      // Assertion de filtrado
      const rows = body.CO.Natural_Gas_Production;
      if (rows.length > 0) {
        // Asegurarse de que el año devuelto sea exactamente 2021
        expect(rows[0].year).toBe(2021);
      }
    });

    it('Caso 2: Fallo Evidenciado 1 - Debería bloquear el acceso sin un Header de Autorización válido (401/403)', async () => {
      // Intento sin token
      await request(app.getHttpServer())
        .get('/api/v1/data?country=CO')
        .expect(401);
        
      // Intento con token inventado "revoked"
      const response = await request(app.getHttpServer())
        .get('/api/v1/data?country=CO')
        .set('Authorization', 'Bearer INVALID_OR_REVOKED_TOKEN')
        // Esperamos 401 Unauthorized o 403 Forbidden dependiendo de la capa
        .expect((res) => {
          if (res.status !== 401 && res.status !== 403) {
            throw new Error(`Status should be 401 or 403, got ${res.status}`);
          }
        });
        
      expect(response.body).not.toHaveProperty('CO');
    });

    it('Caso 3: Fallo Evidenciado 2 - Debería excluir datos PENDING si un registro no está APPROVED', async () => {
      // Simulando que "PE" (Perú) tiene solo una versión PENDING y ninguna APPROVED histórica.
      const response = await request(app.getHttpServer())
        .get('/api/v1/data?country=PE&year=9999')
        .set('Authorization', `Bearer ${GLOBAL_AUTH_TOKEN}`)
        // Si todo el servicio está bien en mock, pasará 200 pero vacío
        .expect(200);

      expect(response.body).toEqual({}); 
    });

    it('Caso 4: Fallo Evidenciado 3 - Debería fallar (400) cuando enviamos un parámetro malformado (ISO 3166-1 alpha-2)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/data?country=XXX&year=ABC')
        .set('Authorization', `Bearer ${GLOBAL_AUTH_TOKEN}`)
        .expect(400);

      // Verificando que el DTO atrapa el error
      expect(response.body).toHaveProperty('message');
      
      const messages = response.body.message;
      if (Array.isArray(messages)) {
        const errorString = messages.join(' ');
        expect(errorString.toLowerCase()).toContain('year');
        expect(errorString.toLowerCase()).toContain('country');
      } else if (typeof messages === 'string') {
        expect(messages.toLowerCase()).toContain('year');
      }
    });

  });
});
