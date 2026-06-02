import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
import { Session } from './common';

export interface ValidateTokenRequest {
  scheme: string;
  credential: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  session: Session | undefined;
}

export interface AuthServiceClient {
  validateToken(request: ValidateTokenRequest, metadata?: Metadata): Observable<ValidateTokenResponse>;
}

export interface AuthServiceController {
  validateToken(
    request: ValidateTokenRequest,
    metadata: Metadata,
  ): Promise<ValidateTokenResponse> | Observable<ValidateTokenResponse> | ValidateTokenResponse;
}
