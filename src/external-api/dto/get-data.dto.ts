import { IsOptional, IsString, IsNumber, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class GetDataDto {
  /**
   * Códigos de país en formato ISO 3166-1 alpha-2, separados por comas.
   * Ejemplo: "CO,MX"
   */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}(,[A-Z]{2})*$/, {
    message: 'country must be a comma-separated list of valid ISO 3166-1 alpha-2 codes (e.g. CO,MX)',
  })
  country?: string;

  @IsOptional()
  @IsString()
  variable?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'year must be a numeric string or number' })
  year?: number;
}
