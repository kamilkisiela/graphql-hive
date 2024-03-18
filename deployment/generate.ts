import { execSync } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { gunzip } from 'node:zlib';
import { Readable } from 'stream';
import { gunzipSync } from 'zlib';
import * as yaml from 'js-yaml';
import { compile } from 'json-schema-to-typescript';
import { extract } from 'tar-stream';
import { fileSync } from 'tmp';
import { OTLP_COLLECTOR_CHART, VECTOR_HELM_CHART } from './utils/observability';
import { CONTOUR_CHART } from './utils/reverse-proxy';

async function generateJsonSchemaFromHelmValues(input: string) {
  const jsonSchemaTempFile = fileSync();
  execSync(`helm schema -input ${input} -output ${jsonSchemaTempFile.name}`);

  return await readFile(jsonSchemaTempFile.name, 'utf-8').then(r => JSON.parse(r));
}

function getFileFromTar(tar: Readable, filename: string) {
  return new Promise(resolve => {
    const extractInstance = extract();

    extractInstance.on('entry', function (header, stream, next) {
      if (header.name === filename) {
        let data = '';
        stream.on('data', chunk => (data += chunk));
        stream.on('end', () => {
          resolve(data);
        });
      }
      stream.on('end', function () {
        next(); // ready for next entry
      });

      stream.resume(); // just auto drain the stream
    });

    extractInstance.on('finish', function () {
      // all entries read
    });

    tar.pipe(extractInstance);
  });
}

async function generateOpenTelemetryCollectorTypes() {
  const jsonSchemaUrl = `https://raw.githubusercontent.com/open-telemetry/opentelemetry-helm-charts/opentelemetry-collector-${OTLP_COLLECTOR_CHART.version}/charts/opentelemetry-collector/values.schema.json`;
  const jsonSchema = await fetch(jsonSchemaUrl).then(res => res.json());
  const output = await compile(jsonSchema, 'OpenTelemetryCollectorValues', {
    additionalProperties: false,
  });
  await writeFile('./utils/opentelemetry-collector.types.ts', output);
}

async function generateVectorDevTypes() {
  const helmValuesFileUrl = `https://raw.githubusercontent.com/vectordotdev/helm-charts/vector-${VECTOR_HELM_CHART.version}/charts/vector/values.yaml`;
  const valuesFile = await fetch(helmValuesFileUrl).then(res => res.text());
  const valuesTempFile = fileSync();
  await writeFile(valuesTempFile.name, valuesFile);
  const jsonSchema = await generateJsonSchemaFromHelmValues(valuesTempFile.name);
  const output = await compile(jsonSchema, 'VectorValues', { additionalProperties: false });
  await writeFile('./utils/vector.types.ts', output);
}

async function generateContourTypes() {
  let helmManifest = await fetch(`${CONTOUR_CHART.fetchOpts!['repo']}/index.yaml`, {
    redirect: 'follow',
  })
    .then(r => r.text())
    .then(r => yaml.load(r) as any);

  let relevantChart = helmManifest.entries[CONTOUR_CHART['chart'] as string].find(
    entry => entry.version === CONTOUR_CHART.version,
  );

  if (!relevantChart) {
    throw new Error(
      `Could not find chart ${CONTOUR_CHART['chart']} with version ${CONTOUR_CHART.version} in the Helm repository!`,
    );
  }

  const url = relevantChart.urls.find((url: string) => url.endsWith('.tgz'));

  if (!url) {
    throw new Error(
      `Could not find a .tgz file in the Helm repository for chart ${CONTOUR_CHART['chart']}!`,
    );
  }

  const valuesFile = await fetch(url)
    .then(r => r.arrayBuffer())
    .then(r => Buffer.from(r))
    .then(r => gunzipSync(r))
    .then(r => Readable.from(r))
    .then(r => getFileFromTar(r, 'contour/values.yaml'))
    .then((r: any) => r.toString());

  const valuesTempFile = fileSync();
  await writeFile(valuesTempFile.name, valuesFile);
  const jsonSchema = await generateJsonSchemaFromHelmValues(valuesTempFile.name);
  const output = await compile(jsonSchema, 'ContourValues');
  await writeFile('./utils/contour.types.ts', output);
}

async function main() {
  await Promise.all([
    generateContourTypes(),
    generateVectorDevTypes(),
    generateOpenTelemetryCollectorTypes(),
  ]);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
