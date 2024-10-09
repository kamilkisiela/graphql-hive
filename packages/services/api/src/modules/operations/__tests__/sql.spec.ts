import { printWithValues, sql } from '../providers/sql';

test('printWithValues', () => {
  expect(
    printWithValues(
      sql`SELECT * FROM table WHERE id = ${'id1'} AND timestamp > ${'date1'} AND target IN (${sql.array(
        ['target1', 'target2'],
        'String',
      )})`,
    ),
  ).toBe(
    `SELECT * FROM table WHERE id = 'id1' AND timestamp > 'date1' AND target IN (['target1', 'target2'])`,
  );
});

describe('sql.longArray', () => {
  test('values not exceeding the limit result in single parameter', () => {
    const firstValue = new Array(5_000 - 5).fill('a').join('');
    const secondValue = new Array(5_000 - 5).fill('b').join('');
    const query = sql`${sql.longArray([firstValue, secondValue], 'String')}`;
    expect(query.sql).toEqual(`{p1: Array(String)}`);
    expect(printWithValues(query).replace(firstValue, 'a').replace(secondValue, 'b')).toEqual(
      `['a', 'b']`,
    );
  });
  test('values with one exceeding the limit result in two parameters that are concatinated', () => {
    const firstValue = new Array(5_000).fill('a').join('');
    const secondValue = new Array(5_000).fill('b').join('');
    const query = sql`${sql.longArray([firstValue, secondValue], 'String')}`;
    expect(query.sql).toEqual(`arrayConcat({p1: Array(String)}, {p2: Array(String)})`);

    expect(printWithValues(query).replace(firstValue, 'a').replace(secondValue, 'b')).toEqual(
      `arrayConcat(['a'], ['b'])`,
    );
  });
});
