import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../conversations/entities/message.entity';
import { OrdersClientModule } from '../orders-client/orders-client.module';
import { ActionsService } from './actions.service';
import { PendingAction } from './entities/pending-action.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PendingAction, Message]), OrdersClientModule],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}
