import { Inject, Injectable, InjectionToken, Optional } from 'graphql-modules';
import type { EmailsApi } from '@hive/emails';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';

export const EMAILS_ENDPOINT = new InjectionToken<string>('EMAILS_ENDPOINT');

@Injectable()
export class Emails {
  private api;

  constructor(@Optional() @Inject(EMAILS_ENDPOINT) endpoint?: string) {
    this.api = endpoint
      ? createTRPCProxyClient<EmailsApi>({
          links: [
            httpLink({
              url: `${endpoint}/trpc`,
              fetch,
            }),
          ],
        })
      : null;
  }

  schedule(input: { id?: string; email: string; subject: string; body: MJMLValue }) {
    if (!this.api) {
      return Promise.resolve();
    }

    return this.api.schedule.mutate({
      ...input,
      body: input.body.content,
    });
  }
}
export type MJMLValue = {
  readonly kind: 'mjml';
  readonly content: string;
};

type RawValue = {
  readonly kind: 'raw';
  readonly content: string;
};
type SpecialValues = RawValue;
type ValueExpression = string | SpecialValues;

function isOfKind<T extends SpecialValues>(value: unknown, kind: T['kind']): value is T {
  return !!value && typeof value === 'object' && 'kind' in value && value.kind === kind;
}

function isRawValue(value: unknown): value is RawValue {
  return isOfKind<RawValue>(value, 'raw');
}

export function mjml(parts: TemplateStringsArray, ...values: ValueExpression[]): MJMLValue {
  let content = '';
  let index = 0;

  for (const part of parts) {
    const token = values[index++];

    content += part;

    if (index >= parts.length) {
      continue;
    }

    if (token === undefined) {
      throw new Error('MJML tag cannot be bound an undefined value.');
    } else if (isRawValue(token)) {
      content += token.content;
    } else if (typeof token === 'string') {
      content += escapeHtml(token);
    } else {
      throw new TypeError('mjml: Unexpected value expression.');
    }
  }

  return {
    kind: 'mjml',
    content: content,
  };
}

mjml.raw = (content: string): RawValue => ({
  kind: 'raw',
  content,
});

/**
 * @source https://github.com/component/escape-html
 */

function escapeHtml(input: string): string {
  const matchHtmlRegExp = /["'&<>]/;
  const match = matchHtmlRegExp.exec(input);

  if (!match) {
    return input;
  }

  let escape;
  let html = '';
  let index = 0;
  let lastIndex = 0;

  for (index = match.index; index < input.length; index++) {
    switch (input.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;';
        break;
      case 38: // &
        escape = '&amp;';
        break;
      case 39: // '
        escape = '&#39;';
        break;
      case 60: // <
        escape = '&lt;';
        break;
      case 62: // >
        escape = '&gt;';
        break;
      default:
        continue;
    }

    if (lastIndex !== index) {
      html += input.substring(lastIndex, index);
    }

    lastIndex = index + 1;
    html += escape;
  }

  return lastIndex !== index ? html + input.substring(lastIndex, index) : html;
}
