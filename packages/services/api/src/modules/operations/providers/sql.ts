type Value = string | readonly string[];

type ArrayValue = {
  readonly kind: 'array';
  readonly dataType: string;
  readonly values: readonly string[];
};

type LongArrayValue = {
  readonly kind: 'longArray';
  readonly dataType: string;
  readonly values: readonly string[];
};

type JoinValue = {
  readonly kind: 'join';
  readonly separator: string;
  readonly values: ReadonlyArray<SqlValue | string>;
};

export type RawValue = {
  readonly kind: 'raw';
  readonly sql: string;
};

export type SqlValue = {
  readonly kind: 'sql';
  readonly sql: string;
  readonly values: readonly Value[];
};

type ValueExpression = string | SpecialValues;
type SpecialValues = SqlValue | ArrayValue | LongArrayValue | JoinValue | RawValue;

type SqlTaggedTemplate = {
  (template: TemplateStringsArray, ...values: ValueExpression[]): SqlValue;
  array: (values: Value, memberType: string) => ArrayValue;
  longArray: (values: Value, memberType: string) => LongArrayValue;
  join: (values: readonly SqlValue[], separator: string) => JoinValue;
  raw: (sql: string) => RawValue;
};

export type SqlStatement = Pick<SqlValue, 'sql' | 'values'>;

function isOfKind<T extends SpecialValues>(value: unknown, kind: T['kind']): value is T {
  return !!value && typeof value === 'object' && 'kind' in value && value.kind === kind;
}

function isSqlValue(value: unknown): value is SqlValue {
  return isOfKind<SqlValue>(value, 'sql');
}

function isArrayValue(value: unknown): value is ArrayValue {
  return isOfKind<ArrayValue>(value, 'array');
}

function isLongArrayValue(value: unknown): value is LongArrayValue {
  return isOfKind<LongArrayValue>(value, 'longArray');
}

function isJoinValue(value: unknown): value is JoinValue {
  return isOfKind<JoinValue>(value, 'join');
}

function isRawValue(value: unknown): value is RawValue {
  return isOfKind<RawValue>(value, 'raw');
}

function createParamPlaceholder(index: number, dataType: string) {
  return `{p${index}: ${dataType}}`;
}

