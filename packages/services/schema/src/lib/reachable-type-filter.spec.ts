import { parse, print } from 'graphql';
import { addDirectiveOnTypes, getReachableTypes } from './reachable-type-filter';

describe('getReachableTypes', () => {
  it('includes the query type', () => {
    const documentNode = parse(/* GraphQL */ `
      type Query {
        hello: String
      }
    `);
    const reachableTypes = getReachableTypes(documentNode);
    expect(reachableTypes.size).toEqual(1);
    expect(reachableTypes.has('Query')).toEqual(true);
  });
  it('includes the mutation type', () => {
    const documentNode = parse(/* GraphQL */ `
      type Mutation {
        hello: String
      }
    `);
    const reachableTypes = getReachableTypes(documentNode);
    expect(reachableTypes.size).toEqual(1);
    expect(reachableTypes.has('Mutation')).toEqual(true);
  });
  it('includes the subscription type', () => {
    const documentNode = parse(/* GraphQL */ `
      type Subscription {
        hello: String
      }
    `);
    const reachableTypes = getReachableTypes(documentNode);
    expect(reachableTypes.size).toEqual(1);
    expect(reachableTypes.has('Subscription')).toEqual(true);
  });
  it('excludes unused root type', () => {
    const documentNode = parse(/* GraphQL */ `
      type Query {
        hello: String
      }
      type Mutation {
        hello: String
      }

      schema {
        query: Query
      }
    `);
    const reachableTypes = getReachableTypes(documentNode);
    expect(reachableTypes.size).toEqual(1);
    expect(reachableTypes.has('Query')).toEqual(true);
    expect(reachableTypes.has('Mutation')).toEqual(false);
  });
  it('includes object types referenced by root type', () => {
    const documentNode = parse(/* GraphQL */ `
      type Query {
        hello: Hello
      }
      type Hello {
        world: String
      }
    `);
    const reachableTypes = getReachableTypes(documentNode);
    expect(reachableTypes.size).toEqual(2);
    expect(reachableTypes.has('Query')).toEqual(true);
    expect(reachableTypes.has('Hello')).toEqual(true);
  });
  it('includes scalar types referenced by root type', () => {
    const documentNode = parse(/* GraphQL */ `
      type Query {
        hello: Hello
      }
      scalar Hello
    `);
    const reachableTypes = getReachableTypes(documentNode);
    expect(reachableTypes.size).toEqual(2);
    expect(reachableTypes.has('Query')).toEqual(true);
    expect(reachableTypes.has('Hello')).toEqual(true);
  });
  it('includes input types referenced by root type', () => {
    const documentNode = parse(/* GraphQL */ `
      type Query {
        hello(input: Hello): String
      }
      input Hello {
        world: String
      }
    `);
    const reachableTypes = getReachableTypes(documentNode);
    expect(reachableTypes.size).toEqual(2);
    expect(reachableTypes.has('Query')).toEqual(true);
    expect(reachableTypes.has('Hello')).toEqual(true);
  });
  it('includes enum types referenced by root type', () => {
    const documentNode = parse(/* GraphQL */ `
      type Query {
        hello: Hello
      }
      enum Hello {
        WORLD
      }
    `);
    const reachableTypes = getReachableTypes(documentNode);
    expect(reachableTypes.size).toEqual(2);
    expect(reachableTypes.has('Query')).toEqual(true);
    expect(reachableTypes.has('Hello')).toEqual(true);
  });
  it('includes union type and union members referenced by root type', () => {
    const documentNode = parse(/* GraphQL */ `
      type Query {
        hello: Hello
      }
      union Hello = World
      union Gang = World
      type World {
        world: String
      }
    `);
    const reachableTypes = getReachableTypes(documentNode);
    expect(reachableTypes.size).toEqual(3);
    expect(reachableTypes.has('Query')).toEqual(true);
    expect(reachableTypes.has('Hello')).toEqual(true);
    expect(reachableTypes.has('World')).toEqual(true);
  });
  it('includes interface type and interface members referenced by root type', () => {
    const documentNode = parse(/* GraphQL */ `
      type Query {
        hello: Hello
      }
      interface Hello {
        world: String
      }
      type World implements Hello {
        world: String
      }
    `);
    const reachableTypes = getReachableTypes(documentNode);
    expect(reachableTypes.size).toEqual(3);
    expect(reachableTypes.has('Query')).toEqual(true);
    expect(reachableTypes.has('Hello')).toEqual(true);
    expect(reachableTypes.has('World')).toEqual(true);
  });
  it('includes input type referenced by input type', () => {
    const documentNode = parse(/* GraphQL */ `
      input Hello {
        world: World
      }
      input World {
        world: String
      }
      type Query {
        hello(world: Hello): String
      }
    `);
    const reachableTypes = getReachableTypes(documentNode);
    expect(reachableTypes.size).toEqual(3);
    expect(reachableTypes.has('Query')).toEqual(true);
    expect(reachableTypes.has('Hello')).toEqual(true);
    expect(reachableTypes.has('World')).toEqual(true);
  });
});

