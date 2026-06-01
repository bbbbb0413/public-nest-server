import { Column, Entity, Index } from 'typeorm';
import {
  AbstractEntity,
  BaseTimeEntity,
} from '@libs/common/databases/typeorm/abstract.entity';

@Entity('game_account')
@BaseTimeEntity()
export class GameAccountOrmEntity extends AbstractEntity {
  @Index('IDX_UUID', { unique: true })
  @Column()
  uuid: string;

  @Column({ default: null })
  nickName: string;
}
