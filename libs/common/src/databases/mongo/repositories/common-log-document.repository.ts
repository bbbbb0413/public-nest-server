import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ObjectId } from 'mongodb';
import { CommonLog } from '../interface/common-log.interface';
import { CommonLogRepository } from '../interface/common-log-repository.interface';
import mongoLogDocumentConfig from '@libs/common/config/mongo-log-document.config';

export class CommonLogDocumentRepository implements CommonLogRepository {
  readonly connectionName: string;

  constructor(
    @InjectConnection(mongoLogDocumentConfig().ehName)
    private readonly connection: Connection,
  ) {
    this.connectionName = mongoLogDocumentConfig().ehName;
  }

  async get(id: string, collectionName: string): Promise<any> {
    const collection = this.connection.collection(collectionName);

    const log = await collection.findOne({ _id: new ObjectId(id) });

    return {
      collectionName: collectionName,
      objectId: log._id.toString(),
      data: log,
    } as CommonLog;
  }

  async set(data: Record<string, any[]>): Promise<CommonLog[]> {
    const result: CommonLog[] = [];
    for (const collectionName of Object.keys(data)) {
      const collection = this.connection.collection(collectionName);

      const logs = data[collectionName];

      const { insertedIds } = await collection.insertMany(logs);

      const commonLogs = Object.values(insertedIds).map(
        (it, index) =>
          ({
            collectionName: collectionName,
            objectId: it.toString(),
            data: logs[index],
          } as CommonLog),
      );

      result.push(...commonLogs);
    }

    return result;
  }

  async del(id: string, collectionName: string): Promise<void> {
    const collection = this.connection.collection(collectionName);

    await collection.deleteOne({ _id: new ObjectId(id) });
  }

  async close(): Promise<void> {
    await this.connection.close();
  }

  async findByTimeRange(
    collectionName: string,
    startDate: string,
    endDate: string,
    customQuery?: Record<any, any>,
  ): Promise<any[]> {
    const collection = this.connection.collection(collectionName);
    return await collection
      .find({
        _time: {
          $gte: startDate,
          $lte: endDate,
        },
        ...customQuery,
      })
      .toArray();
  }

  async findByNidAndTimeRange(
    collectionName: string,
    nid: string,
    startDate: string,
    endDate: string,
  ): Promise<any[]> {
    const collection = this.connection.collection(collectionName);
    return await collection
      .find({
        _time: {
          $gte: startDate,
          $lte: endDate,
        },
        nid: nid,
      })
      .toArray();
  }

  async findInByNidAndTimeRange(
    collectionName: string,
    nids: string[],
    startDate: string,
    endDate: string,
  ): Promise<any[]> {
    const collection = this.connection.collection(collectionName);
    return await collection
      .find({
        _time: {
          $gte: startDate,
          $lte: endDate,
        },
        nid: { $in: nids },
      })
      .toArray();
  }

  async findNotInByNidAndTimeRange(
    collectionName: string,
    nids: string[],
    startDate: string,
    endDate: string,
    customQuery?: Record<any, any>,
  ): Promise<any[]> {
    const collection = this.connection.collection(collectionName);
    return await collection
      .find({
        _time: {
          $gte: startDate,
          $lte: endDate,
        },
        nid: { $nin: nids },
        ...customQuery,
      })
      .toArray();
  }

  async findByDistinctNidAndReasonAndTimeRange(
    collectionName: string,
    reason: string,
    startDate: string,
    endDate: string,
  ): Promise<string[]> {
    const collection = this.connection.collection(collectionName);
    return await collection.distinct('nid', {
      _time: {
        $gte: startDate,
        $lte: endDate,
      },
      rsn: reason,
    });
    // .toArray();
  }

  async findByReasonAndTimeRange(
    collectionName: string,
    reason: string,
    startDate: string,
    endDate: string,
  ): Promise<any[]> {
    const collection = this.connection.collection(collectionName);
    return await collection
      .find({
        _time: {
          $gte: startDate,
          $lte: endDate,
        },
        rsn: reason,
      })
      .toArray();
  }

  async findNotInByNidAndReasonAndTimeRange(
    collectionName: string,
    nids: string[],
    reason: string,
    startDate: string,
    endDate: string,
    customQuery?: Record<any, any>,
  ): Promise<any[]> {
    const collection = this.connection.collection(collectionName);
    return await collection
      .find({
        _time: {
          $gte: startDate,
          $lte: endDate,
        },
        nid: { $nin: nids },
        reason: reason,
        ...customQuery,
      })
      .toArray();
  }

  async findByCustomQuery(
    collectionName: string,
    customQuery?: Record<any, any>,
  ): Promise<any[]> {
    const collection = this.connection.collection(collectionName);
    return await collection.find(customQuery).toArray();
  }

  async findByDistinctNidAndCustomQuery(
    collectionName: string,
    customQuery?: Record<any, any>,
  ): Promise<string[]> {
    const collection = this.connection.collection(collectionName);
    return await collection.distinct('nid', customQuery);
    // .toArray();
  }
}
