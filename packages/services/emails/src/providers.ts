import { fetch } from '@whatwg-node/fetch';
import { ensureEnv } from '@hive/service-common';

interface Email {
  to: string;
  subject: string;
  body: string;
}

const emailProviders = {
  postmark,
  mock,
};

export interface EmailProvider {
  id: keyof typeof emailProviders;
  send(email: Email): Promise<void>;
  history: Email[];
}

export function createEmailProvider(): EmailProvider {
  const emailProviderName = ensureEnv('EMAIL_PROVIDER') as keyof typeof emailProviders;

  switch (emailProviderName) {
    case 'mock':
      return mock();
    case 'postmark':
      return postmark();
    default:
      throw new Error(
        `Unknown email provider: ${emailProviderName}. Available: ${Object.keys(emailProviders).join(', ')}`
      );
  }
}

function postmark() {
  const token = ensureEnv('POSTMARK_TOKEN');
  const messageStream = ensureEnv('POSTMARK_MESSAGE_STREAM');
  const emailFrom = ensureEnv('EMAIL_FROM');

  return {
    id: 'postmark' as const,
    async send(email: Email) {
      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Postmark-Server-Token': token,
        },
        body: JSON.stringify({
          From: emailFrom,
          To: email.to,
          Subject: email.subject,
          HtmlBody: email.body,
          MessageStream: messageStream,
        }),
      });

      if (!response.ok) {
        const details = await response.json();
        throw new Error(details.Message ?? response.statusText);
      }
    },
    history: [],
  };
}

function mock(): EmailProvider {
  const history: Email[] = [];

  return {
    id: 'mock' as const,
    async send(email: Email) {
      history.push(email);
    },
    history,
  };
}
