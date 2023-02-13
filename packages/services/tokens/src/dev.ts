import { config } from 'dotenv';
import 'reflect-metadata';

config({
  debug: true,
});

await import('./index');
