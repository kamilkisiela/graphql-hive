import { isKeyValid } from './auth';
import { UnexpectedError } from './errors';
import { handleRequest } from './handler';

self.addEventListener('fetch', (event) => {
  try {
    event.respondWith(handleRequest(event.request, isKeyValid));
  } catch (e) {
    event.respondWith(new UnexpectedError());
  }
});
