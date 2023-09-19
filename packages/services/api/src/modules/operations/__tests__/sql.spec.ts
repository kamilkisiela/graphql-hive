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
