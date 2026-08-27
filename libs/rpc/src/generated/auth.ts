import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';
import { Session, Empty } from './common';

export interface ValidateTokenRequest {
  scheme: string;
  credential: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  session: Session | undefined;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface AdminUserReply {
  id: number;
  name: string;
  email: string;
  activatedAt?: number;
}

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  token: string;
  user: AdminUserReply | undefined;
}

export interface GetAdminUsersRequest {
  page: number;
  take: number;
  order: string;
}

export interface GetAdminUsersResponse {
  users: AdminUserReply[];
  page: number;
  take: number;
  itemCount: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface GetAdminUserRequest {
  id: number;
}

export interface ActivateAdminUserRequest {
  userId: number;
  activate: boolean;
}

export interface UpdateAdminUserRoleRequest {
  userId: number;
}

export interface ChangeAdminPasswordRequest {
  name: string;
  email: string;
  password: string;
  executorEmail: string;
}

export interface RemoveAdminUserRequest {
  id: number;
  executorEmail: string;
}

export interface AuthServiceClient {
  validateToken(
    request: ValidateTokenRequest,
    metadata?: Metadata,
  ): Observable<ValidateTokenResponse>;

  signup(request: SignupRequest, metadata?: Metadata): Observable<AdminUserReply>;
  adminLogin(
    request: AdminLoginRequest,
    metadata?: Metadata,
  ): Observable<AdminLoginResponse>;
  getAdminUsers(
    request: GetAdminUsersRequest,
    metadata?: Metadata,
  ): Observable<GetAdminUsersResponse>;
  getAdminUser(
    request: GetAdminUserRequest,
    metadata?: Metadata,
  ): Observable<AdminUserReply>;
  activateAdminUser(
    request: ActivateAdminUserRequest,
    metadata?: Metadata,
  ): Observable<AdminUserReply>;
  updateAdminUserRole(
    request: UpdateAdminUserRoleRequest,
    metadata?: Metadata,
  ): Observable<AdminUserReply>;
  changeAdminPassword(
    request: ChangeAdminPasswordRequest,
    metadata?: Metadata,
  ): Observable<Empty>;
  removeAdminUser(
    request: RemoveAdminUserRequest,
    metadata?: Metadata,
  ): Observable<Empty>;
}

export interface AuthServiceController {
  validateToken(
    request: ValidateTokenRequest,
    metadata: Metadata,
  ):
    | Promise<ValidateTokenResponse>
    | Observable<ValidateTokenResponse>
    | ValidateTokenResponse;

  signup(
    request: SignupRequest,
    metadata: Metadata,
  ): Promise<AdminUserReply> | Observable<AdminUserReply> | AdminUserReply;

  adminLogin(
    request: AdminLoginRequest,
    metadata: Metadata,
  ):
    | Promise<AdminLoginResponse>
    | Observable<AdminLoginResponse>
    | AdminLoginResponse;

  getAdminUsers(
    request: GetAdminUsersRequest,
    metadata: Metadata,
  ):
    | Promise<GetAdminUsersResponse>
    | Observable<GetAdminUsersResponse>
    | GetAdminUsersResponse;

  getAdminUser(
    request: GetAdminUserRequest,
    metadata: Metadata,
  ): Promise<AdminUserReply> | Observable<AdminUserReply> | AdminUserReply;

  activateAdminUser(
    request: ActivateAdminUserRequest,
    metadata: Metadata,
  ): Promise<AdminUserReply> | Observable<AdminUserReply> | AdminUserReply;

  updateAdminUserRole(
    request: UpdateAdminUserRoleRequest,
    metadata: Metadata,
  ): Promise<AdminUserReply> | Observable<AdminUserReply> | AdminUserReply;

  changeAdminPassword(
    request: ChangeAdminPasswordRequest,
    metadata: Metadata,
  ): Promise<Empty> | Observable<Empty> | Empty;

  removeAdminUser(
    request: RemoveAdminUserRequest,
    metadata: Metadata,
  ): Promise<Empty> | Observable<Empty> | Empty;
}
