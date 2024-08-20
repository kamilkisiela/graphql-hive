import { batchBy } from '../helpers';

test('batchBy does not hang', async () => {
  const load = batchBy<string, string>(
    item => item,
    async items => {
      return items.map(item => Promise.resolve(item));
    },
    1,
  );

  let a = load('a');
  let aa = load('a');
  let b = load('b');
  let c = load('c');

  await Promise.all([a, aa, b, c]);
});
