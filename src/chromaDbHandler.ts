import {
  ChromaClient,
  Collection,
  IncludeEnum,
  DefaultEmbeddingFunction,
} from 'chromadb';
import { VectorHandler } from 'nestbox-ai-document-base';

const defaultEF = new DefaultEmbeddingFunction();

export class ChromaDbHandler implements VectorHandler {
  private client: ChromaClient;

  constructor(config?: object) {
    // Initialize ChromaClient with given config or default (e.g., local server)
    try {
      this.client = new ChromaClient(config || {});
    } catch (err: any) {
      console.log(
        'Error inserting vector with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(`Failed to initialize Chroma client: ${err.message}`);
    }
  }

  async createCollection(name: string): Promise<void> {
    try {
      await this.client.createCollection({
        name,
        embeddingFunction: defaultEF,
      });
    } catch (err: any) {
      console.log(
        'Error inserting vector with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(`Failed to create collection "${name}": ${err.message}`);
    }
  }

  async deleteCollection(collectionId: string): Promise<void> {
    try {
      await this.client.deleteCollection({ name: collectionId });
    } catch (err: any) {
      console.log(
        'Error inserting vector with parameters',
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
        'Error inserting vector with parameters',
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
      url?: string;
      type?: string;
      metadata?: object;
    },
  ): Promise<string> {
    const { id, document, url, type, metadata } = data;
    try {
      const collection: Collection = await this.getCollection(collectionId);

      // Generate an ID if not provided
      const vectorId =
        id ?? `vec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Merge url and type into metadata (metadata can be any object)
      const fullMetadata: any = metadata ? { ...metadata } : {};
      if (url) fullMetadata.url = url;
      if (type) fullMetadata.type = type;

      // Prepare parameters for adding. Only include fields that are present.
      const addParams: any = { ids: [vectorId] };
      if (document !== undefined) addParams.documents = [document];
      if (Object.keys(fullMetadata).length > 0) {
        addParams.metadatas = [fullMetadata];
      }

      console.log('Inserting vector with parameters', addParams);
      await collection.add(addParams);
      return vectorId;
    } catch (err: any) {
      console.log(
        'Error inserting vector with parameters',
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
    data: { document?: string; url?: string; type?: string; metadata?: object },
  ): Promise<void> {
    const { document, url, type, metadata } = data;
    try {
      const collection: Collection = await this.getCollection(collectionId);

      // Merge url/type into metadata for update
      const fullMetadata: any = metadata ? { ...metadata } : {};
      if (url) fullMetadata.url = url;
      if (type) fullMetadata.type = type;

      const updateParams: any = { ids: vectorId };
      if (document !== undefined) updateParams.documents = document;
      if (Object.keys(fullMetadata).length > 0)
        updateParams.metadatas = fullMetadata;

      await collection.update(updateParams);
    } catch (err: any) {
      console.log(
        'Error inserting vector with parameters',
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
      const collection: Collection = await this.getCollection(collectionId);
      await collection.delete({ ids: vectorId });
    } catch (err: any) {
      console.log(
        'Error inserting vector with parameters',
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
      const collection: Collection = await this.getCollection(collectionId);

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
        'Error inserting vector with parameters',
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
      const collection: Collection = await this.getCollection(collectionId);

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
        'Error inserting vector with parameters',
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
      const collection: Collection = await this.getCollection(collectionId);

      const queryParams: any = {
        queryTexts: [query],
        nResults: topK,
      };
      if (filter) queryParams.where = filter;
      if (include) queryParams.include = include;

      console.log('Performing similarity search with parameters', queryParams);
      const results: any = await collection.query(queryParams);
      console.log('Results of similarity search', results);

      const output: any[] = [];
      if (results.ids && results.ids.length > 0) {
        // If multiple queries were possible, results.ids would be an array of arrays.
        // We assume a single query (take the first element).
        const ids = Array.isArray(results.ids[0])
          ? results.ids[0]
          : results.ids;
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
      }
      return output;
    } catch (err: any) {
      console.log(
        'Error inserting vector with parameters',
        err,
        JSON.stringify(err),
      );
      throw new Error(
        `Failed to perform similarity search on collection "${collectionId}": ${err.message}`,
      );
    }
  }

  private getCollection(collectionId: string): Promise<Collection> {
    return this.client.getCollection({
      name: collectionId,
      embeddingFunction: defaultEF,
    });
  }
}
