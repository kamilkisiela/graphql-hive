import { fetch } from 'cross-undici-fetch';
import type { EmailProviderConfig, PostmarkEmailProviderConfig, MockEmailProviderConfig } from './environment';

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

export function createEmailProvider(config: EmailProviderConfig, emailFrom: string): EmailProvider {
  switch (config.provider) {
    case 'mock':
      return mock(config, emailFrom);
    case 'postmark':
      return postmark(config, emailFrom);
  }
}

function postmark(config: PostmarkEmailProviderConfig, emailFrom: string) {
  return {
    id: 'postmark' as const,
    async send(email: Email) {
      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Postmark-Server-Token': config.token,
        },
        body: JSON.stringify({
          From: emailFrom,
          To: email.to,
          Subject: email.subject,
          HtmlBody: email.body,
          MessageStream: config.messageStream,
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

function mock(_config: MockEmailProviderConfig, _emailFrom: string): EmailProvider {
  const history: Email[] = [];

  return {
    id: 'mock' as const,
    async send(email: Email) {
      history.push(email);
    },
    history,
  };
}
