import { config } from 'dotenv';
import 'reflect-metadata';

config({
  debug: true,
  encoding: 'utf8',
});

await import('./index');
