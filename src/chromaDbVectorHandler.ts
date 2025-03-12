import { VectorHandler } from 'nestbox-ai-document-base';

export class ChromaVectorHandler implements VectorHandler {
  
  private collections: Record<string, { name: string; documents: Record<string, { id: string; content: string; metadata?: Record<string, any> }> }> = {};
  private idCounter = 0;

  async createCollection(name: string): Promise<void> {
    if (!this.collections[name]) {
      this.collections[name] = { name, documents: {} };
    }
  }

  async deleteCollection(collectionId: string): Promise<void> {
    delete this.collections[collectionId];
  }

  async listCollections(): Promise<string[]> {
    return Object.keys(this.collections);
  }

  async insertVector(collectionId: string, data: { content: string; metadata?: object }): Promise<string> {
    const id = `id-${this.idCounter++}`;
    const document = { id, content: data.content, metadata: data.metadata };
    if (!this.collections[collectionId]) {
      await this.createCollection(collectionId);
    }
    this.collections[collectionId].documents[id] = document;
    return id;
  }

  async updateVector(collectionId: string, vectorId: string, data: { content?: string; metadata?: object }): Promise<void> {
    if (!this.collections[collectionId]) {
      await this.createCollection(collectionId);
    }

    const doc = this.collections[collectionId].documents[vectorId];

    if (doc) {
      doc.content = data.content ?? doc.content;
      doc.metadata = data.metadata ?? doc.metadata;
    } else {
      this.collections[collectionId].documents[vectorId] = {
        id: vectorId,
        content: data.content || '',
        metadata: data.metadata,
      };
    }
  }

  async getVectorById(collectionId: string, vectorId: string): Promise<object | null> {
    return this.collections[collectionId]?.documents[vectorId] || null;
  }

  async deleteVectorById(collectionId: string, vectorId: string): Promise<void> {
    delete this.collections[collectionId]?.documents[vectorId];
  }

  async deleteVectorsByFilter(collectionId: string, filter: object): Promise<number> {
    const docs = this.collections[collectionId]?.documents;
    if (!docs) return 0;

    const keysToDelete = Object.keys(docs).filter(key => {
      return Object.entries(filter).every(([k, v]) => docs[key].metadata?.[k] === v);
    });

    keysToDelete.forEach(key => delete docs[key]);

    return keysToDelete.length;
  }

  async similaritySearch(collectionId: string, query: string, topK = 10, filter?: object, include?: string[]): Promise<any[]> {
    const docs = Object.values(this.collections[collectionId]?.documents || {});

    if (docs.length > 0) {
      return [docs[0]];
    }

    return [{ id: 'sample', content: 'Sample text', metadata: {} }];
  }
}