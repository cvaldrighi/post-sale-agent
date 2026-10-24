import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateRefundDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  /** Inteiro em centavos. "10" (texto) ou 10.5 são recusados. */
  @IsInt()
  @Min(1)
  amountCents: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
