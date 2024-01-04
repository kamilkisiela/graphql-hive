import { parse, print } from 'graphql';
import {
  applyTagFilterToInaccessibleTransformOnSubgraphSchema,
  extractTagsFromFederation2SupergraphSDL,
  getFederationTagDirectiveNameForSubgraphSDL,
  getTagDirectiveNameFromFederation2SupergraphSDL,
  type Federation2SubgraphDocumentNodeByTagsFilter,
} from './federation-tag-extraction';

describe('getFederationTagDirectiveNameForSubgraphSDL', () => {
  test('subgraph specification without link directive (Federation 1) -> "tag"', () => {
    const sdl = parse(/* GraphQL */ `
      schema {
        query: Query
      }
    `);

    expect(getFederationTagDirectiveNameForSubgraphSDL(sdl)).toEqual('tag');
  });

  test('subgraph specification with link subgraph directive (Federation 2) -> "federation__tag"', () => {
    const sdl = parse(/* GraphQL */ `
      schema @link(url: "https://specs.apollo.dev/federation/v2.0") {
        query: Query
      }
    `);

    expect(getFederationTagDirectiveNameForSubgraphSDL(sdl)).toEqual('federation__tag');
  });

  test('subgraph specification with link subgraph directive granular import (Federation 2) -> "tag"', () => {
    const sdl = parse(/* GraphQL */ `
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }
    `);

    expect(getFederationTagDirectiveNameForSubgraphSDL(sdl)).toEqual('tag');
  });

  test('subgraph specification with link subgraph directive granular import object (Federation 2) -> "tag"', () => {
    const sdl = parse(/* GraphQL */ `
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: [{ name: "@tag" }]) {
        query: Query
      }
    `);

    expect(getFederationTagDirectiveNameForSubgraphSDL(sdl)).toEqual('tag');
  });

  test('subgraph specification with link subgraph directive granular import object lias (Federation 2) -> "label"', () => {
    const sdl = parse(/* GraphQL */ `
      schema
        @link(
          url: "https://specs.apollo.dev/federation/v2.0"
          import: [{ name: "@tag", as: "@label" }]
        ) {
        query: Query
      }
    `);

    expect(getFederationTagDirectiveNameForSubgraphSDL(sdl)).toEqual('label');
  });
});

