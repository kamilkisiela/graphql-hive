import * as pulumi from '@pulumi/pulumi';
import { Kafka as KafkaDeployment } from '../utils/kafka';
import { getLocalComposeConfig } from '../utils/local-config';
import { serviceLocalHost } from '../utils/local-endpoint';

export type Kafka = ReturnType<typeof deployKafka>;

export function deployKafka() {
  const eventhubConfig = new pulumi.Config('eventhub');

  if (!eventhubConfig.getBoolean('inCluster')) {
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

  const kafkaService = getLocalComposeConfig().service('broker');
  const zookeeper = getLocalComposeConfig().service('zookeeper');
  const usageService = getLocalComposeConfig().service('usage');
  const usageIngestorService = getLocalComposeConfig().service('usage-ingestor');

  const localKafka = new KafkaDeployment('kafka-broker', {
    env: {
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true',
      KAFKA_BROKER_ID: '1',
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: 'PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT',
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: '0',
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: '1',
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: '1',
    },
    zookeeperImage: zookeeper.image,
    image: kafkaService.image,
  }).deploy();

  return {
    connectionEnv: {
      KAFKA_CONNECTION_MODE: 'docker',
      KAFKA_CONCURRENCY: '1',
    } as Record<string, pulumi.Output<string> | string>,
    service: localKafka.service,
    deployment: localKafka.deployment,
    config: {
      endpoint: serviceLocalHost(localKafka.service).apply(v => `${v}:29092`),
      bufferSize: String(usageService.environment['KAFKA_BUFFER_SIZE'] || ''),
      bufferInterval: String(usageService.environment['KAFKA_BUFFER_INTERVAL'] || ''),
      bufferDynamic: String(usageService.environment['KAFKA_BUFFER_DYNAMIC'] || ''),
      topic: usageService.environment['KAFKA_TOPIC'],
      consumerGroup: usageIngestorService.environment['KAFKA_CONSUMER_GROUP'] as string,
    },
  };
}
