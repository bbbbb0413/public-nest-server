import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class AdminSignupInDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}

export class AdminLoginInDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;
}

export class UpdateActivateUserInDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  activate: boolean;
}

export class UpdateRoleUserInDto {
  @ApiProperty()
  userId: number;
}
