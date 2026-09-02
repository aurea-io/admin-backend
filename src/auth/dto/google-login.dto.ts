import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString({ message: 'Google token (idToken) must be a string' })
  @IsNotEmpty({ message: 'Google token (idToken) is required' })
  idToken: string;
}
