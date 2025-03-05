# ChromaDB & LlamaIndex Document Management API

This project provides a RESTful API built on top of ChromaDB and LlamaIndex, enabling easy management of document collections and efficient similarity search capabilities for retrieval-augmented generation (RAG) applications.

## Features

- **Collection Management**: Create, list, and delete collections.
- **Vector Operations**: Insert, update, retrieve, and delete vectors (documents).
- **Similarity Search**: Find relevant documents based on similarity queries.
- **Metadata Filtering**: Refine queries and manage documents through metadata filters.
- **Parsing Pipeline**: Built-in parsing using LlamaIndex to prepare documents for indexing.

## API Overview

### Endpoints

| Method | Endpoint                                                 | Description                                |
|--------|----------------------------------------------------------|--------------------------------------------|
| GET | `/collections`                                             | List all collections |
| POST | Create a new collection |
| DELETE | `/collections/{collection_id}` | Delete a collection. |
| POST | `/collections/{collection_id}/vectors` | Add new vectors (documents). |
| PUT | `/collections/{collection_id}/vectors/{vector_id}` | Update or upsert vectors. |
| DELETE | `/collections/{collection_id}/vectors/{vector_id}` | Delete vectors by ID. |
| DELETE | `/collections/{collection_id}/vectors` | Delete vectors by metadata filters. |
| GET | `/collections/{collection_id}/vectors/{vector_id}` | Retrieve vector by ID. |
| POST | `/collections/{collection_id}/query` | Similarity search with optional filters. |

## Authentication

All endpoints are secured via API key authentication. Include your API key in the header of every request:

```bash
X-API-Key: YOUR_API_KEY
```

## Project Setup

1. Clone the repository
2. Setup .env file
3. Install dependencies:

```bash
yarn install
```

### Run the API server

```bash
npm start
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.