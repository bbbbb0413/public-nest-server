import { Inject, Injectable } from '@nestjs/common';
import joiPasswordComplexity from 'joi-password-complexity';
import { PageOptionsDto } from '@libs/common/pagination/dto/page-options.dto';
import { PageMetaDto } from '@libs/common/pagination/dto/page-meta.dto';
import { INTERNAL_ERROR_CODE } from '@libs/common/constants/internal-error-code.constants';
import { UpdateRoleUserDto } from './dto/update-role-user.dto';
import { ServerErrorException } from '@libs/common/exception/server-error.exception';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { IUsersRepository } from './domain/repository/users.repository';
import { UserOutDto } from './presentation/dto/user-out.dto';
import { User } from './domain/model/user';
import { Email } from './domain/vo/email.vo';
import { Password } from './domain/vo/password.vo';

interface SignupInput {
  name: string;
  email: string;
  password: string;
}

const PASSWORD_COMPLEXITY_OPTIONS = {
  min: 10,
  max: 30,
  lowerCase: 1,
  upperCase: 1,
  numeric: 1,
  symbol: 1,
  requirementCount: 4,
};

@Injectable()
export class UserService {
  constructor(
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @InjectQueue('mail') private readonly queue: Queue,
  ) {}

  async isDuplicated(dto: SignupInput): Promise<void> {
    const count = await this.usersRepository.countByEmail(dto.email);
    if (count) {
      throw new ServerErrorException(
        INTERNAL_ERROR_CODE.ERROR,
        '이미 가입된 이메일입니다.',
      );
    }
  }

  isPasswordComplexity(dto: SignupInput): void {
    const result = joiPasswordComplexity(PASSWORD_COMPLEXITY_OPTIONS).validate(
      dto.password,
    );
    if (result.error !== undefined) {
      throw new ServerErrorException(
        INTERNAL_ERROR_CODE.ERROR,
        '비밀번호는 10~30자이며 소문자/대문자/숫자/특수문자 중 4가지를 포함해야 합니다.',
      );
    }
  }

  async signup(dto: SignupInput): Promise<UserOutDto> {
    if (dto.name.trim() === '') {
      throw new ServerErrorException(
        INTERNAL_ERROR_CODE.ERROR,
        '이름을 입력해주세요.',
      );
    }
    await this.isDuplicated(dto);
    await this.isPasswordComplexity(dto);

    const password = await Password.hash(dto.password);
    const user = User.create({
      name: dto.name,
      email: Email.of(dto.email),
      password,
    });
    const saved = await this.usersRepository.persist(user);

    await this.queue.add('send-mail', { userId: saved.id });

    return UserOutDto.fromDomain(saved);
  }

  async changePassword(
    dto: SignupInput,
    executor: string,
  ): Promise<void> {
    await this.findUserByEmail(dto.email);
    await this.isPasswordComplexity(dto);
    if (executor !== dto.email) {
      throw new ServerErrorException(INTERNAL_ERROR_CODE.ERROR);
    }

    const newPassword = await Password.hash(dto.password);
    await this.usersRepository.updatePasswordByEmail(
      dto.email,
      newPassword.getHashed(),
    );
  }

  async signIn(email: string, password: string): Promise<UserOutDto> {
    const user = await this.findUserByEmail(email);
    if (!(await user.checkPassword(password))) {
      throw new ServerErrorException(
        INTERNAL_ERROR_CODE.ERROR,
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }
    if (!user.activatedAt) {
      throw new ServerErrorException(
        INTERNAL_ERROR_CODE.ERROR,
        '아직 활성화되지 않은 계정입니다. 관리자에게 문의하세요.',
      );
    }
    return UserOutDto.fromDomain(user);
  }

  async activate(id: number): Promise<UserOutDto> {
    const affected = await this.usersRepository.activateById(id);
    if (!affected) {
      throw new ServerErrorException(INTERNAL_ERROR_CODE.ERROR);
    }
    return this.findById(id);
  }

  async deactivate(id: number): Promise<UserOutDto> {
    const affected = await this.usersRepository.deactivateById(id);
    if (!affected) {
      throw new ServerErrorException(INTERNAL_ERROR_CODE.ERROR);
    }
    return this.findById(id);
  }

  updateRole(_updateRoleUserDto: UpdateRoleUserDto): never {
    throw new ServerErrorException(INTERNAL_ERROR_CODE.ERROR);
  }

  async findAll(
    pageOptionsDto: PageOptionsDto,
  ): Promise<[UserOutDto[], PageMetaDto]> {
    const { order, page, take } = pageOptionsDto;
    const skip = (page - 1) * take;
    const [users, itemCount] = await this.usersRepository.findAllAndCount(
      take,
      skip,
      order,
    );
    return [
      users.map(UserOutDto.fromDomain),
      new PageMetaDto({ pageOptionsDto, itemCount }),
    ];
  }

  async findById(id: number): Promise<UserOutDto> {
    const user = await this.usersRepository.findUserById(id);
    if (!user) {
      throw new ServerErrorException(INTERNAL_ERROR_CODE.ERROR);
    }
    return UserOutDto.fromDomain(user);
  }

  async findByEmail(email: string): Promise<UserOutDto> {
    const user = await this.findUserByEmail(email);
    return UserOutDto.fromDomain(user);
  }

  async removeAdminUser(id: number, _executor: string): Promise<void> {
    const user = await this.usersRepository.findUserById(id);
    if (!user) {
      throw new ServerErrorException(INTERNAL_ERROR_CODE.ERROR);
    }
    await this.usersRepository.softDeleteById(id);
  }

  private async findUserByEmail(email: string): Promise<User> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      throw new ServerErrorException(INTERNAL_ERROR_CODE.ERROR);
    }
    return user;
  }
}
