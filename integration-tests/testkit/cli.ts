import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execaCommand } from '@esm2cjs/execa';
import { fetchLatestSchema, fetchLatestValidSchema } from './flow';
import { getServiceHost } from './utils';

const binPath = resolve(__dirname, '../../packages/libraries/cli/bin/run');
const cliDir = resolve(__dirname, '../../packages/libraries/cli');

async function generateTmpFile(content: string, extension: string) {
  const dir = tmpdir();
  const fileName = randomUUID();
  const filepath = join(dir, `${fileName}.${extension}`);

  await writeFile(filepath, content, 'utf-8');

  return filepath;
}

async function exec(cmd: string) {
  const outout = await execaCommand(`${binPath} ${cmd}`, {
    shell: true,
    env: {
      OCLIF_CLI_CUSTOM_PATH: cliDir,
    },
  });

  if (outout.failed) {
    throw new Error(outout.stderr);
  }

  return outout.stdout;
}

export async function schemaPublish(args: string[]) {
  const registryAddress = await getServiceHost('server', 8082);
  return await exec(
    ['schema:publish', `--registry.endpoint`, `http://${registryAddress}/graphql`, ...args].join(
      ' ',
    ),
  );
}

export async function schemaCheck(args: string[]) {
  const registryAddress = await getServiceHost('server', 8082);

  return await exec(
    ['schema:check', `--registry.endpoint`, `http://${registryAddress}/graphql`, ...args].join(' '),
  );
}

export async function schemaDelete(args: string[]) {
  const registryAddress = await getServiceHost('server', 8082);

  return await exec(
    ['schema:delete', `--registry.endpoint`, `http://${registryAddress}/graphql`, ...args].join(
      ' ',
    ),
  );
}

