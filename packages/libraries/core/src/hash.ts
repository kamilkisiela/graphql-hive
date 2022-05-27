import { createHash } from 'node:crypto';

export function hashOperation(operation: string) {
  return createHash('md5').update(operation, 'utf8').digest('hex');
}
