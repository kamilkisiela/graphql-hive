variable "RELEASE" {
  default = "dev"
}

variable "PWD" {
  default = "."
}

variable "DOCKER_REGISTRY" {
  default = ""
}

variable "COMMIT_SHA" {
  default = ""
}

variable "BRANCH_NAME" {
  default = ""
}

variable "BUILD_TYPE" {
  # Can be "", "ci" or "publish"
  default = ""
}

function "get_target" {
  params = []
  result = notequal("", BUILD_TYPE) ? notequal("ci", BUILD_TYPE) ? "target-publish" : "target-ci" : "target-dev"
}

function "local_image_tag" {
  params = [name]
  result = equal("", BUILD_TYPE) ? "${DOCKER_REGISTRY}${name}:latest" : ""
}

function "image_tag" {
  params = [name, tag]
  result = notequal("", tag) ? "${DOCKER_REGISTRY}${name}:${tag}" : ""
}

target "service-base" {
  dockerfile = "${PWD}/services.dockerfile"
  args = {
    RELEASE = "${RELEASE}"
  }
}

target "app-base" {
  dockerfile = "${PWD}/app.dockerfile"
  args = {
    RELEASE = "${RELEASE}"
  }
}

target "target-dev" {}

target "target-ci" {
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
}

target "target-publish" {
  platforms = ["linux/amd64", "linux/arm64"]
  cache-from = ["type=gha"]
  cache-to = ["type=gha,mode=max"]
}

target "emails" {
  inherits = ["service-base", get_target()]
  context = "${PWD}/packages/services/emails/dist"
  args = {
    IMAGE_TITLE = "graphql-hive/emails"
    IMAGE_DESCRIPTION = "The emails service of the GraphQL Hive project."
    PORT = "3006"
    HEALTHCHECK_CMD = "wget --spider -q http://127.0.0.1:$${PORT}/_readiness"
  }
  tags = [
    local_image_tag("emails"),
    image_tag("emails", COMMIT_SHA),
    image_tag("emails", BRANCH_NAME)
  ]
}

target "rate-limit" {
  inherits = ["service-base", get_target()]
  context = "${PWD}/packages/services/rate-limit/dist"
  args = {
    IMAGE_TITLE = "graphql-hive/rate-limit"
    IMAGE_DESCRIPTION = "The rate limit service of the GraphQL Hive project."
    PORT = "3009"
    HEALTHCHECK_CMD = "wget --spider -q http://127.0.0.1:$${PORT}/_readiness"
  }
  tags = [
    local_image_tag("rate-limit"),
    image_tag("rate-limit", COMMIT_SHA),
    image_tag("rate-limit", BRANCH_NAME)
  ]
}

target "schema" {
  inherits = ["service-base", get_target()]
  context = "${PWD}/packages/services/schema/dist"
  args = {
    IMAGE_TITLE = "graphql-hive/rate-limit"
    IMAGE_DESCRIPTION = "The schema service of the GraphQL Hive project."
    PORT = "3002"
    HEALTHCHECK_CMD = "wget --spider -q http://127.0.0.1:$${PORT}/_readiness"
  }
  tags = [
    local_image_tag("schema"),
    image_tag("schema", COMMIT_SHA),
    image_tag("schema", BRANCH_NAME)
  ]
}

target "server" {
  inherits = ["service-base", get_target()]
  context = "${PWD}/packages/services/server/dist"
  args = {
    IMAGE_TITLE = "graphql-hive/server"
    IMAGE_DESCRIPTION = "The server service of the GraphQL Hive project."
    PORT = "3001"
    HEALTHCHECK_CMD = "wget --spider -q http://127.0.0.1:$${PORT}/_readiness"
  }
  tags = [
    local_image_tag("server"),
    image_tag("server", COMMIT_SHA),
    image_tag("server", BRANCH_NAME)
  ]
}

target "storage" {
  inherits = ["service-base", get_target()]
  context = "${PWD}/packages/services/storage/dist"
  args = {
    IMAGE_TITLE = "graphql-hive/storage"
    IMAGE_DESCRIPTION = "The storage service of the GraphQL Hive project."
  }
  tags = [
    local_image_tag("storage"),
    image_tag("storage", COMMIT_SHA),
    image_tag("storage", BRANCH_NAME)
  ]
}

