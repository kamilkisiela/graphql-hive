import { parse } from 'graphql';
import {
  extractTagsFromFederation2SupergraphSDL,
  getTagDirectiveNameFromFederation2SupergraphSDL,
} from '../federation-tag-extraction';

describe('getTagDirectiveNameFromFederation2SupergraphSDL', () => {
  test('supergraph specification without import argument -> null', () => {
    const sdl = parse(/* GraphQL */ `
      schema
        @link(url: "https://specs.apollo.dev/link/v1.0")
        @link(url: "https://specs.apollo.dev/join/v0.3", for: EXECUTION) {
        query: Query
      }
    `);

    expect(getTagDirectiveNameFromFederation2SupergraphSDL(sdl)).toEqual(null);
  });

  test('supergraph import without alias -> tag', () => {
    const sdl = parse(/* GraphQL */ `
      schema
        @link(url: "https://specs.apollo.dev/link/v1.0")
        @link(url: "https://specs.apollo.dev/join/v0.3", for: EXECUTION)
        @link(url: "https://specs.apollo.dev/tag/v0.3") {
        query: Query
      }
    `);

    expect(getTagDirectiveNameFromFederation2SupergraphSDL(sdl)).toEqual('tag');
  });

  test('supergraph import with alias -> alias name', () => {
    const sdl = parse(/* GraphQL */ `
      schema
        @link(url: "https://specs.apollo.dev/link/v1.0")
        @link(url: "https://specs.apollo.dev/join/v0.3", for: EXECUTION)
        @link(url: "https://specs.apollo.dev/tag/v0.3", as: "federation__tag") {
        query: Query
      }
    `);

    expect(getTagDirectiveNameFromFederation2SupergraphSDL(sdl)).toEqual('federation__tag');
  });
});

describe('extractTagsFromFederation2SupergraphSDL', () => {
  test('supergraph specification without import argument -> null', () => {
    const sdl = parse(/* GraphQL */ `
      schema
        @link(url: "https://specs.apollo.dev/link/v1.0")
        @link(url: "https://specs.apollo.dev/join/v0.3", for: EXECUTION) {
        query: Query
      }

      type Query {
        foo: String!
      }
    `);

    expect(extractTagsFromFederation2SupergraphSDL(sdl)).toEqual(null);
  });

  test('supergraph import without alias -> tag', () => {
    const sdl = parse(/* GraphQL */ `
      schema
        @link(url: "https://specs.apollo.dev/link/v1.0")
        @link(url: "https://specs.apollo.dev/join/v0.3", for: EXECUTION)
        @link(url: "https://specs.apollo.dev/tag/v0.3") {
        query: Query
      }

      type Query {
        foo: String! @tag(name: "foo")
        kekeke: String! @tag(name: "kekeke")
      }
    `);

    expect(extractTagsFromFederation2SupergraphSDL(sdl)).toEqual(['foo', 'kekeke']);
  });

  test('supergraph import wit alias -> federation__tag', () => {
    const sdl = parse(/* GraphQL */ `
      schema
        @link(url: "https://specs.apollo.dev/link/v1.0")
        @link(url: "https://specs.apollo.dev/join/v0.3", for: EXECUTION)
        @link(url: "https://specs.apollo.dev/tag/v0.3", as: "federation__tag") {
        query: Query
      }

      type Query {
        foo: String! @federation__tag(name: "foo")
        kekeke: String!
      }
    `);

    expect(extractTagsFromFederation2SupergraphSDL(sdl)).toEqual(['foo']);
  });
});
