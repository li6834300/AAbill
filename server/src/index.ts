import { serve } from '@hono/node-server';
import { selectParser } from './ai/provider.js';
import { createApp } from './app.js';
import { createInMemoryRepo } from './repo.js';

const port = Number(process.env.PORT ?? 3000);
const { kind, parser } = selectParser(process.env);
const app = createApp({ repo: createInMemoryRepo(), parser });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`AAbill server listening on :${info.port}(AI provider: ${kind})`);
});
