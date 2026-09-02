import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString({ message: 'El token de Google (idToken) debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El token de Google (idToken) es requerido' })
  idToken: string;
}
