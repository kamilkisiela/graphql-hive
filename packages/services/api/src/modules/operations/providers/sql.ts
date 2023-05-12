type Value = string | readonly string[];

type ArrayValue = {
  readonly kind: 'array';
  readonly dataType: string;
  readonly values: readonly string[];
};

type JoinValue = {
  readonly kind: 'join';
  readonly separator: string;
  readonly values: ReadonlyArray<SqlValue | string>;
};

type RawValue = {
  readonly kind: 'raw';
  readonly sql: string;
};

export type SqlValue = {
  readonly kind: 'sql';
  readonly sql: string;
  readonly values: readonly Value[];
};

type ValueExpression = string | SpecialValues;
type SpecialValues = SqlValue | ArrayValue | JoinValue | RawValue;

type SqlTaggedTemplate = {
  (template: TemplateStringsArray, ...values: ValueExpression[]): SqlValue;
  array: (values: Value, memberType: string) => ArrayValue;
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
    throw new Error('Value list must have at least 1 member.');
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
        'Invalid list member type. Must be a SQL token or a primitive value expression.',
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
      throw new TypeError('Unexpected value expression.');
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

function stringifyValue(value: Value): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return `[${value.map(v => `'${v}'`).join(', ')}]`;
  }

  throw new Error('Unexpected value. Expected a string or an array of strings.');
}
