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
`);

describe('extractSuperGraphInformation', () => {
  test('extracts definitions', () => {
    const result = extractSuperGraphInformation(ast);
    expect(result).toMatchInlineSnapshot(`
      {
        schemaCoordinateOwner: Map {
          DeliveryEstimates => Set {
            inventory,
          },
          DeliveryEstimates.estimatedDelivery => Set {
            inventory,
          },
          DeliveryEstimates.fastestDelivery => Set {
            inventory,
          },
          Panda => Set {
            pandas,
          },
          Panda.name => Set {
            pandas,
          },
          Panda.favoriteFood => Set {
            pandas,
          },
          Product => Set {
            inventory,
            products,
            reviews,
          },
          Product.id => Set {
            inventory,
            products,
            reviews,
          },
          Product.dimensions => Set {
            inventory,
          },
          Product.delivery => Set {
            inventory,
          },
          Product.sku => Set {
            products,
          },
          Product.name => Set {
            products,
          },
          Product.package => Set {
            products,
          },
          Product.variation => Set {
            products,
          },
          Product.createdBy => Set {
            products,
          },
          Product.hidden => Set {
            products,
          },
          Product.reviewsScore => Set {
            reviews,
          },
          Product.oldField => Set {
            products,
          },
          Product.reviewsCount => Set {
            reviews,
          },
          Product.reviews => Set {
            reviews,
          },
          ProductDimension => Set {
            inventory,
            products,
          },
          ProductDimension.size => Set {
            inventory,
            products,
          },
          ProductDimension.weight => Set {
            inventory,
            products,
          },
          ProductItf => Set {
            inventory,
            products,
            reviews,
          },
          ProductItf.id => Set {
            inventory,
            products,
            reviews,
          },
          ProductItf.dimensions => Set {
            inventory,
          },
          ProductItf.delivery => Set {
            inventory,
          },
          ProductItf.sku => Set {
            products,
          },
          ProductItf.name => Set {
            products,
          },
          ProductItf.package => Set {
            products,
          },
          ProductItf.variation => Set {
            products,
          },
          ProductItf.createdBy => Set {
            products,
          },
          ProductItf.hidden => Set {
            products,
          },
          ProductItf.oldField => Set {
            products,
          },
          ProductItf.reviewsCount => Set {
            reviews,
          },
          ProductItf.reviewsScore => Set {
            reviews,
          },
          ProductItf.reviews => Set {
            reviews,
          },
          ProductVariation => Set {
            products,
          },
          ProductVariation.id => Set {
            products,
          },
          ProductVariation.name => Set {
            products,
          },
          Query => Set {
            inventory,
            pandas,
            products,
            reviews,
            users,
          },
          Query.allPandas => Set {
            pandas,
          },
          Query.panda => Set {
            pandas,
          },
          Query.allProducts => Set {
            products,
          },
          Query.product => Set {
            products,
          },
          Query.review => Set {
            reviews,
          },
          Review => Set {
            reviews,
          },
          Review.id => Set {
            reviews,
          },
          Review.body => Set {
            reviews,
          },
          ShippingClass => Set {
            inventory,
            products,
          },
          ShippingClass.STANDARD => Set {
            inventory,
            products,
          },
          ShippingClass.EXPRESS => Set {
            inventory,
            products,
          },
          ShippingClass.OVERNIGHT => Set {
            inventory,
          },
          SkuItf => Set {
            products,
          },
          SkuItf.sku => Set {
            products,
          },
          User => Set {
            products,
            users,
          },
          User.email => Set {
            products,
            users,
          },
          User.totalProductsCreated => Set {
            products,
            users,
          },
          User.name => Set {
            users,
          },
        },
      }
    `);
  });
});
