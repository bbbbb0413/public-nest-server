import { Injectable } from '@nestjs/common';
import { Collection, MongoClient, ObjectId } from 'mongodb';
import { Document as KnowledgeDocument } from '../../domain/model/document';
import { IDocumentRepository } from '../../domain/repository/document.repository';

interface DocumentRecord {
  _id?: ObjectId;
  fileName: string;
  mimeType: string;
  status: string;
  chunkCount: number;
  createdAt: Date;
}

@Injectable()
export class DocumentRepositoryImpl implements IDocumentRepository {
  private readonly collection: Collection<DocumentRecord>;

  constructor(client: MongoClient, dbName: string) {
    this.collection = client
      .db(dbName)
      .collection<DocumentRecord>('knowledge_documents');
  }

  async persist(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    const record: DocumentRecord = {
      fileName: document.fileName,
      mimeType: document.mimeType,
      status: document.status,
      chunkCount: document.chunkCount,
      createdAt: document.createdAt,
    };
    const result = await this.collection.insertOne(record);
    return KnowledgeDocument.restore({
      ...record,
      id: result.insertedId.toHexString(),
      status: record.status as any,
    });
  }

  async findById(id: string): Promise<KnowledgeDocument | null> {
    const record = await this.collection.findOne({ _id: new ObjectId(id) });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findAll(): Promise<KnowledgeDocument[]> {
    const records = await this.collection
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    return records.map((r) => this.toDomain(r));
  }

  async update(document: KnowledgeDocument): Promise<KnowledgeDocument> {
    await this.collection.updateOne(
      { _id: new ObjectId(document.id) },
      { $set: { status: document.status, chunkCount: document.chunkCount } },
    );
    return document;
  }

  async remove(id: string): Promise<void> {
    await this.collection.deleteOne({ _id: new ObjectId(id) });
  }

  private toDomain(
    record: DocumentRecord & { _id?: ObjectId },
  ): KnowledgeDocument {
    return KnowledgeDocument.restore({
      id: record._id?.toHexString(),
      fileName: record.fileName,
      mimeType: record.mimeType,
      status: record.status as any,
      chunkCount: record.chunkCount,
      createdAt: record.createdAt,
    });
  }
}
