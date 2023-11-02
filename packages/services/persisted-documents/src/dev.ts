import { config } from 'dotenv';

config({
  debug: true,
});

await import('./index');
