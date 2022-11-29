#!/bin/bash

helm package hive-app;
helm package hive-emails;
helm package hive-schema;
helm package hive-server;
helm package hive-storage;
helm package hive-tokens;
helm package hive-usage;
helm package hive-usage-ingestor;
helm package hive-webhooks;
helm package supertokens;
helm cm-push hive-app-1.0.0.tgz dblc;
helm cm-push hive-emails-1.0.0.tgz dblc;
helm cm-push hive-schema-1.0.0.tgz dblc;
helm cm-push hive-server-1.0.0.tgz dblc;
helm cm-push hive-storage-1.0.0.tgz dblc;
helm cm-push hive-tokens-1.0.0.tgz dblc;
helm cm-push hive-usage-1.0.0.tgz dblc;
helm cm-push hive-usage-ingestor-1.0.0.tgz dblc;
helm cm-push hive-webhooks-1.0.0.tgz dblc;
helm cm-push supertokens-1.0.0.tgz dblc;
