import { ReactElement } from 'react';
import clsx from 'clsx';

type Column = { key: string; align?: 'right'; width?: 'auto' };

export const Table = ({
  dataSource,
  columns,
}: {
  dataSource?: { id: string }[];
  columns: Column[] | ReadonlyArray<Column>;
}): ReactElement => {
  return (
    <table className="w-full">
      <tbody>
        {dataSource?.map((row) => (
          <tr
            key={row.id}
            className="border border-gray-600/10 text-xs odd:bg-gray-600/10"
          >
            {columns.map((column) => (
              <td
                key={column.key}
                className={clsx(
                  'break-all px-5 py-4',
                  column.align === 'right' && 'text-right',
                  column.width === 'auto' && 'w-1'
                )}
              >
                {row[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
