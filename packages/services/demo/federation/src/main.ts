import { yoga as yogaProducts } from './products';
import { yoga as yogaReviews } from './reviews';
import { yoga as yogaUsers } from './users';

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/users')) {
      return yogaUsers.fetch(request);
    }
    if (url.pathname.startsWith('/products')) {
      return yogaProducts.fetch(request);
    }
    if (url.pathname.startsWith('/reviews')) {
      return yogaReviews.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
