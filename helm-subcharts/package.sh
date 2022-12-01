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
