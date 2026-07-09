import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection, MongoClient } from 'mongodb';
import { ConversationSession } from '../../domain/model/conversation-session';
import { IConversationSessionRepository } from '../../domain/repository/conversation-session.repository';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90;

interface TurnRecord {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

interface SessionRecord {
  sessionId: string;
  userId: string;
  title: string;
  turns: TurnRecord[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ConversationSessionRepositoryImpl
  implements IConversationSessionRepository, OnModuleInit
{
  private readonly collection: Collection<SessionRecord>;

  constructor(
    @Inject('MONGO_CLIENT') client: MongoClient,
    private readonly configService: ConfigService,
  ) {
    const dbName =
      this.configService.get<string>('MONGODB_DB_NAME') ?? 'ai_service';
    this.collection = client
      .db(dbName)
      .collection<SessionRecord>('conversation_sessions');
  }

  async onModuleInit(): Promise<void> {
    await this.collection.createIndex(
      { sessionId: 1 },
      { unique: true, name: 'session_id_unique_idx' },
    );
    await this.collection.createIndex(
      { userId: 1, updatedAt: -1 },
      { name: 'user_id_updated_idx' },
    );
    await this.collection.createIndex(
      { updatedAt: 1 },
      { expireAfterSeconds: SESSION_TTL_SECONDS, name: 'session_ttl_idx' },
    );
  }

  async findById(sessionId: string): Promise<ConversationSession | null> {
    const record = await this.collection.findOne({ sessionId });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByUserId(
    userId: string,
    page: number,
    limit: number,
  ): Promise<ConversationSession[]> {
    const skip = (page - 1) * limit;
    const records = await this.collection
      .find({ userId })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    return records.map((r) => this.toDomain(r));
  }

  async persist(session: ConversationSession): Promise<ConversationSession> {
    const record = this.toRecord(session);
    await this.collection.insertOne(record);
    return session;
  }

  async update(session: ConversationSession): Promise<ConversationSession> {
    const record = this.toRecord(session);
    await this.collection.updateOne(
      { sessionId: session.getSessionId() },
      { $set: { turns: record.turns, updatedAt: record.updatedAt } },
    );
    return session;
  }

  async deleteById(sessionId: string): Promise<void> {
    await this.collection.deleteOne({ sessionId });
  }

  private toDomain(record: SessionRecord): ConversationSession {
    return ConversationSession.restore({
      sessionId: record.sessionId,
      userId: record.userId,
      title: record.title,
      turns: record.turns,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private toRecord(session: ConversationSession): SessionRecord {
    return {
      sessionId: session.getSessionId(),
      userId: session.getUserId(),
      title: session.title,
      turns: session.turns.map((t) => ({
        role: t.role,
        content: t.content,
        createdAt: t.createdAt,
      })),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
