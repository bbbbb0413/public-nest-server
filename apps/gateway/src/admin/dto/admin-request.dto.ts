import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

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

export class ChangeAdminPasswordInDto {
  @ApiProperty({ description: '관리자 이메일' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '새 비밀번호' })
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  role?: string;
}
