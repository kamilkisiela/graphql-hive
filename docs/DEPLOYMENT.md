## Deployment

Deployment is based on NPM packages. That means we are bundling (as much as possible) each service
or package, and publish it to the private GitHub Packages Artifactory.

Doing that allows us to have a simple, super fast deployments, because we don't need to deal with
Docker images (which are heavy).

We create an executable package (with `bin` entrypoint) and then use
`npx PACKAGE_NAME@PACKAGE_VERSION` as command for a base Docker image of NodeJS. So instead of
building a Docker image for each change, we build NPM package, and the Docker image we are using in
prod is the same.

Think of it as Lambda (bundled JS, runtime is predefined) without all the crap (weird cache, weird
pricing, cold start and so on).

### How to deploy?

We are using Pulumi (infrastructure as code) to describe and run our deployment. It's managed as
GitHub Actions that runs on every bump release by Changesets.

So changes are aggregated in a Changesets PR, and when merged, it updates the deployment manifest
`package.json`, leading to deployment of only the updated packages to production.
