import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// Import LlamaIndex readers for various file types
import { TextFileReader } from '@llamaindex/readers/text';
import { PDFReader } from '@llamaindex/readers/pdf';
import { DocxReader } from '@llamaindex/readers/docx';
import { MarkdownReader } from '@llamaindex/readers/markdown';
import { CSVReader } from '@llamaindex/readers/csv';
import { HTMLReader } from '@llamaindex/readers/html';
import { ImageReader } from '@llamaindex/readers/image';
import { JSONReader } from '@llamaindex/readers/json';  // if JSON support is needed
import { ParseHandler } from 'nestbox-ai-document-base';

export class LlamaIndexParserHandler implements ParseHandler {
  async parse(input: { document?: string; url?: string; type: string }): Promise<string> {
    try {
      // Determine source of content
      const { document: docContent, url, type } = input;
      if (!docContent && !url) {
        throw new Error('No document or URL provided for parsing.');
      }

      // Determine file type (extension) in lowercase for comparison
      const fileType = type.toLowerCase();
      let textData: string | undefined = undefined;
      let tempFilePath: string | undefined = undefined;

      // If URL is provided, download the file
      if (url && !docContent) {
        // Configure Axios for binary data (covers text and binary files)
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const dataBuffer = Buffer.from(response.data);

        // If the file type is inherently text-based, convert buffer to string directly
        if (['txt', 'text', 'md', 'markdown', 'html', 'csv', 'json'].includes(fileType)) {
          textData = dataBuffer.toString('utf-8');
        } else {
          // For binary files (pdf, docx, images, etc.), write to a temporary file
          const extension = fileType.startsWith('.') ? fileType.slice(1) : fileType;
          tempFilePath = path.join(os.tmpdir(), `llamaindex_temp_${Date.now()}_${Math.random().toString(16).slice(2)}.${extension}`);
          await fs.promises.writeFile(tempFilePath, dataBuffer);
        }
      }

      // If document content is provided directly (e.g., already extracted text)
      if (docContent) {
        if (typeof docContent !== 'string') {
          throw new Error('Provided document content is not a string.');
        }
        // Use the content directly for text-based types
        if (['txt', 'text', 'md', 'markdown', 'html', 'csv', 'json'].includes(fileType)) {
          textData = docContent;
        } else {
          // If a binary file content is somehow provided as string (unlikely), throw an error for now
          throw new Error(`Cannot parse raw content for file type "${fileType}". A URL should be provided instead.`);
        }
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
        rawText = documents.map(doc => (typeof doc.getText === 'function' ? doc.getText() : String(doc))).join('\n');
        // Clean up the temporary file
        await fs.promises.unlink(tempFilePath).catch(() => {/* ignore errors on cleanup */});
      } else {
        // Fallback: no data was obtained
        throw new Error('Failed to retrieve document content for parsing.');
      }

      // Preprocess the extracted text for cleanliness
      let cleanedText = rawText;
      // Normalize line breaks to \n
      cleanedText = cleanedText.replace(/\r\n/g, '\n');
      // Remove excessive whitespace (more than 2 newlines -> 2, multiple spaces -> single)
      cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n');  // no more than one blank line
      cleanedText = cleanedText.replace(/[ \t]{2,}/g, ' ');       // collapse multiple spaces/tabs
      // Trim leading/trailing whitespace
      cleanedText = cleanedText.trim();

      return cleanedText;
    } catch (err: any) {
      // Catch all errors and return in wrapped format
      const errorMessage = err?.message || String(err);
      return `Error: ${errorMessage}`;
    }
  }
}
