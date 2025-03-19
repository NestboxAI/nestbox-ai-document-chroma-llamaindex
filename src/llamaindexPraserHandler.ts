import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TextFileReader } from '@llamaindex/readers/text';
import { PDFReader } from '@llamaindex/readers/pdf';
import { DocxReader } from '@llamaindex/readers/docx';
import { MarkdownReader } from '@llamaindex/readers/markdown';
import { CSVReader } from '@llamaindex/readers/csv';
import { HTMLReader } from '@llamaindex/readers/html';
import { ImageReader } from '@llamaindex/readers/image';
import { JSONReader } from '@llamaindex/readers/json'; // if JSON support is needed
import { ParseHandler } from 'nestbox-ai-document-base';
import { SentenceSplitter } from '@llamaindex/core/node-parser';

export class LlamaIndexParserHandler implements ParseHandler {

  /**
   * Preprocesses raw text data before parsing.
   * @param rawText - Raw text data to preprocess.
   * @returns Preprocessed text data with IDs and metadata.
   */
  async preprocessText(rawText: string) {
    // Initialize SentenceSplitter
    const splitter = new SentenceSplitter({
      chunkSize: 500,     // Number of characters per chunk (adjust as needed)
      chunkOverlap: 50,   // Overlap characters between chunks
    });
  
    // Split the raw plain text into chunks
    const chunks = await splitter.splitText(rawText);
  
    // Prepare ids, documents, and metadata
    const ids = chunks.map((_, idx) => `chunk-${idx}`);
    const documents = chunks;
    const metadatas = chunks.map((chunk, idx) => ({
      chunkIndex: idx,
      length: chunk.length,
    }));
  
    return {
      ids,
      documents,
      metadatas,
    };
  }
  
  /**
   * Parses input data and returns the parsed result.
   * @param input - Input data for parsing, including URL, file type, and options.
   * @returns Parsed document content, metadata, and IDs.
   */
  async parse(input: {
    url: string;
    type: string;
    options?: Record<string, any>;
  }): Promise<{ ids: string[]; documents: string[]; metadatas: object[] }> {
    try {
      // Determine source of content
      const { url, type } = input;
      if (!url) {
        throw new Error('No document or URL provided for parsing.');
      }

      // Determine file type (extension) in lowercase for comparison
      const fileType = type.toLowerCase();
      let textData: string | undefined = undefined;
      let tempFilePath: string | undefined = undefined;

      // Download the file
      // Configure Axios for binary data (covers text and binary files)
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const dataBuffer = Buffer.from(response.data);

      // If the file type is inherently text-based, convert buffer to string directly
      if (
        ['txt', 'text', 'md', 'markdown', 'html', 'csv', 'json'].includes(
          fileType,
        )
      ) {
        textData = dataBuffer.toString('utf-8');
      } else {
        // For binary files (pdf, docx, images, etc.), write to a temporary file
        const extension = fileType.startsWith('.')
          ? fileType.slice(1)
          : fileType;
        tempFilePath = path.join(
          os.tmpdir(),
          `llamaindex_temp_${Date.now()}_${Math.random().toString(16).slice(2)}.${extension}`,
        );
        await fs.promises.writeFile(tempFilePath, dataBuffer);
      }

      // Select the appropriate LlamaIndex reader based on file type
      let reader;
      switch (fileType) {
        case 'txt':
        case 'text':
          reader = new TextFileReader();
          break;
        case 'pdf':
          reader = new PDFReader();
          break;
        case 'csv':
          reader = new CSVReader();
          break;
        case 'md':
        case 'markdown':
          reader = new MarkdownReader();
          break;
        case 'docx':
          reader = new DocxReader();
          break;
        case 'html':
          reader = new HTMLReader();
          break;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'image':
          reader = new ImageReader();
          break;
        case 'json':
          reader = new JSONReader();
          break;
        default:
          throw new Error(`Unsupported file type: ${type}`);
      }

      // Load and parse the content using the reader
      let rawText: string;
      if (textData !== undefined) {
        // We already have text (for text-based files), so we can use it directly.
        rawText = textData;
      } else if (tempFilePath) {
        // Use the reader to load data from the temp file
        const documents = await reader.loadData(tempFilePath);
        // Combine text from all documents (if multiple)
        rawText = documents
          .map((doc) =>
            typeof doc.getText === 'function' ? doc.getText() : String(doc),
          )
          .join('\n');
        // Clean up the temporary file
        await fs.promises.unlink(tempFilePath).catch(() => {
          /* ignore errors on cleanup */
        });
      } else {
        // Fallback: no data was obtained
        throw new Error('Failed to retrieve document content for parsing.');
      }

      // Preprocess the extracted text for cleanliness
      // Split the text into different chunks
      const originalText = rawText;
      const results = await this.preprocessText(originalText);
      return results;
    } catch (err: any) {
      throw Error(`Failed to parse document: ${err.message}`);
    }
  }
}