const createSqlFragment = (token: SqlValue, greatestParameterPosition: number): SqlValue => {
  let sql = '';

  let leastMatchedParameterPosition = Number.POSITIVE_INFINITY;
  let greatestMatchedParameterPosition = 0;

  sql += token.sql.replace(/\{p(\d+)/gu, (_, g1) => {
    const parameterPosition = Number.parseInt(g1, 10);

    if (parameterPosition > greatestMatchedParameterPosition) {
      greatestMatchedParameterPosition = parameterPosition;
    }

    if (parameterPosition < leastMatchedParameterPosition) {
      leastMatchedParameterPosition = parameterPosition;
    }

    return '{p' + String(parameterPosition + greatestParameterPosition);
  });

  if (greatestMatchedParameterPosition > token.values.length) {
    throw new Error(
      'The greatest parameter position is greater than the number of parameter values.',
    );
  }

  if (
    leastMatchedParameterPosition !== Number.POSITIVE_INFINITY &&
    leastMatchedParameterPosition !== 1
  ) {
    throw new Error('Parameter position must start at 1.');
  }

  return {
    kind: 'sql',
    sql,
    values: token.values,
  };
};

export const createJoinSqlFragment = (
  token: JoinValue,
  greatestParameterPosition: number,
): SqlValue => {
  const values: Value[] = [];
  const placeholders: Array<Value | null> = [];

  let placeholderIndex = greatestParameterPosition;

  if (token.values.length === 0) {
    throw new Error('sql.join: must have at least 1 member.');
  }

  for (const value of token.values) {
    if (isSqlValue(value)) {
      const sqlFragment = createSqlFragment(value, placeholderIndex);

      placeholders.push(sqlFragment.sql);
      placeholderIndex += sqlFragment.values.length;
      values.push(...sqlFragment.values);
    } else if (typeof value === 'string') {
      placeholders.push(createParamPlaceholder(++placeholderIndex, 'String'));
      values.push(value);
    } else {
      throw new Error(
        'sql.join: Invalid list member type. Must be a SQL token or a primitive value expression.',
      );
    }
  }

  return {
    kind: 'sql',
    sql: placeholders.join(token.separator),
    values: values,
  };
};

const createSqlQuery = (parts: readonly string[], values: readonly ValueExpression[]) => {
  let rawSql = '';
  const parameterValues: Value[] = [];

  let index = 0;

  for (const part of parts) {
    const token = values[index++];

    rawSql += part;

    if (index >= parts.length) {
      continue;
    }

    if (token === undefined) {
      throw new Error('SQL tag cannot be bound an undefined value.');
    } else if (isSqlValue(token)) {
      const sqlFragment = createSqlFragment(token, parameterValues.length);

      rawSql += sqlFragment.sql;
      parameterValues.push(...sqlFragment.values);
    } else if (isArrayValue(token)) {
      rawSql += createParamPlaceholder(parameterValues.length + 1, 'Array(String)');
      parameterValues.push(token.values);
    } else if (isLongArrayValue(token)) {
      // It will basically create a string like this:
      // arrayConcat({p1: Array(String)}, {p2: Array(String)}, ...)
      // Use a limit of characters (take the default setting of clickhouse)
      // check if the next pushed value will exceed the limit
      // if it does, then push the current value and start a new one
      // if it doesn't, then append the value to the current value
      const charactersLimit = 10_000;
      const batches: string[][] = [];
      let currentBatch: string[] = [];
      batches.push(currentBatch);

      let currentCharacters = 0;

      for (const value of token.values) {
        // we must assume that every added value will be wrapped with double quotes
        // and that the join will be a comma
        // so for every value we must add 3 characters, just in case.
        const valueCharacters = value.length + 3;

        if (currentCharacters + valueCharacters >= charactersLimit) {
          currentBatch = [];
          batches.push(currentBatch);
          currentCharacters = 0;
        }

        currentBatch.push(value);
        currentCharacters += valueCharacters;
      }

      if (batches.length === 1) {
        rawSql += createParamPlaceholder(parameterValues.length + 1, 'Array(String)');
        parameterValues.push(batches[0]);
        continue;
      }

      rawSql += `arrayConcat(`;

      for (let index = 0; index < batches.length; index++) {
        if (index > 0) {
          rawSql += ', ';
        }
        rawSql += createParamPlaceholder(parameterValues.length + 1, 'Array(String)');
        parameterValues.push(batches[index]);
      }

      rawSql += ')';
    } else if (isJoinValue(token)) {
      const sqlFragment = createJoinSqlFragment(token, parameterValues.length);
      rawSql += sqlFragment.sql;
      parameterValues.push(...sqlFragment.values);
    } else if (isRawValue(token)) {
      rawSql += token.sql;
    } else if (typeof token === 'string') {
      rawSql += createParamPlaceholder(parameterValues.length + 1, 'String');
      parameterValues.push(token);
    } else {
      throw new TypeError('sql: Unexpected value expression.');
    }
  }

  return {
    sql: rawSql,
    values: parameterValues,
  };
};

function sqlTag(rawStrings: TemplateStringsArray, ...rawValues: ValueExpression[]) {
  const { sql, values } = createSqlQuery(rawStrings, rawValues);

  return {
    kind: 'sql',
    sql,
    values,
  } as SqlValue;
}

sqlTag.array = (values: Value, memberType: string): ArrayValue => {
  return {
    kind: 'array',
    dataType: memberType,
    values: Array.isArray(values) ? values : [values],
  };
};

sqlTag.longArray = (values: Value, memberType: string): LongArrayValue => {
  return {
    kind: 'longArray',
    dataType: memberType,
    values: Array.isArray(values) ? values : [values],
  };
};

sqlTag.join = (values: readonly SqlValue[], separator: string): JoinValue => {
  return {
    kind: 'join',
    separator,
    values,
  };
};

sqlTag.raw = (sql: string): RawValue => {
  return {
    kind: 'raw',
    sql,
  };
};

const createSqlTag = () => {
  return sqlTag as SqlTaggedTemplate;
};

export const sql = createSqlTag();

export function toQueryParams(statement: SqlStatement): Record<string, string> {
  const params: Record<string, string> = {};

  for (let i = 0; i < statement.values.length; i++) {
    // Params are 1-indexed
    params[`param_p${i + 1}`] = stringifyValue(statement.values[i]);
  }

  return params;
}

export function printWithValues(statement: SqlStatement): string {
  const sql = statement.sql;
  const values = statement.values;

  return sql.replace(/\{p(\d+)[^}]+\}/g, (_, pN) => {
    // it's 1-indexed
    const index = parseInt(pN, 10) - 1;
    const value = values[index];

    if (value === undefined) {
      throw new Error('SQL tag cannot be bound an undefined value.');
    }

    return printValue(value);
  });
}

function printValue(value: Value): string {
  if (typeof value === 'string') {
    return `'${value}'`;
  }

  if (Array.isArray(value)) {
    return `[${value.map(v => `'${v}'`).join(', ')}]`;
  }

  throw new Error('sql: Unexpected value. Expected a string or an array of strings.');
}

function stringifyValue(value: Value): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return `[${value.map(v => `'${v}'`).join(', ')}]`;
  }

  throw new Error('sql: Unexpected value. Expected a string or an array of strings.');
}
