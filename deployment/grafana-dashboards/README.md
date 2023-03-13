# Grafana Dashboards (Hive Cloud)

This directory includes Grafana dashboard used internally for managing and monitoring the Hive Cloud
service.

> If you wish to use these metrics and dashboards, please contact us for additional information.

## Adding a new dashboard

Create a new dashboard in Grafana dashboard, and then click the "Share" icon, pick "Export" tab and
then copy/export the JSON file. Place the file in this directory, and you are done, Pulumi will pick
it up in next deployment.

## Editing an existing dashboard

You may edit dashboards, but note that it will be override by the next deployment. To update a
dashboard, update it first in Grafana, and then click the "Share" icon, pick "Export" tab and then
copy/export the JSON file. Replace the file as-is.

## Parameters

Some aspects of the dashboard might be effected/related to environment-specific variables. To pass
variables, add to the Pulumi stack configuration file, a key under `grafanaDashboards:params` with
the `variable = value`, for example:

```yaml
grafanaDashboards:params:
  SOME_VAR: value
```

Then, in the dashboard's JSON model file, you can use the variable name, as is (we do a simple
string replacement).

> The `ENV_NAME` is injected automatically, with the name of the Pulumi stack.
