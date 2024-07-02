import { config } from 'dotenv';

config({
  debug: true,
  encoding: 'utf8',
});

await import('./index');
