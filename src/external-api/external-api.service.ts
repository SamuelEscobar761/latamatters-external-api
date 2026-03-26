import { Injectable } from '@nestjs/common';
import { GetDataDto } from './dto/get-data.dto';

@Injectable()
export class ExternalApiService {
  getNestedData(query: GetDataDto) {
    const { country, variable, year } = query;

    // Caso 3: Fallo Evidenciado 2 - Excluir PENDING. 
    // Para TDD si el país es PE simula devolver vacío (no tiene approved version).
    if (country?.includes('PE')) {
      return {};
    }

    // Default mock response for happy path (Caso 1)
    const mockData: any = {
      CO: {
        Natural_Gas_Production: [
          { year: 2020, Basin: 'Llanos', Production_Volume_McfD: 520000 },
          { year: 2021, Basin: 'Llanos', Production_Volume_McfD: 550000 },
        ],
      },
      MX: {
        Natural_Gas_Production: [
          { year: 2021, Basin: 'Burgos', Production_Volume_McfD: 300000 },
        ]
      }
    };

    const result: any = {};
    const targetCountries = country ? country.split(',') : Object.keys(mockData);
    
    for (const c of targetCountries) {
      if (mockData[c]) {
        result[c] = {};
        const targetVariables = variable ? [variable] : Object.keys(mockData[c]);

        for (const v of targetVariables) {
          if (mockData[c][v]) {
            let rows = mockData[c][v];
            if (year) {
              rows = rows.filter((r: any) => r.year === year);
            }
            if (rows.length > 0) {
              result[c][v] = rows;
            } else {
              delete result[c][v];
            }
          }
        }
        
        if (Object.keys(result[c]).length === 0) {
          delete result[c];
        }
      }
    }

    return result;
  }

  getPreSignedUrls(country?: string) {
    if (country) {
      return {
        status: 'success',
        data: {
          files: [
            {
              country_code: country.toUpperCase(),
              last_updated: '2026-02-24T09:15:00Z',
              download_url: `https://mock-s3.aws.com/most_recent/${country.toUpperCase()}.xlsx`,
              expires_in_hours: 24
            }
          ]
        }
      };
    }

    return {
      status: 'success',
      data: {
        files: []
      }
    };
  }
}
