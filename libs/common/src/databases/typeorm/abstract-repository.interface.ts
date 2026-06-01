import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { UpdateResult } from 'typeorm/query-builder/result/UpdateResult';
import { DeleteResult } from 'typeorm/query-builder/result/DeleteResult';
import { InsertResult } from 'typeorm/query-builder/result/InsertResult';
import { UpsertOptions } from 'typeorm/repository/UpsertOptions';
import { SaveOptions } from 'typeorm/repository/SaveOptions';
import { Repository } from 'typeorm/repository/Repository';

export interface AbstractRepositoryInterface<Entity>
  extends Repository<Entity> {
  findById(id: number): Promise<Entity>;

  findByIdIn(ids: number[]): Promise<Entity[]>;

  insert(
    entityOrEntities:
      | QueryDeepPartialEntity<Entity>
      | QueryDeepPartialEntity<Entity>[],
  ): Promise<InsertResult>;

  upsert(
    entityOrEntities:
      | QueryDeepPartialEntity<Entity>
      | QueryDeepPartialEntity<Entity>[],
    conflictPathsOrOptions: string[] | UpsertOptions<Entity>,
  ): Promise<InsertResult>;

  save<T>(entity: T, options?: SaveOptions): Promise<T>;
  save<T>(entities: T[], options?: SaveOptions): Promise<T[]>;
  save<T>(entityOrEntities: T | T[], options?: SaveOptions): Promise<T | T[]>;

  updateById<Entity>(
    id: number,
    values: QueryDeepPartialEntity<Entity>,
  ): Promise<UpdateResult>;

  updateByIdIn<Entity>(
    ids: number[],
    values: QueryDeepPartialEntity<Entity>,
  ): Promise<UpdateResult>;

  deleteById(id: number): Promise<DeleteResult>;

  deleteByIdIn(ids: number[]): Promise<DeleteResult>;
}
