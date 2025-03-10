import { bootstrap, setVectorHandler, setParserHandler, ParserHandler, VectorHandler } from 'nestbox-ai-document-base';

import { ChromaVectorHandler } from './chromaDbVectorHandler';
import { LlamaIndexParseHandler } from './llamaindexPraserHandler';

setVectorHandler(new ChromaVectorHandler());
setParserHandler(new LlamaIndexParseHandler());


bootstrap();