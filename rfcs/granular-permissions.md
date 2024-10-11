# RFC: Granular Permission System

This RFC proposes a new approach for handling user, organization member, and access tokens (CDN +
target access tokens) to allow resource granularity.

## Problem Statement

Today, our permission and access token system has several shortcomings. Here are a few examples:

- Impossible to limit an access token to only publish a specific service within a target
- Impossible to limit project or target access based on an individual user
- Different types of access tokens (CDN access tokens and registry access tokens)

This has become a inconvenience for organizations that want strict access control to resources
within Hive.

## Goals

- Unification of CDN access tokens and registry tokens as "global" organization scoped access token
- Introduction of personal access tokens
- Granular resource access (inspired by AWS IAM) for both organization member roles and access
  tokens
- Update permissions of access tokens after creation by attaching new policies or updating existing
  policies

## Proposed Solution

### Introducing Policies

Instead of defining permissions for organization member roles, permissions are now defined as
policies. Policies allow granular access to resources and are heavily inspired by AWS IAM.

A policy is a list of statements that will either allow or deny the access to a resource on Hive. If
any of the statements will evaluate to "deny", the actor will not be able to perform a specific
action like publish a schema, view a project or similar.

A statement consists of a `effect` (either `"deny"` or `"allow"`), a action (what specific things
are allowed or denied) and a resource (on which resource are these actions allowed or denied).

For Hive organization administrators, it will be possible to build these policies through either a
policy builder, or by editing raw JSON.

Here are some example statements that serve to show the flexibility and granularity.

**Sample Statement: Allow viewing a specific project**

```json
{
  "effect": "allow",
  "action": "project:view",
  "resource": ["hrn:<organizationId>:project/<projectId>"]
}
```

**Sample Statement: Allow viewing a all projects**

```json
{
  "effect": "allow",
  "action": "project:view",
  "resource": ["hrn:<organizationId>:project/*"]
}
```

**Sample Statement: Allow viewing two specific projects**

```json
{
  "effect": "allow",
  "action": "project:view",
  "resource": [
    "hrn:<organizationId>:project/933007e7-b3f6-4182-8dd5-8d3ce1857b1a",
    "hrn:<organizationId>:project/7b572593-483c-4875-b1bf-4deb60239338"
  ]
}
```

**Sample Statement: Allow publishing new schema version for service on specific federated target**

```json
{
  "effect": "allow",
  "action": "schema:publish",
  "resource": ["hrn:<organizationId>:target/933007e7-b3f6-4182-8dd5-8d3ce1857b1a/<serviceName>"]
}
```

**Sample Statement: Allow publishing new schema version for service on specific federated target**

```json
{
  "effect": "allow",
  "action": "schema:publish",
  "resource": ["hrn:<organizationId>:target/933007e7-b3f6-4182-8dd5-8d3ce1857b1a/*"]
}
```

Each policy will have a list of statements. One or more policies can be attached to either a
organization member role or organization access token.

When updating a policy, the changes will be reflected for all organization members and organization
access tokens that reference such policies.

### Merging CDN access tokens and registry access tokens

In the new permission system, there will no longer be access tokens that belong to one target.
Existing "legacy" registry access tokens will keep working as before.

Any new access token created within the scope of an organization will be an organization access
token, whose permissions are defined via policy statements.

E.g. a statement for a organization access token that can both report usage, but also read a
supergraph from the Hive CDN would look like the following:

```json
{
  "effect": "allow",
  "action": ["usage:report", "cdn:read"],
  "resource": ["hrn:<organizationId>:target/<targetId>"]
}
```

We highly encourage, that organization admins create these sensitive access tokens that are used for
production and CI/CD systems. However, it will be possible to grant organization members access to
create these tokens.

### Personal Access Tokens

Personal access tokens allow users to create access tokens that have a subset of the permissions
their user role provides.

Some examples:

- Pull the latest schema version for local frontend development
- Compose a local GraphQL schema/service with the services published to the Hive schema registry

A organization member can not grant any permissions to the access token that are not covered by the
assigned role to the user.

If an organization members permissions would be downgraded/removed, this change will be
automatically applied in all the access token that user has for this organization.

It will also be possible for organizations to disable personal access tokens if desired.

### ER Diagram

```mermaid
erDiagram

users ||--o{ organization_member : "can be a member of multiple"
users ||--o{ personal_access_tokens : "has one or more"
organization ||--o{ organization_access_tokens : "has many"
organization ||--o{ organization_member : "has many"
organization_member ||--o{ organization_member_roles : "has assigned a single"
organization_member_roles ||--o{ organization_policies : "has many attached"
organization_access_tokens ||--o{ organization_policies : "has many attached"
```

### Implications for CLI Tooling and Usage Reporting

Since access tokens will no longer be tied to a specific target, for new access tokens, it will
become mandatory to provide the organization/project/target path.

**Example: Running a schema check**

```bash
# old command
hive schema:check schema.graphql

# new command
#                 organization / project             / target
hive schema:check the-guild-org/my-federation-project/development schema.graphql
```

For "Legacy" registry access tokens providing this path will remain optional as existing CI/CD setup
shall remain functional.

The same also applies for usage reporting.

For "legacy" registry access tokens, the endpoint will remain the same
(`https://app.graphql-hive.com/usage`), however, new access tokens will also require specifying the
target path (` https://app.graphql-hive.com/usage/the-guild/my-federation-project/development`).

Our CLIs, SDKs, the Gateway, and documentation will be updated accordingly to support both legacy
tokens and the new access tokens.

## Related Issues

- https://github.com/kamilkisiela/graphql-hive/issues/4713
- https://github.com/kamilkisiela/graphql-hive/issues/124
- https://github.com/kamilkisiela/graphql-hive/issues/4713

## Internal Documentation

- https://www.notion.so/theguildoss/New-Hive-Permission-System-113b6b71848a8013bbc7d6ad67d81b43?pvs=4
