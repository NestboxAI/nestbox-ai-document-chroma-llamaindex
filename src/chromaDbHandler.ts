import {
  ChromaClient,
  Collection,
  IncludeEnum,
  OllamaEmbeddingFunction,
} from 'chromadb';
import { VectorHandler } from 'nestbox-ai-document-base';

const EMBEDDING_MODEL = 'nomic-embed-text';

const DEFAULT_EMBEDDING_FUNCTION = new OllamaEmbeddingFunction({
  url: 'http://127.0.0.1:11434/',
  model: EMBEDDING_MODEL,
});

export class ChromaDbHandler implements VectorHandler {
  private client: ChromaClient;

  constructor(config?: object) {
    // Initialize ChromaClient with given config or default (e.g., local server)
    try {
      this.client = new ChromaClient(config || {});
    } catch (err: any) {
      console.log(
        'Error operating on chroma with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(`Failed to initialize Chroma client: ${err.message}`);
    }
  }

  async createCollection(
    name: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    try {
      await this.client.createCollection({
        name,
        metadata,
        embeddingFunction: DEFAULT_EMBEDDING_FUNCTION,
      });
    } catch (err: any) {
      console.log(
        'Error operating on chroma with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(`Failed to create collection "${name}": ${err.message}`);
    }
  }

  async getCollection(collectionId: string): Promise<any> {
    const collection = await this._getCollection(collectionId);
    return {
      name: collectionId,
      metadata: collection.metadata,
      count: collection.count,
    };
  }

  async updateCollection(
    previousId: string,
    collectionId: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    const collection = await this._getCollection(previousId);
    await collection.modify({ name: collectionId, metadata });
  }

  async batchInsertVectors(
    collectionId: string,
    data: { ids: string[]; documents?: string[]; metadatas?: object[] },
  ): Promise<string[]> {
    const collection = await this._getCollection(collectionId);

    const result: Record<string, string | number | boolean>[] =
      data.metadatas?.map((obj) => Object.fromEntries(Object.entries(obj)));

    await collection.add({
      ids: data.ids,
      documents: data.documents,
      metadatas: result,
    });

    return data.ids;
  }

  async deleteCollection(collectionId: string): Promise<void> {
    try {
      await this.client.deleteCollection({ name: collectionId });
    } catch (err: any) {
      console.log(
        'Error operating on chroma with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(
        `Failed to delete collection "${collectionId}": ${err.message}`,
      );
    }
  }

  async listCollections(): Promise<string[]> {
    try {
      const collections = await this.client.listCollections();
      return collections;
    } catch (err: any) {
      console.log(
        'Error operating on chroma with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(`Failed to list collections: ${err.message}`);
    }
  }

  async insertVector(
    collectionId: string,
    data: {
      id?: string;
      document?: string;
      metadata?: object;
    },
  ): Promise<string> {
    const { id, document, metadata } = data;
    try {
      const collection: Collection = await this._getCollection(collectionId);

      // Generate an ID if not provided
      const vectorId =
        id ?? `vec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const fullMetadata = { createdAt: Date.now(), ...metadata };

      // Prepare parameters for adding. Only include fields that are present.
      const addParams: any = { ids: [vectorId] };
      if (document !== undefined) addParams.documents = [document];
      if (Object.keys(fullMetadata).length > 0) {
        addParams.metadatas = [fullMetadata];
      }

      await collection.add(addParams);
      return vectorId;
    } catch (err: any) {
      console.log(
        'Error operating on chroma with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(
        `Failed to insert vector into collection "${collectionId}": ${err.message}`,
      );
    }
  }

  async updateVector(
    collectionId: string,
    vectorId: string,
    data: { document?: string; metadata?: object },
  ): Promise<void> {
    const { document, metadata } = data;
    try {
      const collection: Collection = await this._getCollection(collectionId);

      // Merge url/type into metadata for update
      const fullMetadata: any = metadata
        ? { updatedAt: Date.now(), ...metadata }
        : {};

      const updateParams: any = { ids: vectorId };
      if (document !== undefined) updateParams.documents = document;
      if (Object.keys(fullMetadata).length > 0)
        updateParams.metadatas = fullMetadata;

      await collection.update(updateParams);
    } catch (err: any) {
      console.log(
        'Error operating on chroma with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(
        `Failed to update vector "${vectorId}" in collection "${collectionId}": ${err.message}`,
      );
    }
  }

  async deleteVectorById(
    collectionId: string,
    vectorId: string,
  ): Promise<void> {
    try {
      const collection: Collection = await this._getCollection(collectionId);
      await collection.delete({ ids: vectorId });
    } catch (err: any) {
      console.log(
        'Error operating on chroma with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(
        `Failed to delete vector "${vectorId}" from collection "${collectionId}": ${err.message}`,
      );
    }
  }

  async deleteVectorsByFilter(
    collectionId: string,
    filter: object,
  ): Promise<number> {
    try {
      const collection: Collection = await this._getCollection(collectionId);

      // Find all vectors matching the filter to count them
      const results: any = await collection.get({ where: filter });
      const idsToDelete: string[] = results.ids ?? [];
      const count = idsToDelete.length;
      if (count === 0) {
        return 0; // nothing to delete
      }
      // Delete the matching vectors
      await collection.delete({ where: filter });
      return count;
    } catch (err: any) {
      console.log(
        'Error operating on chroma with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(
        `Failed to delete vectors by filter in collection "${collectionId}": ${err.message}`,
      );
    }
  }

  async getVectorById(collectionId: string, vectorId: string): Promise<any> {
    try {
      const collection: Collection = await this._getCollection(collectionId);

      const result: any = await collection.get({
        ids: vectorId,
        include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
      });
      if (!result.ids || result.ids.length === 0) {
        return undefined; // no such ID
      }
      // result.ids, result.documents, result.metadatas are arrays (of length 1 here)
      return {
        id: result.ids[0],
        document: result.documents ? result.documents[0] : null,
        metadata: result.metadatas ? result.metadatas[0] : null,
      };
    } catch (err: any) {
      console.log(
        'Error operating on chroma with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(
        `Failed to get vector "${vectorId}" from collection "${collectionId}": ${err.message}`,
      );
    }
  }

  async similaritySearch(
    collectionId: string,
    query: string,
    topK = 4,
    filter?: object,
    include?: string[],
  ): Promise<any[]> {
    try {
      const collection: Collection = await this._getCollection(collectionId);
      return await this.queryTerm(query, topK, filter, include, collection);
    } catch (err) {
      console.log(
        'Error operating on chroma with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(
        `Failed to perform similarity search on collection "${collectionId}": ${err.message}`,
      );
    }
  }

  private async queryTerm(
    query: string,
    topK: number,
    filter: object,
    include: string[],
    collection: Collection,
  ) {
    const queryParams: any = {
      queryTexts: [query],
      nResults: topK,
    };
    if (filter) queryParams.where = filter;
    if (include) queryParams.include = include;

    console.log('Performing similarity search with parameters', queryParams);
    const results = await collection.query(queryParams);
    console.log('Results of similarity search', results);

    const output: any[] = [];
    if (!results.ids || !results.ids.length) {
      return output; // no results
    }
    // If multiple queries were possible, results.ids would be an array of arrays.
    // We assume a single query (take the first element).
    const ids = Array.isArray(results.ids[0]) ? results.ids[0] : results.ids;
    const docs = results.documents
      ? Array.isArray(results.documents[0])
        ? results.documents[0]
        : results.documents
      : [];
    const metas = results.metadatas
      ? Array.isArray(results.metadatas[0])
        ? results.metadatas[0]
        : results.metadatas
      : [];
    const dists = results.distances
      ? Array.isArray(results.distances[0])
        ? results.distances[0]
        : results.distances
      : [];
    const embeds = results.embeddings
      ? Array.isArray(results.embeddings[0])
        ? results.embeddings[0]
        : results.embeddings
      : [];
    for (let i = 0; i < ids.length; i++) {
      output.push({
        id: ids[i],
        document: docs[i] ?? null,
        metadata: metas[i] ?? null,
        distance: dists[i] ?? null,
        embedding: embeds[i] ?? null,
      });
    }
    return output;
  }

  private _getCollection(collectionId: string): Promise<Collection> {
    return this.client.getCollection({
      name: collectionId,
      embeddingFunction: DEFAULT_EMBEDDING_FUNCTION,
    });
  }
}
