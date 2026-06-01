import {
  BaseEntity,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Domain } from '@libs/common/domain/domain';

export function BaseTimeEntity() {
  return function (target: Function): void {
    CreateDateColumn()(target.prototype, 'createdAt');
    UpdateDateColumn()(target.prototype, 'updatedAt');
    DeleteDateColumn({ nullable: true })(target.prototype, 'deletedAt');
  };
}

export abstract class AbstractEntity extends BaseEntity implements Domain {
  @PrimaryGeneratedColumn({ comment: '아이디' })
  id?: number;

  static create<T>(this: new () => T, partial?: Partial<T>): T {
    return Object.assign(new this(), partial);
  }
}
