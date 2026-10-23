---
name: hive-debug-cli
description: Suggest solutions to errors that occur when using the hive-cli commands. Use when a hive-cli command (e.g. schema:check, schema:publish) fails with an error code such as HIVE103, HIVE301, or other HIVE1xx/2xx/3xx/6xx codes.
license: MIT
compatibility: '@graphql-hive/cli 0.66.0 or later'
metadata:
  author: Emily Goodwin
  version: '1.0.0'
allowed-tools: WebFetch
---

# Hive Debug CLI

## Instructions

### Step 1: Analyze the CLI Command and Error Code

Using the terminal output, identify the command that triggered the error, the parameters passed to it, and the error code it produced. This information will be used in step 2.

If the terminal output doesn't include a command or an error code, do not guess. Ask the user for the exact command they ran and the full error output before proceeding.

### Step 2: Explain the Error Code and Why it was Triggered

Using the information gained in step 1, use [this link](https://the-guild.dev/graphql/hive/docs/api-reference/cli#errors) to determine the reason for the error code. Based on this information, determine the suggested fix and reason for the error code.

Verify your results against the error code documentation and ensure it makes sense given the parameters passed in and the error code. If you don't know, tell the user you don't know. If the WebFetch fails, share the URL with the user.