export function createCLI(tokens: { readwrite: string; readonly: string }) {
  let publishCount = 0;

  async function publish({
    sdl,
    serviceName,
    serviceUrl,
    metadata,
    expect: expectedStatus,
    legacy_force,
    legacy_acceptBreakingChanges,
  }: {
    sdl: string;
    commit?: string;
    serviceName?: string;
    serviceUrl?: string;
    metadata?: Record<string, any>;
    legacy_force?: boolean;
    legacy_acceptBreakingChanges?: boolean;
    expect: 'latest' | 'latest-composable' | 'ignored' | 'rejected';
  }): Promise<string> {
    const publishName = ` #${++publishCount}`;
    const commit = randomUUID();

    const cmd = schemaPublish([
      '--registry.accessToken',
      tokens.readwrite,
      '--author',
      'Kamil',
      '--commit',
      commit,
      ...(serviceName ? ['--service', serviceName] : []),
      ...(serviceUrl ? ['--url', serviceUrl] : []),
      ...(metadata ? ['--metadata', await generateTmpFile(JSON.stringify(metadata), 'json')] : []),
      ...(legacy_force ? ['--force'] : []),
      ...(legacy_acceptBreakingChanges ? ['--experimental_acceptBreakingChanges'] : []),
      await generateTmpFile(sdl, 'graphql'),
    ]);

    const expectedCommit = expect.objectContaining({
      commit,
    });

    if (expectedStatus === 'rejected') {
      await expect(cmd).rejects.toThrow();
      const latestSchemaResult = await fetchLatestSchema(tokens.readonly).then(r =>
        r.expectNoGraphQLErrors(),
      );
      const latestSchemaCommit = latestSchemaResult.latestVersion?.log;

      expect(
        latestSchemaCommit,
        `${publishName} was expected to be rejected but was published`,
      ).not.toEqual(expectedCommit);

      return '';
    }

    // throw if the command fails
    await cmd;

    const latestSchemaResult = await fetchLatestSchema(tokens.readonly).then(r =>
      r.expectNoGraphQLErrors(),
    );
    const latestSchemaCommit = latestSchemaResult.latestVersion?.log;

    if (expectedStatus === 'ignored') {
      // Check if the schema was ignored
      expect(
        latestSchemaCommit,
        `${publishName} was expected to be ignored but it was published`,
      ).not.toEqual(expectedCommit);
      return '';
    }
    // Check if the schema was published
    expect(latestSchemaCommit, `${publishName} was expected to be published`).toEqual(
      expectedCommit,
    );

    const latestComposableSchemaResult = await fetchLatestValidSchema(tokens.readonly).then(r =>
      r.expectNoGraphQLErrors(),
    );

    const latestComposableSchemaCommit = latestComposableSchemaResult.latestValidVersion?.log;

    // Check if the schema was published as composable or non-composable
    if (expectedStatus === 'latest') {
      // schema is not available to the gateway
      expect(
        latestComposableSchemaCommit,
        `${publishName} was expected to be published but not as composable`,
      ).not.toEqual(expectedCommit);
    } else {
      // schema is available to the gateway
      expect(
        latestComposableSchemaCommit,
        `${publishName} was expected to be published as composable`,
      ).toEqual(expectedCommit);
    }

    return await cmd;
  }

  async function check({
    sdl,
    serviceName,
    expect: expectedStatus,
  }: {
    sdl: string;
    serviceName?: string;
    expect: 'approved' | 'rejected';
  }): Promise<string> {
    const cmd = schemaCheck([
      '--registry.accessToken',
      tokens.readonly,
      ...(serviceName ? ['--service', serviceName] : []),
      await generateTmpFile(sdl, 'graphql'),
    ]);

    if (expectedStatus === 'rejected') {
      await expect(cmd).rejects.toThrow();
      return cmd.catch(reason => Promise.resolve(reason.message));
    }
    return cmd;
  }

  async function deleteCommand({
    serviceName,
    expect: expectedStatus,
  }: {
    serviceName?: string;
    expect: 'latest' | 'latest-composable' | 'rejected';
  }): Promise<string> {
    const cmd = schemaDelete(['--token', tokens.readwrite, '--confirm', serviceName ?? '']);

    const before = {
      latest: await fetchLatestSchema(tokens.readonly).then(r => r.expectNoGraphQLErrors()),
      latestValid: await fetchLatestValidSchema(tokens.readonly).then(r =>
        r.expectNoGraphQLErrors(),
      ),
    };

    if (expectedStatus === 'rejected') {
      await expect(cmd).rejects.toThrow();

      const after = {
        latest: await fetchLatestSchema(tokens.readonly).then(r => r.expectNoGraphQLErrors()),
        latestValid: await fetchLatestValidSchema(tokens.readonly).then(r =>
          r.expectNoGraphQLErrors(),
        ),
      };

      expect(after.latest.latestVersion?.log).toEqual(before.latest.latestVersion?.log);
      expect(after.latestValid.latestValidVersion?.id).toEqual(
        before.latestValid.latestValidVersion?.id,
      );

      return cmd.catch(reason => Promise.resolve(reason.message));
    }
    await cmd;

    const after = {
      latest: await fetchLatestSchema(tokens.readonly).then(r => r.expectNoGraphQLErrors()),
      latestValid: await fetchLatestValidSchema(tokens.readonly).then(r =>
        r.expectNoGraphQLErrors(),
      ),
    };

    if (expectedStatus === 'latest-composable') {
      expect(after.latest.latestVersion?.log).not.toEqual(before.latest.latestVersion?.log);
      expect(after.latestValid.latestValidVersion?.log).not.toEqual(
        before.latestValid.latestValidVersion?.log,
      );
    } else {
      expect(after.latest.latestVersion?.log).not.toEqual(before.latest.latestVersion?.log);
      expect(after.latestValid.latestValidVersion?.id).toEqual(
        before.latestValid.latestValidVersion?.id,
      );
    }

    return cmd;
  }

  return {
    publish,
    check,
    delete: deleteCommand,
  };
}
