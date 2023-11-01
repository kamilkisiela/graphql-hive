import type { ParseOptions, Source } from 'graphql';
import type { Plugin } from 'graphql-yoga';
import promClient from 'prom-client';
import { maxAliasesRule } from '@escape.tech/graphql-armor-max-aliases';
import { maxDepthRule } from '@escape.tech/graphql-armor-max-depth';
import { maxDirectivesRule } from '@escape.tech/graphql-armor-max-directives';
import { MaxTokensParserWLexer } from '@escape.tech/graphql-armor-max-tokens';
import * as Sentry from '@sentry/node';

const rejectedRequests = new promClient.Counter({
  name: 'graphql_armor_rejected_requests',
  help: 'Number of failed graphql requests',
  labelNames: ['reason'],
});

// prom client metric for tracking the number of failed requests and their user agents
const failedClientRequests = new promClient.Counter({
  name: 'graphql_armor_hive_client_rejections',
  help: 'Number of failed graphql requests sent from hive clients',
  labelNames: ['clientVersion', 'reason'],
});

const getHiveClientVersion = (userAgent: string | null) => {
  if (userAgent === null) {
    return null;
  }
  const match = userAgent.match(/hive-client\/([0-9.]+)/);
  return match ? match[1] : null;
};

export function useArmor<
  PluginContext extends Record<string, any> = {},
  TServerContext extends Record<string, any> = {},
  TUserContext = {},
>(): Plugin<PluginContext, TServerContext, TUserContext> {
  return {
    onValidate(ctx) {
      const hiveClientVersion = getHiveClientVersion(ctx.context.request.headers.get('user-agent'));

      ctx.addValidationRule(
        maxAliasesRule({
          n: 20,
          allowList: ['__responseCacheTypeName', '__responseCacheId'],
          onReject: [
            (_, error) => {
              rejectedRequests.inc({
                reason: 'maxAliases',
              });

              if (hiveClientVersion) {
                failedClientRequests.inc({
                  clientVersion: hiveClientVersion,
                  reason: 'maxAliases',
                });

                Sentry.captureException(error, {
                  level: 'fatal',
                });
              }
            },
          ],
        }),
      );
      ctx.addValidationRule(
        maxDirectivesRule({
          n: 20,
          onReject: [
            (_, error) => {
              rejectedRequests.inc({
                reason: 'maxDirectives',
              });

              if (hiveClientVersion) {
                failedClientRequests.inc({
                  clientVersion: hiveClientVersion,
                  reason: 'maxDirectives',
                });

                Sentry.captureException(error, {
                  level: 'fatal',
                });
              }
            },
          ],
        }),
      );
      ctx.addValidationRule(
        maxDepthRule({
          n: 20,
          onReject: [
            (_, error) => {
              rejectedRequests.inc({
                reason: 'maxDepth',
              });

              if (hiveClientVersion) {
                failedClientRequests.inc({
                  clientVersion: hiveClientVersion,
                  reason: 'maxDepth',
                });

                Sentry.captureException(error, {
                  level: 'fatal',
                });
              }
            },
          ],
        }),
      );
    },
    onParse(ctx) {
      function parseWithTokenLimit(source: string | Source, options: ParseOptions) {
        const parser = new MaxTokensParserWLexer(source, {
          ...options,
          n: 800,
          onReject: [
            (_, error) => {
              rejectedRequests.inc({
                reason: 'maxTokenCount',
              });
              const hiveClientVersion = getHiveClientVersion(
                ctx.context.request.headers.get('user-agent'),
              );

              if (hiveClientVersion) {
                failedClientRequests.inc({
                  clientVersion: hiveClientVersion,
                  reason: 'maxTokenCount',
                });

                Sentry.captureException(error, {
                  level: 'fatal',
                });
              }
            },
          ],
        });
        return parser.parseDocument();
      }

      ctx.setParseFn(parseWithTokenLimit);
    },
  };
}
