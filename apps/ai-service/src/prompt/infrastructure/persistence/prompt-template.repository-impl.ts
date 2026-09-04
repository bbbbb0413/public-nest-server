import { Injectable } from '@nestjs/common';
import { Collection, MongoClient, ObjectId } from 'mongodb';
import { PromptTemplate } from '../../domain/model/prompt-template';
import { IPromptTemplateRepository } from '../../domain/repository/prompt-template.repository';

interface PromptTemplateRecord {
  _id?: ObjectId;
  name: string;
  version: number;
  content: string;
  isActive: boolean;
  variables: string[];
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PromptTemplateRepositoryImpl implements IPromptTemplateRepository {
  private readonly collection: Collection<PromptTemplateRecord>;

  constructor(client: MongoClient, dbName: string) {
    this.collection = client
      .db(dbName)
      .collection<PromptTemplateRecord>('prompt_templates');
  }

  async persist(template: PromptTemplate): Promise<PromptTemplate> {
    const record: PromptTemplateRecord = {
      name: template.name.getValue(),
      version: template.version,
      content: template.content,
      isActive: template.isActive,
      variables: template.variables,
      ...(template.userId !== undefined && { userId: template.userId }),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
    const result = await this.collection.insertOne(record);
    return this.toDomain({ ...record, _id: result.insertedId });
  }

  async findByNameAndVersion(
    name: string,
    version: number,
    userId?: string,
  ): Promise<PromptTemplate | null> {
    const query: any = { name, version };
    if (userId !== undefined) {
      query.userId = userId;
    }
    const record = await this.collection.findOne(query);
    return record ? this.toDomain(record) : null;
  }

  async findAllByName(name: string, userId?: string): Promise<PromptTemplate[]> {
    const query: any = { name };
    if (userId !== undefined) {
      query.userId = userId;
    } else {
      query.$or = [{ userId: null }, { userId: { $exists: false } }];
    }
    const records = await this.collection
      .find(query)
      .sort({ version: -1 })
      .toArray();
    return records.map((r) => this.toDomain(r));
  }

  async findActive(name: string): Promise<PromptTemplate | null> {
    const record = await this.collection.findOne({
      name,
      isActive: true,
      $or: [{ userId: null }, { userId: { $exists: false } }],
    });
    return record ? this.toDomain(record) : null;
  }

  async findActiveForUser(
    name: string,
    userId: string,
  ): Promise<PromptTemplate | null> {
    const record = await this.collection.findOne({
      name,
      userId,
      isActive: true,
    });
    return record ? this.toDomain(record) : null;
  }

  async deactivateAllByName(name: string): Promise<void> {
    await this.collection.updateMany(
      { name, $or: [{ userId: null }, { userId: { $exists: false } }] },
      { $set: { isActive: false, updatedAt: new Date() } },
    );
  }

  async deactivateAllForUser(name: string, userId: string): Promise<void> {
    await this.collection.updateMany(
      { name, userId },
      { $set: { isActive: false, updatedAt: new Date() } },
    );
  }

  async deleteByNameAndVersion(
    name: string,
    version: number,
    userId?: string,
  ): Promise<boolean> {
    const query: any = { name, version };
    if (userId !== undefined) {
      query.userId = userId;
    }
    const result = await this.collection.deleteOne(query);
    return result.deletedCount > 0;
  }

  async update(template: PromptTemplate): Promise<PromptTemplate> {
    await this.collection.updateOne(
      { _id: new ObjectId(template.id) },
      {
        $set: {
          isActive: template.isActive,
          updatedAt: template.updatedAt,
        },
      },
    );
    return template;
  }

  private toDomain(
    record: PromptTemplateRecord & { _id?: ObjectId },
  ): PromptTemplate {
    return PromptTemplate.restore({
      id: record._id?.toHexString(),
      name: record.name,
      version: record.version,
      content: record.content,
      isActive: record.isActive,
      variables: record.variables,
      userId: record.userId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
