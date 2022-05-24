import { DockestService, execa } from 'dockest';
import { containerIsHealthyReadinessCheck, zeroExitCodeReadinessCheck } from 'dockest/dist/readiness-check/index.js';
import { DepGraph } from 'dependency-graph';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

export function createServices() {
  const dockerComposeFile: {
    services: {
      [key: string]: {
        depends_on?: { [key: string]: unknown };
        healthcheck?: any;
      };
    };
  } = parse(readFileSync(join(process.cwd(), 'docker-compose.yml'), 'utf8'));

  const serviceNameCollection = Object.keys(dockerComposeFile.services);

  const graph = new DepGraph<DockestService>();

  // First, add all services to the graph
  for (const serviceName of serviceNameCollection) {
    const service = dockerComposeFile.services[serviceName];
    graph.addNode(serviceName, {
      serviceName,
      dependsOn: [],
      readinessCheck: service.healthcheck ? containerIsHealthyReadinessCheck : zeroExitCodeReadinessCheck,
    });
  }

  // Now, create dependencies between them
  for (const serviceName of serviceNameCollection) {
    const dockerService = dockerComposeFile.services[serviceName];
    if (dockerService.depends_on) {
      const dependsOn = Object.keys(dockerService.depends_on);

      for (const depName of dependsOn) {
        graph.addDependency(serviceName, depName);
      }
    }
  }

  // Next, sort the graph
  const allServices = graph.overallOrder();

  // Finally, create the services
  const registry: {
    [key: string]: DockestService;
  } = {};
  for (const serviceName of allServices) {
    const service = graph.getNodeData(serviceName);

    registry[serviceName] = {
      ...service,
      dependsOn: graph.directDependenciesOf(serviceName).map(dep => graph.getNodeData(dep)),
    };
  }

  // And return a list of services
  return allServices.map(serviceName => graph.getNodeData(serviceName));
}

export function cleanDockerContainers() {
  const output = execa(`docker ps --all --filter "name=integration-tests" --format={{.ID}}:{{.Status}}`);

  if (output.stdout.length) {
    const runningContainers = output.stdout.split('\n');
    for (const line of runningContainers) {
      const [containerId, containerStatus] = line.split(':');
      const containerRunning = containerStatus?.toLowerCase().includes('up');
      if (containerRunning) {
        console.log(`Stopping container ${containerId}`);
        execa(`docker stop ${containerId}`);
      }
      console.log(`Removing container ${containerId} with its volumes`);
      execa(`docker rm -v -f ${containerId}`);
    }

    console.log('Stopped and removed all containers');
  }
}
