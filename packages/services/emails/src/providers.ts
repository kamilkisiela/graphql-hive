import nodemailer from 'nodemailer';
import sm from 'sendmail';
import type {
  EmailProviderConfig,
  MockEmailProviderConfig,
  PostmarkEmailProviderConfig,
  SendmailEmailProviderConfig,
  SMTPEmailProviderConfig,
} from './environment';

interface Email {
  to: string;
  subject: string;
  body: string;
}

const emailProviders = {
  postmark,
  mock,
  smtp,
  sendmail,
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
    case 'smtp':
      return smtp(config, emailFrom);
    case 'sendmail':
      return sendmail(config, emailFrom);
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
        const details: any = await response.json();
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

function smtp(config: SMTPEmailProviderConfig, emailFrom: string) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.protocol === 'smtps',
    auth: {
      user: config.auth.user,
      pass: config.auth.pass,
    },
    tls: {
      rejectUnauthorized: config.tls.rejectUnauthorized,
    },
  });

  return {
    id: 'smtp' as const,
    async send(email: Email) {
      await transporter.sendMail({
        from: emailFrom,
        to: email.to,
        subject: email.subject,
        html: email.body,
      });
    },
    history: [],
  };
}

function sendmail(_config: SendmailEmailProviderConfig, emailFrom: string) {
  const client = sm({});

  return {
    id: 'sendmail' as const,
    async send(email: Email) {
      await new Promise((resolve, reject) => {
        client(
          {
            from: emailFrom,
            to: email.to,
            subject: email.subject,
            html: email.body,
          },
          (err, reply) => {
            if (err) {
              reject(err);
            } else {
              resolve(reply);
            }
          },
        );
      });
    },
    history: [],
  };
}
