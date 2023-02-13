import * as pulumi from '@pulumi/pulumi';

export type Kafka = ReturnType<typeof deployKafka>;

export function deployKafka() {
  const eventhubConfig = new pulumi.Config('eventhub');

  return {
    connectionEnv: {
      KAFKA_SSL: '1',
      KAFKA_SASL_MECHANISM: 'plain',
      KAFKA_CONCURRENCY: '1',
      KAFKA_SASL_USERNAME: '$ConnectionString',
      KAFKA_SASL_PASSWORD: eventhubConfig.requireSecret('key'),
    } as Record<string, pulumi.Output<string> | string>,
    config: {
      endpoint: eventhubConfig.require('endpoint'),
      bufferSize: eventhubConfig.require('bufferSize'),
      bufferInterval: eventhubConfig.require('bufferInterval'),
      bufferDynamic: eventhubConfig.require('bufferDynamic'),
      topic: eventhubConfig.require('topic'),
      consumerGroup: eventhubConfig.require('consumerGroup'),
    },
    service: null,
    deployment: null,
  };
}
