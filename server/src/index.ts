import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createInMemoryRepo } from './repo.js';

const port = Number(process.env.PORT ?? 3000);
const app = createApp({ repo: createInMemoryRepo() });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`AAbill server listening on :${info.port}`);
});