describe('addDirectiveOnTypes', () => {
  it('add directive on unused root type', () => {
    const documentNode = parse(/* GraphQL */ `
      type Query {
        hello: String
      }
      type Mutation {
        hello: String
      }

      schema {
        query: Query
      }
    `);
    const document = addDirectiveOnTypes({
      documentNode,
      excludedTypeNames: getReachableTypes(documentNode),
      directiveName: 'inaccessible',
    });
    expect(print(document)).toMatchInlineSnapshot(`
      type Query {
        hello: String
      }

      type Mutation @inaccessible {
        hello: String
      }

      schema {
        query: Query
      }
    `);
  });
  it('does not re-apply directive', () => {
    const documentNode = parse(/* GraphQL */ `
      type Query {
        hello: String
      }

      type Mutation @inaccessible {
        hello: String
      }

      schema {
        query: Query
      }

      directive @inaccessible on OBJECT
    `);
    const document = addDirectiveOnTypes({
      documentNode,
      excludedTypeNames: getReachableTypes(documentNode),
      directiveName: 'inaccessible',
    });
    expect(print(document)).toMatchInlineSnapshot(`
      type Query {
        hello: String
      }

      type Mutation @inaccessible {
        hello: String
      }

      schema {
        query: Query
      }

      directive @inaccessible on OBJECT
    `);
  });
  it('runs on supergraph', () => {
    // This is technically not a fully valid supergraph document node.
    // It only includes the minimum required types and directives to test the functionality.
    const documentNode = parse(/* GraphQL */ `
      type Query @join__type(graph: BAR_GRAPHQL) {
        bar: Car @inaccessible
        barHidden: String
      }

      type Bar @join__type(graph: BAR_GRAPHQL) {
        hello: String
        helloHidden: String
      }

      type Car @join__type(graph: BAR_GRAPHQL) {
        hello: String @inaccessible
        helloHidden: String
      }

      schema {
        query: Query
      }

      ####
      # Note: all the directives and types below are part of a supergraph schema
      ####

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ENUM | ENUM_VALUE | SCALAR | INPUT_OBJECT | INPUT_FIELD_DEFINITION | ARGUMENT_DEFINITION
      scalar join__FieldSet
      directive @join__type(
        graph: join__Graph!
        key: join__FieldSet
        extension: Boolean! = false
        resolvable: Boolean! = true
        isInterfaceObject: Boolean! = false
      ) repeatable on OBJECT | INTERFACE | UNION | ENUM | INPUT_OBJECT | SCALAR

      directive @join__graph(name: String!, url: String!) on ENUM_VALUE

      enum join__Graph {
        BAR_GRAPHQL @join__graph(name: "bar.graphql", url: "")
      }
    `);

    const excludedTypeNames = getReachableTypes(documentNode);

    excludedTypeNames.add('join__Graph');
    excludedTypeNames.add('join__FieldSet');

    const document = addDirectiveOnTypes({
      documentNode,
      excludedTypeNames,
      directiveName: 'inaccessible',
    });

    expect(print(document)).toMatchInlineSnapshot(`
      type Query @join__type(graph: BAR_GRAPHQL) {
        bar: Car @inaccessible
        barHidden: String
      }

      type Bar @join__type(graph: BAR_GRAPHQL) @inaccessible {
        hello: String
        helloHidden: String
      }

      type Car @join__type(graph: BAR_GRAPHQL) {
        hello: String @inaccessible
        helloHidden: String
      }

      schema {
        query: Query
      }

      directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ENUM | ENUM_VALUE | SCALAR | INPUT_OBJECT | INPUT_FIELD_DEFINITION | ARGUMENT_DEFINITION

      scalar join__FieldSet

      directive @join__type(graph: join__Graph!, key: join__FieldSet, extension: Boolean! = false, resolvable: Boolean! = true, isInterfaceObject: Boolean! = false) repeatable on OBJECT | INTERFACE | UNION | ENUM | INPUT_OBJECT | SCALAR

      directive @join__graph(name: String!, url: String!) on ENUM_VALUE

      enum join__Graph {
        BAR_GRAPHQL @join__graph(name: "bar.graphql", url: "")
      }
    `);
  });
});
