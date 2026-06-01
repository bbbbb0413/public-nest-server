import { CommonLog } from './common-log.interface';

export const CommonLogRepository = Symbol('CommonLogRepository');

export const CommonLogRepositories = Symbol('CommonLogRepositories');

export interface CommonLogRepository {
  connectionName: string;

  get(id: string, collectionName: string): Promise<any>;
  set(data: Record<string, any[]>): Promise<CommonLog[]>;
  del(id: string, collectionName: string): Promise<void>;
  close(): Promise<void>;

  findByTimeRange(
    collectionName: string,
    startDate: string,
    endDate: string,
    customQuery?: Record<any, any>,
  ): Promise<any[]>;

  findByNidAndTimeRange(
    collectionName: string,
    nid: string,
    startDate: string,
    endDate: string,
  ): Promise<any[]>;

  findInByNidAndTimeRange(
    collectionName: string,
    nids: string[],
    startDate: string,
    endDate: string,
  ): Promise<any[]>;

  findNotInByNidAndTimeRange(
    collectionName: string,
    nids: string[],
    startDate: string,
    endDate: string,
    customQuery?: Record<any, any>,
  ): Promise<any[]>;

  findByDistinctNidAndReasonAndTimeRange(
    collectionName: string,
    reason: string,
    startDate: string,
    endDate: string,
  ): Promise<string[]>;

  findNotInByNidAndReasonAndTimeRange(
    collectionName: string,
    nids: string[],
    reason: string,
    startDate: string,
    endDate: string,
    customQuery?: Record<any, any>,
  ): Promise<any[]>;

  findByCustomQuery(
    collectionName: string,
    customQuery?: Record<any, any>,
  ): Promise<any[]>;

  findByDistinctNidAndCustomQuery(
    collectionName: string,
    customQuery?: Record<any, any>,
  ): Promise<string[]>;
}
