import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/public.decorator';
import type { EnvironmentVariables } from '../config/env.validation';
import { TokenRequestDto, TokenResponseDto } from './dto/token-request.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /**
   * Login simplificado da PoC: emite o token só com o customerId, sem senha.
   * Em produção, o token viria de um provedor de identidade (ver design).
   */
  @Public()
  @Post('token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Emite um token de acesso para o cliente (login simplificado da PoC)' })
  @ApiCreatedResponse({ type: TokenResponseDto })
  async issueToken(@Body() body: TokenRequestDto): Promise<TokenResponseDto> {
    return {
      accessToken: await this.jwt.signAsync({ sub: body.customerId }),
      tokenType: 'Bearer',
      expiresIn: this.config.get('JWT_EXPIRES_IN_SECONDS', { infer: true }),
    };
  }
}