target "stripe-billing" {
  inherits = ["service-base", get_target()]
  context = "${PWD}/packages/services/stripe-billing/dist"
  args = {
    IMAGE_TITLE = "graphql-hive/stripe-billing"
    IMAGE_DESCRIPTION = "The stripe billing service of the GraphQL Hive project."
    PORT = "3010"
    HEALTHCHECK_CMD = "wget --spider -q http://127.0.0.1:$${PORT}/_readiness"
  }
  tags = [
    local_image_tag("stripe-billing"),
    image_tag("stripe-billing", COMMIT_SHA),
    image_tag("stripe-billing", BRANCH_NAME)
  ]
}

target "tokens" {
  inherits = ["service-base", get_target()]
  context = "${PWD}/packages/services/tokens/dist"
  args = {
    IMAGE_TITLE = "graphql-hive/tokens"
    IMAGE_DESCRIPTION = "The tokens service of the GraphQL Hive project."
    PORT = "3003"
    HEALTHCHECK_CMD = "wget --spider -q http://127.0.0.1:$${PORT}/_readiness"
  }
  tags = [
    local_image_tag("tokens"),
    image_tag("tokens", COMMIT_SHA),
    image_tag("tokens", BRANCH_NAME)
  ]
}

target "usage-estimator" {
  inherits = ["service-base", get_target()]
  context = "${PWD}/packages/services/usage-estimator/dist"
  args = {
    IMAGE_TITLE = "graphql-hive/usage-estimator"
    IMAGE_DESCRIPTION = "The usage estimator service of the GraphQL Hive project."
    PORT = "3008"
    HEALTHCHECK_CMD = "wget --spider -q http://127.0.0.1:$${PORT}/_readiness"
  }
  tags = [
    local_image_tag("usage-estimator"),
    image_tag("usage-estimator", COMMIT_SHA),
    image_tag("usage-estimator", BRANCH_NAME)
  ]
}

target "usage-ingestor" {
  inherits = ["service-base", get_target()]
  context = "${PWD}/packages/services/usage-ingestor/dist"
  args = {
    IMAGE_TITLE = "graphql-hive/usage-ingestor"
    IMAGE_DESCRIPTION = "The usage ingestor service of the GraphQL Hive project."
    PORT = "3007"
    HEALTHCHECK_CMD = "wget --spider -q http://127.0.0.1:$${PORT}/_readiness"
  }
  tags = [
    local_image_tag("usage-ingestor"),
    image_tag("usage-ingestor", COMMIT_SHA),
    image_tag("usage-ingestor", BRANCH_NAME)
  ]
}

target "usage" {
  inherits = ["service-base", get_target()]
  context = "${PWD}/packages/services/usage/dist"
  args = {
    IMAGE_TITLE = "graphql-hive/usage"
    IMAGE_DESCRIPTION = "The usage ingestor service of the GraphQL Hive project."
    PORT = "3006"
    HEALTHCHECK_CMD = "wget --spider -q http://127.0.0.1:$${PORT}/_readiness"
  }
  tags = [
    local_image_tag("usage"),
    image_tag("usage", COMMIT_SHA),
    image_tag("usage", BRANCH_NAME)
  ]
}

target "webhooks" {
  inherits = ["service-base", get_target()]
  context = "${PWD}/packages/services/webhooks/dist"
  args = {
    IMAGE_TITLE = "graphql-hive/webhooks"
    IMAGE_DESCRIPTION = "The webhooks ingestor service of the GraphQL Hive project."
    PORT = "3005"
    HEALTHCHECK_CMD = "wget --spider -q http://127.0.0.1:$${PORT}/_readiness"
  }
  tags = [
    local_image_tag("webhooks"),
    image_tag("webhooks", COMMIT_SHA),
    image_tag("webhooks", BRANCH_NAME)
  ]
}

target "app" {
  inherits = ["app-base", get_target()]
  context = "${PWD}/packages/web/app/dist"
  args = {
    IMAGE_TITLE = "graphql-hive/app"
    PORT = "3000"
    IMAGE_DESCRIPTION = "The app of the GraphQL Hive project."
  }
  tags = [
    local_image_tag("app"),
    image_tag("app", COMMIT_SHA),
    image_tag("app", BRANCH_NAME)
  ]
}



group "build" {
  targets = [
    "emails",
    "rate-limit",
    "schema",
    "storage",
    "tokens",
    "usage-estimator",
    "usage-ingestor",
    "usage",
    "webhooks",
    "server",
    "stripe-billing",
    "app"
  ]
}
