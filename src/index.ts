import { bootstrap, setVectorHandler, setParserHandler } from 'nestbox-ai-document-base';

import { ChromaDbHandler } from './chromaDbHandler';
import { LlamaIndexParserHandler } from './llamaindexPraserHandler';

setVectorHandler(new ChromaDbHandler());
setParserHandler(new LlamaIndexParserHandler());

bootstrap();