import { buildCurlCommand } from './curl';

const ENDPOINT = 'https://api.example.com/graphql';

describe('buildCurlCommand', () => {
  it('posts the operation as JSON', () => {
    const command = buildCurlCommand({ endpoint: ENDPOINT, query: '{ me { id } }' });

    expect(command).toContain('-X POST');
    expect(command).toContain(`'${ENDPOINT}'`);
    expect(command).toContain(`-H 'content-type: application/json'`);
    expect(command).toContain('"query":"{\\n  me {\\n    id\\n  }\\n}"');
  });

  it('lets preflight headers win over operation headers', () => {
    const command = buildCurlCommand({
      endpoint: ENDPOINT,
      query: '{ me { id } }',
      preflightHeaders: { authorization: 'from-preflight', 'x-trace': 'keep-me' },
      headers: '{"Authorization":"from-operation","x-op":"mine"}',
    });

    expect(command).toContain(`-H 'authorization: from-preflight'`);
    expect(command).not.toContain('from-operation');
    expect(command).toContain(`-H 'x-trace: keep-me'`);
    expect(command).toContain(`-H 'x-op: mine'`);
  });

  it('substitutes env and plugin templates the way the executor does', () => {
    const command = buildCurlCommand({
      endpoint: ENDPOINT,
      query: '{ me { id } }',
      headers: '{"authorization":"Bearer {{token}}"}',
      variables: '{"slug":"{{plugins.target.slug}}"}',
      env: { token: 'secret' },
      pluginsState: { target: { slug: 'my-target' } },
    });

    expect(command).toContain('Bearer secret');
    expect(command).toContain('"slug":"my-target"');
  });

  it('keeps fragments but drops the operations that were not selected', () => {
    const command = buildCurlCommand({
      endpoint: ENDPOINT,
      query: `query A { me { ...F } } query B { other } fragment F on User { id }`,
      operationName: 'A',
    });

    expect(command).toContain('query A');
    expect(command).toContain('fragment F on User');
    expect(command).not.toContain('query B');
    expect(command).toContain('"operationName":"A"');
  });

  it('moves the document onto the query string for GET', () => {
    const command = buildCurlCommand({
      endpoint: ENDPOINT,
      query: '{ me { id } }',
      variables: '{"a":1}',
      settings: { fetch: { credentials: 'same-origin', useGETForQueries: true } },
    });

    expect(command).not.toContain('-X POST');
    expect(command).not.toContain('-d ');
    expect(command).not.toContain('content-type');
    expect(command).toContain('query=');
    expect(command).toContain('variables=');
  });

  it('escapes single quotes so the command stays one shell token', () => {
    const command = buildCurlCommand({
      endpoint: ENDPOINT,
      query: '{ me { id } }',
      headers: `{"x-note":"it's here"}`,
    });

    expect(command).toContain(`-H 'x-note: it'\\''s here'`);
  });

  it('omits variables and extensions when empty rather than sending {}', () => {
    const command = buildCurlCommand({
      endpoint: ENDPOINT,
      query: '{ me { id } }',
      variables: '{}',
      extensions: '',
    });

    expect(command).not.toContain('"variables"');
    expect(command).not.toContain('"extensions"');
  });

  it('falls back to the raw query when it cannot be parsed', () => {
    const command = buildCurlCommand({ endpoint: ENDPOINT, query: '{ me { id }' });

    expect(command).toContain('{ me { id }');
  });
});
