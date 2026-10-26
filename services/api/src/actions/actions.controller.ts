import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer } from '../auth/current-customer.decorator';
import { CorrelationId } from '../common/correlation-id.decorator';
import { ActionsService } from './actions.service';
import { ActionResponseDto, toActionResponse } from './dto/action.dto';

/**
 * Aprovação humana: o agente só propõe; estes endpoints, que a LLM não tem como chamar,
 * são o único caminho para executar uma ação.
 */
@ApiTags('actions')
@ApiBearerAuth()
@Controller('actions')
export class ActionsController {
  constructor(private readonly actions: ActionsService) {}

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprova e executa uma ação proposta pelo assistente' })
  @ApiOkResponse({ type: ActionResponseDto })
  async approve(
    @Param('id') id: string,
    @CurrentCustomer() customerId: string,
    @CorrelationId() correlationId: string,
  ): Promise<ActionResponseDto> {
    return toActionResponse(await this.actions.approve(id, customerId, correlationId));
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recusa uma ação proposta pelo assistente' })
  @ApiOkResponse({ type: ActionResponseDto })
  async reject(@Param('id') id: string, @CurrentCustomer() customerId: string): Promise<ActionResponseDto> {
    return toActionResponse(await this.actions.reject(id, customerId));
  }
}
