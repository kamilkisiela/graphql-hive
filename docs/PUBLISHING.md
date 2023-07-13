# Publishing

To build the images from the local source code:

2. Install all deps: `pnpm i`
3. Generate types: `pnpm graphql:generate`
4. Build source code: `pnpm build`
5. Set env vars:

```bash
export COMMIT_SHA="ipv-fix"
export RELEASE="ipv-fix"
export BRANCH_NAME="ipv-fix"
export BUILD_TYPE="publish"
export DOCKER_TAG=":ipv-fix"
export DOCKER_REGISTRY="registry.cistec.com/"
```

6. Compile a local Docker image by running: `docker buildx bake -f docker/docker.hcl publish --load`
7. Use Docker Compose to run the built containers (based on `community` compose file), along with
   the extra containers:

```bash
export DOCKER_TAG=":ipv-fix"
export DOCKER_REGISTRY="registry.cistec.com/"

# composition
docker tag composition-federation-2:ipv-fix registry.cistec.com/composition-federation-2:ipv-fix
docker push registry.cistec.com/composition-federation-2:ipv-fix

# schema
docker push registry.cistec.com/schema:ipv-fix

# tokens
docker push registry.cistec.com/tokens:ipv-fix

# usage-ingestor
docker push registry.cistec.com/usage-ingestor:ipv-fix

# usage
docker push registry.cistec.com/usage:ipv-fix

# webhooks
docker push registry.cistec.com/webhooks:ipv-fix

# server
docker push registry.cistec.com/server:ipv-fix
```
