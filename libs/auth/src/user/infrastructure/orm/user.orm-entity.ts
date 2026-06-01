import { Column, Entity, Index } from 'typeorm';
import {
  AbstractEntity,
  BaseTimeEntity,
} from '@libs/common/databases/typeorm/abstract.entity';

@Entity('user')
@BaseTimeEntity()
export class UserOrmEntity extends AbstractEntity {
  @Index('IDX_EMAIL', { unique: true })
  @Column()
  email: string;

  @Column()
  name: string;

  @Column()
  password: string;

  @Column({ type: 'timestamp', nullable: true })
  activatedAt: Date;
}
