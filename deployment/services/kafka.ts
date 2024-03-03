import * as pulumi from '@pulumi/pulumi';
import { ServiceSecret } from '../secrets';

export type Kafka = ReturnType<typeof deployKafka>;

export class KafkaSecret extends ServiceSecret<{
  ssl: '0' | '1' | pulumi.Output<'0' | '1'>;
  saslUsername: string | pulumi.Output<string>;
  saslPassword: string | pulumi.Output<string>;
  endpoint: string | pulumi.Output<string>;
}> {}

export function deployKafka() {
  const eventhubConfig = new pulumi.Config('eventhub');
  const secret = new KafkaSecret('kafka', {
    ssl: '1',
    saslUsername: '$ConnectionString',
    saslPassword: eventhubConfig.requireSecret('key'),
    endpoint: eventhubConfig.require('endpoint'),
  });

  return {
    secret,
    config: {
      saslMechanism: 'plain',
      concurrency: '1',
      bufferSize: eventhubConfig.require('bufferSize'),
      bufferInterval: eventhubConfig.require('bufferInterval'),
      bufferDynamic: eventhubConfig.require('bufferDynamic'),
      topic: eventhubConfig.require('topic'),
      consumerGroup: eventhubConfig.require('consumerGroup'),
    },
  };
}
