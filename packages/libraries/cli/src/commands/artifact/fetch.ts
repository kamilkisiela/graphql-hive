import { Buffer } from 'node:buffer';
import { fetch, URL } from '@whatwg-node/fetch';
import { createCommand } from '../../helpers/command';
import { version } from '../../version';

const artifactTypes = [
  'sdl',
  'supergraph',
  'metadata',
  'services',
  'sdl.graphql',
  'sdl.graphqls',
] as const;

export function coerceToArtifactType(key: any) {
  if (artifactTypes.includes(key)) {
    return key as (typeof artifactTypes)[number];
  }

  throw new Error(`Invalid artifact type: ${key}`);
}

export default createCommand((yargs, ctx) => {
  return yargs.command(
    'artifact:fetch',
    'fetch artifacts from the CDN',
    y =>
      y
        .option('cdn.endpoint', { type: 'string', description: 'CDN endpoint', demandOption: true })
        .option('cdn.accessToken', {
          type: 'string',
          description: 'CDN access token',
          demandOption: true,
        })
        .option('artifact', {
          type: 'string',
          description:
            'artifact to fetch (Note: supergraph is only available for federation projects)',
          coerce: coerceToArtifactType,
          demandOption: true,
        })
        .option('outputFile', {
          type: 'string',
          description: 'whether to write to a file instead of stdout',
        }),
    async args => {
      const cdnEndpoint = ctx.ensure({
        key: 'cdn.endpoint',
        args,
        env: 'HIVE_CDN_ENDPOINT',
      });

      const token = ctx.ensure({
        key: 'cdn.accessToken',
        args,
        env: 'HIVE_CDN_ACCESS_TOKEN',
      });

      const artifactType = args.artifact;

      const url = new URL(`${cdnEndpoint}/${artifactType}`);

      const response = await fetch(url.toString(), {
        headers: {
          'x-hive-cdn-key': token,
          'User-Agent': `hive-cli/${version}`,
        },
      });

      if (response.status >= 300) {
        const responseBody = await response.text();
        return ctx.exit('failure', {
          message: responseBody,
        });
      }

      if (args.outputFile) {
        const fs = await import('node:fs/promises');
        const contents = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(args.outputFile, contents);
        ctx.logger.log(`Wrote ${contents.length} bytes to ${args.outputFile}`);
        return;
      }

      ctx.logger.log(await response.text());
    },
  );
});
