import { schemaPolicyApiRouter } from '../src/api';

describe('policy checks', () => {
  it('should return a known list of rules', async () => {
    const result = await schemaPolicyApiRouter
      .createCaller({ req: { log: console } as any })
      .availableRules();

    expect(Object.keys(result).length).toBe(22);
  });

  it('should return empty result where there are not lint rules', async () => {
    const result = await schemaPolicyApiRouter
      .createCaller({ req: { log: console } as any })
      .checkPolicy({
        source: 'type Query { foo: String }',
        schema: 'type Query { foo: String }',
        target: '1',
        policy: {},
      });

    expect(result.length).toBe(0);
  });

  it('should return errors correctly', async () => {
    const result = await schemaPolicyApiRouter
      .createCaller({ req: { log: console } as any })
      .checkPolicy({
        source: 'type Query { foo: String! }',
        schema: 'type Query { foo: String! }',
        target: '1',
        policy: {
          'require-nullable-result-in-root': ['error'],
        },
      });

    expect(result.length).toBe(1);
    expect(result).toMatchInlineSnapshot(`
      [
        {
          column: 19,
          endColumn: 25,
          endLine: 1,
          line: 1,
          message: Unexpected non-null result String in type "Query",
          messageId: require-nullable-result-in-root,
          nodeType: NonNullType,
          ruleId: require-nullable-result-in-root,
          severity: 2,
          suggestions: [
            {
              desc: Make String nullable,
              fix: {
                range: [
                  18,
                  25,
                ],
                text: String,
              },
            },
          ],
        },
      ]
    `);
  });

  it('should return warnings correctly', async () => {
    const result = await schemaPolicyApiRouter
      .createCaller({ req: { log: console } as any })
      .checkPolicy({
        source: 'type Query { foo: String }',
        schema: 'type Query { foo: String }',
        target: '1',
        policy: {
          'require-description': ['warn', { types: true, FieldDefinition: true }],
        },
      });

    expect(result.length).toBe(2);
    expect(result).toMatchInlineSnapshot(`
      [
        {
          column: 6,
          endColumn: 11,
          endLine: 1,
          line: 1,
          message: Description is required for type "Query",
          messageId: require-description,
          nodeType: null,
          ruleId: require-description,
          severity: 1,
        },
        {
          column: 14,
          endColumn: 17,
          endLine: 1,
          line: 1,
          message: Description is required for field "foo" in type "Query",
          messageId: require-description,
          nodeType: null,
          ruleId: require-description,
          severity: 1,
        },
      ]
    `);
  });
});
