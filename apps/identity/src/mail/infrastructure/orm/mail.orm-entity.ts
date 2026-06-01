import { Column, Entity } from 'typeorm';
import {
  AbstractEntity,
  BaseTimeEntity,
} from '@libs/common/databases/typeorm/abstract.entity';

@Entity('mail')
@BaseTimeEntity()
export class MailOrmEntity extends AbstractEntity {
  @Column()
  userId: number;

  @Column()
  type: number;

  @Column()
  contents: string;
}
