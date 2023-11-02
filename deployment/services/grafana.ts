import { readdirSync, readFileSync } from 'fs';
import { join, parse } from 'path';
import { Dashboard, Folder } from '@lbrlabs/pulumi-grafana';
import * as pulumi from '@pulumi/pulumi';

const dashboardDirectory = join(__dirname, '../grafana-dashboards/');

export function deployGrafana(envName: string) {
  const availableFiles = readdirSync(dashboardDirectory)
    .filter(f => f.endsWith('.json'))
    // Temp workaround
    .filter(v => !v.includes('ClickHouse-Latency.json'));
  const folder = new Folder('grafana-hive-folder', {
    title: `Hive Monitoring (${envName})`,
  });

  const params = new pulumi.Config('grafanaDashboards').requireObject<Record<string, string>>(
    'params',
  );
  params['ENV_NAME'] = envName;

  const dashboards = availableFiles.map(filePath => {
    const fullPath = join(dashboardDirectory, filePath);
    const identifier = parse(fullPath).name;
    let configString = readFileSync(fullPath, 'utf8');

    for (const [key, value] of Object.entries(params)) {
      if (configString.includes(key)) {
        configString = configString.replace(new RegExp(key, 'g'), value);
      }
    }

    const configJson = JSON.parse(configString);

    if ('uid' in configJson) {
      delete configJson.uid;
    }

    if ('version' in configJson) {
      delete configJson.version;
    }

    return new Dashboard(`dashboard-${identifier.toLowerCase()}`, {
      folder: folder.id,
      configJson: JSON.stringify(configJson, null, 2),
    });
  });

  return {
    folder,
    dashboards,
  };
}
