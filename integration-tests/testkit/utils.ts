import Docker from 'dockerode';
import { humanId } from 'human-id';

let docker: Docker | null = null;

function getDockerConnection() {
  if (!docker) {
    docker = new Docker();
  }

  return docker;
}

export async function getServiceHost(serviceName: string, servicePort: number): Promise<string> {
  const docker = getDockerConnection();
  const containers = await docker.listContainers({
    filters: JSON.stringify({
      label: [`com.docker.compose.service=${serviceName}`],
    }),
  });

  if (containers.length === 0) {
    throw new Error(`Failed to locate Docker container for service "${serviceName}"!`);
  }

  const container = containers[0];
  const ports = container.Ports || [];

  if (ports.length === 0) {
    throw new Error(
      `Container "${container.Id}" for service "${serviceName}" does not expose any ports!`,
    );
  }

  const publicPort = ports.find(p => p.PublicPort === servicePort);
  const privatePort = ports.find(p => p.PrivatePort === servicePort);

  if (!publicPort && !privatePort) {
    throw new Error(
      `Container "${container.Id}" for service "${serviceName}" does not expose port "${servicePort}"!`,
    );
  }

  if (publicPort) {
    return `localhost:${publicPort.PublicPort}`;
  }

  if (privatePort) {
    console.warn(
      `Container "${container.Id}" (service: "${serviceName}") expose port "${servicePort}" as "${privatePort.PublicPort}", please consider to update your setup!`,
    );

    return `localhost:${privatePort.PublicPort}`;
  }

  return `localhost:${servicePort}`;
}

export function generateUnique() {
  return humanId({
    separator: '',
    adjectiveCount: 1,
    addAdverb: true,
    capitalize: false,
  });
}
