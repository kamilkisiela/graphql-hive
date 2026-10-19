import { requestIdHeaders, requestIdStorage } from './request-id-storage';

describe('requestIdHeaders', () => {
  test('forwards the id of the request being handled, also after awaiting', async () => {
    await requestIdStorage.run({ requestId: 'abc' }, async () => {
      expect(requestIdHeaders()).toEqual({ 'x-request-id': 'abc' });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(requestIdHeaders()).toEqual({ 'x-request-id': 'abc' });
    });
  });

  test('sends no header outside of a request', () => {
    expect(requestIdHeaders()).toEqual({});
  });
});
