import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class TokenRequestDto {
  @ApiProperty({ example: 'cust_001', description: 'Identificador do cliente' })
  @Matches(/^cust_\d+$/, { message: 'customerId deve ter o formato cust_ seguido de dígitos' })
  customerId: string;
}

export class TokenResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ example: 3600, description: 'Validade do token em segundos' })
  expiresIn: number;
}
