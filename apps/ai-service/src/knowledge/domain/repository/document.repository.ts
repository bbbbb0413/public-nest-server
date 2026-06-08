import { Document } from '../model/document';

export interface IDocumentRepository {
  persist(document: Document): Promise<Document>;
  findById(id: string): Promise<Document | null>;
  findAll(): Promise<Document[]>;
  update(document: Document): Promise<Document>;
  remove(id: string): Promise<void>;
}

export const DocumentRepository = Symbol('DocumentRepository');
