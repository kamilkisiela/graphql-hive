import { parse } from 'graphql';
import { extractSuperGraphInformation } from '../federation-super-graph.js';

const ast = parse(/* GraphQL */ `
  schema
    @link(url: "https://specs.apollo.dev/link/v1.0")
    @link(url: "https://specs.apollo.dev/join/v0.3", for: EXECUTION)
    @link(url: "https://specs.apollo.dev/tag/v0.3")
    @link(url: "https://specs.apollo.dev/inaccessible/v0.2", for: SECURITY)
    @link(
      url: "https://myspecs.dev/myDirective/v1.0"
      import: ["@myDirective", { name: "@anotherDirective", as: "@hello" }]
    ) {
    query: Query
  }

  directive @hello on FIELD_DEFINITION

  directive @inaccessible on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION

  directive @join__enumValue(graph: join__Graph!) repeatable on ENUM_VALUE

  directive @join__field(
    graph: join__Graph
    requires: join__FieldSet
    provides: join__FieldSet
    type: String
    external: Boolean
    override: String
    usedOverridden: Boolean
  ) repeatable on FIELD_DEFINITION | INPUT_FIELD_DEFINITION

  directive @join__graph(name: String!, url: String!) on ENUM_VALUE

  directive @join__implements(
    graph: join__Graph!
    interface: String!
  ) repeatable on OBJECT | INTERFACE

  directive @join__type(
    graph: join__Graph!
    key: join__FieldSet
    extension: Boolean! = false
    resolvable: Boolean! = true
    isInterfaceObject: Boolean! = false
  ) repeatable on OBJECT | INTERFACE | UNION | ENUM | INPUT_OBJECT | SCALAR

  directive @join__unionMember(graph: join__Graph!, member: String!) repeatable on UNION

  directive @link(
    url: String
    as: String
    for: link__Purpose
    import: [link__Import]
  ) repeatable on SCHEMA

  directive @myDirective(a: String!) on FIELD_DEFINITION

  directive @tag(
    name: String!
  ) repeatable on FIELD_DEFINITION | OBJECT | INTERFACE | UNION | ARGUMENT_DEFINITION | SCALAR | ENUM | ENUM_VALUE | INPUT_OBJECT | INPUT_FIELD_DEFINITION | SCHEMA

  type DeliveryEstimates @join__type(graph: INVENTORY) {
    estimatedDelivery: String
    fastestDelivery: String
  }

  scalar join__FieldSet

  enum join__Graph {
    INVENTORY @join__graph(name: "inventory", url: "")
    PANDAS @join__graph(name: "pandas", url: "")
    PRODUCTS @join__graph(name: "products", url: "")
    REVIEWS @join__graph(name: "reviews", url: "")
    USERS @join__graph(name: "users", url: "")
  }

  scalar link__Import

  enum link__Purpose {
    SECURITY
    EXECUTION
  }

  type Panda @join__type(graph: PANDAS) {
    name: ID!
    favoriteFood: String @tag(name: "nom-nom-nom")
  }

  type Product implements ProductItf & SkuItf
    @join__implements(graph: INVENTORY, interface: "ProductItf")
    @join__implements(graph: PRODUCTS, interface: "ProductItf")
    @join__implements(graph: PRODUCTS, interface: "SkuItf")
    @join__implements(graph: REVIEWS, interface: "ProductItf")
    @join__type(graph: INVENTORY, key: "id")
    @join__type(graph: PRODUCTS, key: "id")
    @join__type(graph: PRODUCTS, key: "sku package")
    @join__type(graph: PRODUCTS, key: "sku variation { id }")
    @join__type(graph: REVIEWS, key: "id") {
    id: ID! @tag(name: "hi-from-products")
    dimensions: ProductDimension
      @join__field(graph: INVENTORY, external: true)
      @join__field(graph: PRODUCTS)
    delivery(zip: String): DeliveryEstimates
      @join__field(graph: INVENTORY, requires: "dimensions { size weight }")
    sku: String @join__field(graph: PRODUCTS)
    name: String @join__field(graph: PRODUCTS) @hello
    package: String @join__field(graph: PRODUCTS)
    variation: ProductVariation @join__field(graph: PRODUCTS)
    createdBy: User @join__field(graph: PRODUCTS)
    hidden: String @join__field(graph: PRODUCTS)
    reviewsScore: Float! @join__field(graph: REVIEWS, override: "products")
    oldField: String @join__field(graph: PRODUCTS)
    reviewsCount: Int! @join__field(graph: REVIEWS)
    reviews: [Review!]! @join__field(graph: REVIEWS)
  }

  type ProductDimension @join__type(graph: INVENTORY) @join__type(graph: PRODUCTS) {
    size: String
    weight: Float
  }

  interface ProductItf implements SkuItf
    @join__implements(graph: PRODUCTS, interface: "SkuItf")
    @join__type(graph: INVENTORY)
    @join__type(graph: PRODUCTS)
    @join__type(graph: REVIEWS) {
    id: ID!
    dimensions: ProductDimension @join__field(graph: INVENTORY) @join__field(graph: PRODUCTS)
    delivery(zip: String): DeliveryEstimates @join__field(graph: INVENTORY)
    sku: String @join__field(graph: PRODUCTS)
    name: String @join__field(graph: PRODUCTS)
    package: String @join__field(graph: PRODUCTS)
    variation: ProductVariation @join__field(graph: PRODUCTS)
    createdBy: User @join__field(graph: PRODUCTS)
    hidden: String @inaccessible @join__field(graph: PRODUCTS)
    oldField: String @join__field(graph: PRODUCTS) @deprecated(reason: "refactored out")
    reviewsCount: Int! @join__field(graph: REVIEWS)
    reviewsScore: Float! @join__field(graph: REVIEWS)
    reviews: [Review!]! @join__field(graph: REVIEWS)
  }

  type ProductVariation @join__type(graph: PRODUCTS) {
    id: ID!
    name: String
  }

  type Query
    @join__type(graph: INVENTORY)
    @join__type(graph: PANDAS)
    @join__type(graph: PRODUCTS)
    @join__type(graph: REVIEWS)
    @join__type(graph: USERS) {
    allPandas: [Panda] @join__field(graph: PANDAS)
    panda(name: ID!): Panda @join__field(graph: PANDAS)
    allProducts: [ProductItf] @join__field(graph: PRODUCTS)
    product(id: ID!): ProductItf @join__field(graph: PRODUCTS)
    review(id: Int!): Review @join__field(graph: REVIEWS)
  }

  type Review @join__type(graph: REVIEWS) {
    id: Int!
    body: String!
  }

  enum ShippingClass @join__type(graph: INVENTORY) @join__type(graph: PRODUCTS) {
    STANDARD @join__enumValue(graph: INVENTORY) @join__enumValue(graph: PRODUCTS)
    EXPRESS @join__enumValue(graph: INVENTORY) @join__enumValue(graph: PRODUCTS)
    OVERNIGHT @join__enumValue(graph: INVENTORY)
  }

  interface SkuItf @join__type(graph: PRODUCTS) {
    sku: String
  }

  type User @join__type(graph: PRODUCTS, key: "email") @join__type(graph: USERS, key: "email") {
    email: ID! @tag(name: "test-from-users")
    totalProductsCreated: Int
    name: String @join__field(graph: USERS)
  }

  union PandaOrUser
    @join__type(graph: PRODUCTS)
    @join__type(graph: PANDAS)
    @join__unionMember(graph: PRODUCTS, member: "User")
    @join__unionMember(graph: B, member: "Panda") =
      Movie
    | Book

  input UserInput @join__type(graph: PRODUCTS) @join__type(graph: PANDAS) {
    name: String!
  }
`);

