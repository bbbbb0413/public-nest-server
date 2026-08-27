import {
  AdminUserReply,
  GetAdminUsersResponse,
} from '@libs/rpc';
import { PageMetaDto } from '@libs/common/pagination/dto/page-meta.dto';
import { UserOutDto } from '../user/presentation/dto/user-out.dto';

export class AdminGrpcMapper {
  static toAdminUserReply(dto: UserOutDto): AdminUserReply {
    return {
      id: dto.id,
      name: dto.name,
      email: dto.email,
      activatedAt: dto.activatedAt ? dto.activatedAt.getTime() : undefined,
    };
  }

  static toGetAdminUsersResponse(
    users: UserOutDto[],
    pageMeta: PageMetaDto,
  ): GetAdminUsersResponse {
    return {
      users: users.map(AdminGrpcMapper.toAdminUserReply),
      page: pageMeta.page,
      take: pageMeta.take,
      itemCount: pageMeta.itemCount,
      pageCount: pageMeta.pageCount,
      hasPreviousPage: pageMeta.hasPreviousPage,
      hasNextPage: pageMeta.hasNextPage,
    };
  }
}