describe('applyTagFilterToInaccessibleTransformOnSubgraphSchema', () => {
  describe('correct @inaccessible directive usage based on subgraph version/imports', () => {
    test('Federation 1', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: null,
      };
      const sdl = parse(/* GraphQL */ `
        schema {
          query: Query
        }

        type Query {
          field1: String!
          field2: Type1!
        }

        type Type1 {
          field1: String!
        }
      `);

      const outputSdl = print(applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter));
      expect(outputSdl).toMatchInlineSnapshot(`
      schema {
        query: Query
      }

      type Query {
        field1: String! @inaccessible
        field2: Type1! @inaccessible
      }

      type Type1 {
        field1: String! @inaccessible
      }
    `);
    });

    test('Federation 2 without "import" argument', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: null,
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0") {
          query: Query
        }

        type Query {
          field1: String!
          field2: Type1!
        }

        type Type1 {
          field1: String!
        }
      `);

      const outputSdl = print(applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter));
      expect(outputSdl).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0") {
        query: Query
      }

      type Query {
        field1: String! @federation__inaccessible
        field2: Type1! @federation__inaccessible
      }

      type Type1 {
        field1: String! @federation__inaccessible
      }
    `);
    });

    test('Federation 2 with "import" argument', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: null,
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@inaccessible"]) {
          query: Query
        }

        type Query {
          field1: String!
          field2: Type1!
        }

        type Type1 {
          field1: String!
        }
      `);

      const outputSdl = print(applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter));
      expect(outputSdl).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@inaccessible"]) {
        query: Query
      }

      type Query {
        field1: String! @inaccessible
        field2: Type1! @inaccessible
      }

      type Type1 {
        field1: String! @inaccessible
      }
    `);
    });

    test('Federation 2 with "import" argument alias', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: null,
      };
      const sdl = parse(/* GraphQL */ `
        schema
          @link(
            url: "https://specs.apollo.dev/federation/v2.0"
            import: [{ name: "@inaccessible", as: "@inaccessible__federation" }]
          ) {
          query: Query
        }

        type Query {
          field1: String!
          field2: Type1!
        }

        type Type1 {
          field1: String!
        }
      `);

      const outputSdl = print(applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter));
      expect(outputSdl).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: [{name: "@inaccessible", as: "@inaccessible__federation"}]) {
        query: Query
      }

      type Query {
        field1: String! @inaccessible__federation
        field2: Type1! @inaccessible__federation
      }

      type Type1 {
        field1: String! @inaccessible__federation
      }
    `);
    });
  });

  describe('object type', () => {
    test('include of object type field via single filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: null,
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: String! @tag(name: "tag1")
          field2: String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1: String!
        field2: String! @federation__inaccessible
      }
    `);
    });

    test('include of object type field via complex filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1', 'tag2']),
        exclude: null,
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: String! @tag(name: "tag1")
          field2: String! @tag(name: "tag2")
          field2_1: String! @tag(name: "tag2")
          field3: String! @tag(name: "tag3")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1: String!
        field2: String!
        field2_1: String!
        field3: String! @federation__inaccessible
      }
    `);
    });

    test('exclude of object type field via single filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: String! @tag(name: "tag1")
          field2: String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1: String! @federation__inaccessible
        field2: String!
      }
    `);
    });

    test('exclude of object type field via complex filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1', 'tag2']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: String! @tag(name: "tag1")
          field2: String! @tag(name: "tag2")
          field2_1: String! @tag(name: "tag2")
          field3: String! @tag(name: "tag3")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1: String! @federation__inaccessible
        field2: String! @federation__inaccessible
        field2_1: String! @federation__inaccessible
        field3: String!
      }
    `);
    });

    test('include and exclude of object type field will result in its removal', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: new Set(['tag2']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: String! @tag(name: "tag1")
          field2: String! @tag(name: "tag1")
          field1_and_2: String! @tag(name: "tag1") @tag(name: "tag2")
          field3: String! @tag(name: "tag3")
          field4: String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1: String!
        field2: String!
        field1_and_2: String! @federation__inaccessible
        field3: String! @federation__inaccessible
        field4: String! @federation__inaccessible
      }
    `);
    });

    test('object type is excluded even if one of its fields is included', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: new Set(['tag2']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: String! @tag(name: "tag1")
          field1_1: Type2! @tag(name: "tag1")
        }

        type Type2 @tag(name: "tag2") {
          field1: ID! @tag(name: "tag1")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1: String!
        field1_1: Type2!
      }

      type Type2 @federation__inaccessible {
        field1: ID!
      }
    `);
    });
  });

  describe('interface type', () => {
    test('include of interface type field via single filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: null,
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: Interface1! @tag(name: "tag1")
        }

        interface Interface1 {
          field1: String! @tag(name: "tag1")
          field2: String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: Interface1!
        }

        interface Interface1 {
          field1: String!
          field2: String! @federation__inaccessible
        }
      `);
    });

    test('include of interface type field via complex filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1', 'tag2']),
        exclude: null,
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: Interface1! @tag(name: "tag1")
        }

        interface Interface1 {
          field1: String! @tag(name: "tag1")
          field2: String! @tag(name: "tag2")
          field3: String! @tag(name: "tag3")
          field4: String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: Interface1!
        }

        interface Interface1 {
          field1: String!
          field2: String!
          field3: String! @federation__inaccessible
          field4: String! @federation__inaccessible
        }
      `);
    });

    test('exclude of interface type field via simple filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field2: Interface1! @tag(name: "tag2")
        }

        interface Interface1 {
          field1: String! @tag(name: "tag1")
          field2: String! @tag(name: "tag2")
          field3: String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field2: Interface1!
        }

        interface Interface1 {
          field1: String! @federation__inaccessible
          field2: String!
          field3: String!
        }
      `);
    });

    test('exclude of interface type field via complex filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1', 'tag2']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field3: Interface1! @tag(name: "tag3")
        }

        interface Interface1 {
          field1: String! @tag(name: "tag1")
          field2: String! @tag(name: "tag2")
          field3: String! @tag(name: "tag3")
          field4: String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field3: Interface1!
        }

        interface Interface1 {
          field1: String! @federation__inaccessible
          field2: String! @federation__inaccessible
          field3: String!
          field4: String!
        }
      `);
    });

    test('include and exclude of interface type field will result in its removal', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: new Set(['tag2', 'tag3']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field3: Interface1! @tag(name: "tag1")
        }

        interface Interface1 {
          field1: String! @tag(name: "tag1") @tag(name: "tag2")
          field2: String! @tag(name: "tag3")
          field3: String! @tag(name: "tag3")
          field4: String! @tag(name: "tag1")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field3: Interface1!
        }

        interface Interface1 {
          field1: String! @federation__inaccessible
          field2: String! @federation__inaccessible
          field3: String! @federation__inaccessible
          field4: String!
        }
      `);
    });

    test('include interface type via filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: null,
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: Interface1! @tag(name: "tag1")
          field2: Interface2!
        }

        interface Interface1 @tag(name: "tag1") {
          field1: String!
        }

        interface Interface2 {
          field1: String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: Interface1!
          field2: Interface2! @federation__inaccessible
        }

        interface Interface1 {
          field1: String! @federation__inaccessible
        }

        interface Interface2 {
          field1: String! @federation__inaccessible
        }
      `);
    });
  });

  describe('enum type', () => {
    test('include enum value via single filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: null,
      };

      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: Enum1
        }

        enum Enum1 {
          enumValue1 @tag(name: "tag1")
          enumValue2
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1: Enum1 @federation__inaccessible
      }

      enum Enum1 {
        enumValue1
        enumValue2 @federation__inaccessible
      }
    `);
    });

    test('include enum value via complex filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1', 'tag2']),
        exclude: null,
      };

      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: Enum1
        }

        enum Enum1 {
          enumValue1 @tag(name: "tag1")
          enumValue2 @tag(name: "tag2")
          enumValue2_1 @tag(name: "tag2")
          enumValue3 @tag(name: "tag3")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1: Enum1 @federation__inaccessible
      }

      enum Enum1 {
        enumValue1
        enumValue2
        enumValue2_1
        enumValue3 @federation__inaccessible
      }
    `);
    });

    test('exclude of enum value via single filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: Enum1!
        }

        enum Enum1 {
          enumValue1 @tag(name: "tag1")
          enumValue2
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1: Enum1!
      }

      enum Enum1 {
        enumValue1 @federation__inaccessible
        enumValue2
      }
    `);
    });

    test('exclude of enum type value via complex filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1', 'tag2']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: Enum1!
        }

        enum Enum1 {
          enumValue1 @tag(name: "tag1")
          enumValue2 @tag(name: "tag2")
          enumValue2_1 @tag(name: "tag2")
          enumValue3 @tag(name: "tag3")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1: Enum1!
      }

      enum Enum1 {
        enumValue1 @federation__inaccessible
        enumValue2 @federation__inaccessible
        enumValue2_1 @federation__inaccessible
        enumValue3
      }
    `);
    });

    test('include and exclude of enum type value will result in its removal', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: new Set(['tag2']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1: Enum1! @tag(name: "tag1")
        }

        enum Enum1 {
          enumValue1 @tag(name: "tag1")
          enumValue2 @tag(name: "tag1")
          enumValue2_1 @tag(name: "tag1") @tag(name: "tag2")
          enumValue3 @tag(name: "tag3")
          enumValue4
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1: Enum1!
      }

      enum Enum1 {
        enumValue1
        enumValue2
        enumValue2_1 @federation__inaccessible
        enumValue3 @federation__inaccessible
        enumValue4 @federation__inaccessible
      }
    `);
    });
  });

  describe('input object type', () => {
    test('include input object type field via single filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: null,
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1(input: Type1! @tag(name: "tag1")): String! @tag(name: "tag1")
        }

        input Type1 {
          field1: String! @tag(name: "tag1")
          field2: String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1(input: Type1!): String!
      }

      input Type1 {
        field1: String!
        field2: String! @federation__inaccessible
      }
    `);
    });

    test('include input object value via complex filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1', 'tag2']),
        exclude: null,
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1(input: Type1! @tag(name: "tag1")): String! @tag(name: "tag1")
        }

        input Type1 {
          field1: String! @tag(name: "tag1")
          field2: String! @tag(name: "tag2")
          field2_1: String! @tag(name: "tag2")
          field3: String! @tag(name: "tag3")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      // Note: this results in an invalid schema, but still follows the rules of the filtering
      // The filtered schema must be validated afterwards.
      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1(input: Type1!): String!
      }

      input Type1 {
        field1: String!
        field2: String!
        field2_1: String!
        field3: String! @federation__inaccessible
      }
    `);
    });

    test('exclude of input object type field via single filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1(input: Type1!): String! @tag(name: "tag1")
        }

        input Type1 {
          field1: String! @tag(name: "tag1")
          field2: String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1(input: Type1!): String! @federation__inaccessible
      }

      input Type1 {
        field1: String! @federation__inaccessible
        field2: String!
      }
    `);
    });

    test('exclude of input object type field via complex filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1', 'tag2']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1(input: Type1!): String!
        }

        input Type1 {
          field1: String! @tag(name: "tag1")
          field2: String! @tag(name: "tag2")
          field2_1: String! @tag(name: "tag2")
          field3: String! @tag(name: "tag3")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      // Note: this results in an invalid schema, but still follows the rules of the filtering
      // The filtered schema must be validated afterwards.
      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1(input: Type1!): String!
      }

      input Type1 {
        field1: String! @federation__inaccessible
        field2: String! @federation__inaccessible
        field2_1: String! @federation__inaccessible
        field3: String!
      }
    `);
    });

    test('include and exclude of input type field will result in its removal', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: new Set(['tag2']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1(input: Type1! @tag(name: "tag1")): String! @tag(name: "tag1")
        }

        input Type1 {
          field1: String! @tag(name: "tag1")
          field2: String! @tag(name: "tag1")
          field2_1: String! @tag(name: "tag1") @tag(name: "tag2")
          field3: String! @tag(name: "tag3")
          field4: String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      // Note: this results in an invalid schema, but still follows the rules of the filtering
      // The filtered schema must be validated afterwards.
      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1(input: Type1!): String!
      }

      input Type1 {
        field1: String!
        field2: String!
        field2_1: String! @federation__inaccessible
        field3: String! @federation__inaccessible
        field4: String! @federation__inaccessible
      }
    `);
    });
  });

  describe('object type field arguments', () => {
    test('object field arguments are included via single filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: null,
      };

      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1(arg1: String! @tag(name: "tag1"), arg2: String): String! @tag(name: "tag1")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1(arg1: String!, arg2: String @federation__inaccessible): String!
      }
    `);
    });

    test('object field arguments are included via complex filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1', 'tag2']),
        exclude: null,
      };

      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1(
            arg1: String! @tag(name: "tag1")
            arg2: String! @tag(name: "tag2")
            arg3: String @tag(name: "tag3")
          ): String! @tag(name: "tag1")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1(arg1: String!, arg2: String!, arg3: String @federation__inaccessible): String!
      }
    `);
    });

    test('exclude of object field arguments via single filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1(arg1: String @tag(name: "tag1"), arg2: String!): String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      // Note: this results in an invalid schema, but still follows the rules of the filtering
      // The filtered schema must be validated afterwards.
      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1(arg1: String @federation__inaccessible, arg2: String!): String!
      }
    `);
    });

    test('exclude of object type field arguments via complex filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1', 'tag2']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1(arg1: String @tag(name: "tag1"), arg2: String! @tag(name: "tag2")): String!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      // Note: this results in an invalid schema, but still follows the rules of the filtering
      // The filtered schema must be validated afterwards.
      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1(arg1: String @federation__inaccessible, arg2: String! @federation__inaccessible): String!
      }
    `);
    });

    test('include and exclude of object type field arguments will result in its removal', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: new Set(['tag2']),
      };
      const sdl = parse(/* GraphQL */ `
        schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
          query: Query
        }

        type Query {
          field1(
            arg1: String! @tag(name: "tag1")
            arg2: String! @tag(name: "tag1") @tag(name: "tag2")
          ): String! @tag(name: "tag1")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      // Note: this results in an invalid schema, but still follows the rules of the filtering
      // The filtered schema must be validated afterwards.
      expect(print(outputSdl)).toMatchInlineSnapshot(`
      schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"]) {
        query: Query
      }

      type Query {
        field1(arg1: String!, arg2: String! @federation__inaccessible): String!
      }
    `);
    });
  });

  describe('scalar type', () => {
    test('include of scalar type field via single filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: null,
      };

      const sdl = parse(/* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        scalar Scalar1 @tag(name: "tag1")
        scalar Scalar2

        type Query {
          field1: Scalar1! @tag(name: "tag1")
          field2: Scalar2!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

      scalar Scalar1

      scalar Scalar2 @federation__inaccessible

      type Query {
        field1: Scalar1!
        field2: Scalar2! @federation__inaccessible
      }
    `);
    });

    test('include of scalar type via complex filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1', 'tag2']),
        exclude: null,
      };

      const sdl = parse(/* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        scalar Scalar1 @tag(name: "tag1")
        scalar Scalar2 @tag(name: "tag2")

        type Query {
          field1: Scalar1! @tag(name: "tag1")
          field2: Scalar2! @tag(name: "tag2")
          field3: Scalar2!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

      scalar Scalar1

      scalar Scalar2

      type Query {
        field1: Scalar1!
        field2: Scalar2!
        field3: Scalar2! @federation__inaccessible
      }
    `);
    });

    test('exclude of scalar type via single filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1']),
      };

      const sdl = parse(/* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        scalar Scalar1 @tag(name: "tag1")
        scalar Scalar2 @tag(name: "tag2")

        type Query {
          field1: Scalar1! @tag(name: "tag1")
          field2: Scalar2! @tag(name: "tag2")
          field3: Scalar2!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

      scalar Scalar1 @federation__inaccessible

      scalar Scalar2

      type Query {
        field1: Scalar1! @federation__inaccessible
        field2: Scalar2!
        field3: Scalar2!
      }
    `);
    });

    test('exclude of scalar type via complex filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1', 'tag2']),
      };

      const sdl = parse(/* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        scalar Scalar1 @tag(name: "tag1")
        scalar Scalar2

        type Query {
          field1: Scalar1! @tag(name: "tag1")
          field2: Scalar2! @tag(name: "tag2")
          field3: Scalar2!
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

      scalar Scalar1 @federation__inaccessible

      scalar Scalar2

      type Query {
        field1: Scalar1! @federation__inaccessible
        field2: Scalar2! @federation__inaccessible
        field3: Scalar2!
      }
    `);
    });

    test('include and exclude of scalar type will result in its removal', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: new Set(['tag2']),
      };

      const sdl = parse(/* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        scalar Scalar1 @tag(name: "tag1")
        scalar Scalar2 @tag(name: "tag1") @tag(name: "tag2")

        type Query {
          field1: Scalar1! @tag(name: "tag1")
          field2: Scalar2! @tag(name: "tag2")
          field3: Scalar2! @tag(name: "tag2")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
      extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

      scalar Scalar1

      scalar Scalar2 @federation__inaccessible

      type Query {
        field1: Scalar1!
        field2: Scalar2! @federation__inaccessible
        field3: Scalar2! @federation__inaccessible
      }
    `);
    });
  });

  describe('union type', () => {
    test('include union type via single filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: null,
      };

      const sdl = parse(/* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Type1 {
          field1: String! @tag(name: "tag1")
        }

        type Type2 {
          field1: String! @tag(name: "tag1")
        }

        union Union1 @tag(name: "tag1") = Type1 | Type2
        union Union2 = Type1 | Type2

        type Query {
          field1: Union1 @tag(name: "tag1")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Type1 {
          field1: String!
        }

        type Type2 {
          field1: String!
        }

        union Union1 = Type1 | Type2

        union Union2 @federation__inaccessible = Type1 | Type2

        type Query {
          field1: Union1
        }
      `);
    });

    test('include union type via complex filter.include value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1', 'tag2']),
        exclude: null,
      };

      const sdl = parse(/* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Type1 {
          field1: String! @tag(name: "tag1")
        }

        type Type2 {
          field1: String! @tag(name: "tag1")
        }

        union Union1 @tag(name: "tag1") = Type1 | Type2
        union Union2 @tag(name: "tag2") = Type1 | Type2
        union Union3 @tag(name: "tag3") = Type1 | Type2

        type Query {
          field1: Union1 @tag(name: "tag1")
          field2: Union2 @tag(name: "tag2")
          field3: Union3 @tag(name: "tag3")
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Type1 {
          field1: String!
        }

        type Type2 {
          field1: String!
        }

        union Union1 = Type1 | Type2

        union Union2 = Type1 | Type2

        union Union3 @federation__inaccessible = Type1 | Type2

        type Query {
          field1: Union1
          field2: Union2
          field3: Union3 @federation__inaccessible
        }
      `);
    });

    test('exclude union type via single filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1']),
      };

      const sdl = parse(/* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Type1 {
          field1: String!
        }

        type Type2 {
          field1: String!
        }

        union Union1 @tag(name: "tag1") = Type1 | Type2
        union Union2 @tag(name: "tag2") = Type1 | Type2
        union Union3 = Type1 | Type2

        type Query {
          field1: Union1 @tag(name: "tag1")
          field2: Union2 @tag(name: "tag2")
          field3: Union3
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Type1 {
          field1: String!
        }

        type Type2 {
          field1: String!
        }

        union Union1 @federation__inaccessible = Type1 | Type2

        union Union2 = Type1 | Type2

        union Union3 = Type1 | Type2

        type Query {
          field1: Union1 @federation__inaccessible
          field2: Union2
          field3: Union3
        }
      `);
    });

    test('exclude union type via complex filter.exclude value', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: null,
        exclude: new Set(['tag1', 'tag2']),
      };

      const sdl = parse(/* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Type1 {
          field1: String!
        }

        type Type2 {
          field1: String!
        }

        union Union1 @tag(name: "tag1") = Type1 | Type2
        union Union2 @tag(name: "tag2") = Type1 | Type2
        union Union3 = Type1 | Type2

        type Query {
          field1: Union1 @tag(name: "tag1")
          field2: Union2 @tag(name: "tag2")
          field3: Union3
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Type1 {
          field1: String!
        }

        type Type2 {
          field1: String!
        }

        union Union1 @federation__inaccessible = Type1 | Type2

        union Union2 @federation__inaccessible = Type1 | Type2

        union Union3 = Type1 | Type2

        type Query {
          field1: Union1 @federation__inaccessible
          field2: Union2 @federation__inaccessible
          field3: Union3
        }
      `);
    });

    test('include and exclude of union type will result in its removal', () => {
      const filter: Federation2SubgraphDocumentNodeByTagsFilter = {
        include: new Set(['tag1']),
        exclude: new Set(['tag2']),
      };

      const sdl = parse(/* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Type1 {
          field1: String!
        }

        type Type2 {
          field1: String!
        }

        union Union1 @tag(name: "tag1") = Type1 | Type2
        union Union2 @tag(name: "tag2") @tag(name: "tag1") = Type1 | Type2
        union Union3 = Type1 | Type2

        type Query {
          field1: Union1 @tag(name: "tag1")
          field2: Union2 @tag(name: "tag2") @tag(name: "tag1")
          field3: Union3
        }
      `);

      const outputSdl = applyTagFilterToInaccessibleTransformOnSubgraphSchema(sdl, filter);

      expect(print(outputSdl)).toMatchInlineSnapshot(`
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Type1 {
          field1: String! @federation__inaccessible
        }

        type Type2 {
          field1: String! @federation__inaccessible
        }

        union Union1 = Type1 | Type2

        union Union2 @federation__inaccessible = Type1 | Type2

        union Union3 @federation__inaccessible = Type1 | Type2

        type Query {
          field1: Union1
          field2: Union2 @federation__inaccessible
          field3: Union3 @federation__inaccessible
        }
      `);
    });
  });
});

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

  test('supergraph import with alias -> federation__tag', () => {
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