describe('extractSuperGraphInformation', () => {
  test('extracts definitions', () => {
    const result = extractSuperGraphInformation(ast);
    expect(result).toMatchInlineSnapshot(`
      {
        schemaCoordinateServicesMappings: Map {
          DeliveryEstimates => [
            inventory,
          ],
          DeliveryEstimates.estimatedDelivery => [
            inventory,
          ],
          DeliveryEstimates.fastestDelivery => [
            inventory,
          ],
          Panda => [
            pandas,
          ],
          Panda.name => [
            pandas,
          ],
          Panda.favoriteFood => [
            pandas,
          ],
          Product => [
            inventory,
            products,
            reviews,
          ],
          Product.id => [
            inventory,
            products,
            reviews,
          ],
          Product.dimensions => [
            inventory,
          ],
          Product.delivery => [
            inventory,
          ],
          Product.sku => [
            products,
          ],
          Product.name => [
            products,
          ],
          Product.package => [
            products,
          ],
          Product.variation => [
            products,
          ],
          Product.createdBy => [
            products,
          ],
          Product.hidden => [
            products,
          ],
          Product.reviewsScore => [
            reviews,
          ],
          Product.oldField => [
            products,
          ],
          Product.reviewsCount => [
            reviews,
          ],
          Product.reviews => [
            reviews,
          ],
          ProductDimension => [
            inventory,
            products,
          ],
          ProductDimension.size => [
            inventory,
            products,
          ],
          ProductDimension.weight => [
            inventory,
            products,
          ],
          ProductItf => [
            inventory,
            products,
            reviews,
          ],
          ProductItf.id => [
            inventory,
            products,
            reviews,
          ],
          ProductItf.dimensions => [
            inventory,
          ],
          ProductItf.delivery => [
            inventory,
          ],
          ProductItf.sku => [
            products,
          ],
          ProductItf.name => [
            products,
          ],
          ProductItf.package => [
            products,
          ],
          ProductItf.variation => [
            products,
          ],
          ProductItf.createdBy => [
            products,
          ],
          ProductItf.hidden => [
            products,
          ],
          ProductItf.oldField => [
            products,
          ],
          ProductItf.reviewsCount => [
            reviews,
          ],
          ProductItf.reviewsScore => [
            reviews,
          ],
          ProductItf.reviews => [
            reviews,
          ],
          ProductVariation => [
            products,
          ],
          ProductVariation.id => [
            products,
          ],
          ProductVariation.name => [
            products,
          ],
          Query => [
            inventory,
            pandas,
            products,
            reviews,
            users,
          ],
          Query.allPandas => [
            pandas,
          ],
          Query.panda => [
            pandas,
          ],
          Query.allProducts => [
            products,
          ],
          Query.product => [
            products,
          ],
          Query.review => [
            reviews,
          ],
          Review => [
            reviews,
          ],
          Review.id => [
            reviews,
          ],
          Review.body => [
            reviews,
          ],
          ShippingClass => [
            inventory,
            products,
          ],
          ShippingClass.STANDARD => [
            inventory,
            products,
          ],
          ShippingClass.EXPRESS => [
            inventory,
            products,
          ],
          ShippingClass.OVERNIGHT => [
            inventory,
          ],
          SkuItf => [
            products,
          ],
          SkuItf.sku => [
            products,
          ],
          User => [
            products,
            users,
          ],
          User.email => [
            products,
            users,
          ],
          User.totalProductsCreated => [
            products,
            users,
          ],
          User.name => [
            users,
          ],
          PandaOrUser => [
            products,
            pandas,
          ],
          UserInput => [
            products,
            pandas,
          ],
          UserInput.name => [
            products,
            pandas,
          ],
        },
      }
    `);
  });
});
