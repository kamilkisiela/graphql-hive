import * as pulumi from '@pulumi/pulumi';

export type Kafka = ReturnType<typeof deployKafka>;

export function deployKafka() {
  const eventhubConfig = new pulumi.Config('eventhub');

  return {
    config: {
      key: eventhubConfig.requireSecret('key'),
      user: '$ConnectionString',
      endpoint: eventhubConfig.require('endpoint'),
      bufferSize: eventhubConfig.require('bufferSize'),
      bufferInterval: eventhubConfig.require('bufferInterval'),
      bufferDynamic: eventhubConfig.require('bufferDynamic'),
    },
  };
}
