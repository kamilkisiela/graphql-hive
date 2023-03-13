import { readdirSync, readFileSync } from 'fs';
import { join, parse } from 'path';
import { Dashboard, Folder } from '@lbrlabs/pulumi-grafana';

const dashboardDirectory = join(__dirname, '../grafana-dashboards/');

export function deployGrafana() {
  const availableFiles = readdirSync(dashboardDirectory).filter(f => f.endsWith('.json'));
  const folder = new Folder('grafana-hive-folder', {
    title: 'Hive Monitoring',
  });

  const dashboards = availableFiles.map(filePath => {
    const configJson = readFileSync(join(dashboardDirectory, filePath), 'utf8');
    const identifier = parse(configJson).name;

    return new Dashboard(`dashboard-${identifier}`, {
      folder: folder.id,
      configJson,
    });
  });

  return dashboards;
}
