import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';

export interface LoginRequest {
  uuid: string;
}

export interface LoginResponse {
  id: number;
  uuid: string;
  nickName: string;
}

export interface GetGameAccountRequest {
  uuid: string;
}

export interface GameAccountReply {
  id: number;
  uuid: string;
  nickName: string;
}

export interface SendMailRequest {
  accountId: number;
  title: string;
  body: string;
}

export interface SendMailResponse {
  mailId: number;
  delivered: boolean;
}

export interface IdentityServiceClient {
  login(request: LoginRequest, metadata?: Metadata): Observable<LoginResponse>;
  getGameAccount(request: GetGameAccountRequest, metadata?: Metadata): Observable<GameAccountReply>;
  sendMail(request: SendMailRequest, metadata?: Metadata): Observable<SendMailResponse>;
}

export interface IdentityServiceController {
  login(
    request: LoginRequest,
    metadata: Metadata,
  ): Promise<LoginResponse> | Observable<LoginResponse> | LoginResponse;

  getGameAccount(
    request: GetGameAccountRequest,
    metadata: Metadata,
  ): Promise<GameAccountReply> | Observable<GameAccountReply> | GameAccountReply;

  sendMail(
    request: SendMailRequest,
    metadata: Metadata,
  ): Promise<SendMailResponse> | Observable<SendMailResponse> | SendMailResponse;
}
