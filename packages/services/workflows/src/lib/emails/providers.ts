import nodemailer from 'nodemailer';
import sm from 'sendmail';

/** `sendmail` hands these to mailcomposer, which also reads `textEncoding`; the types omit it. */
type SendmailMailInput = Parameters<ReturnType<typeof sm>>[0] & { textEncoding?: 'base64' };

interface Email {
  to: string;
  subject: string;
  body: string;
  date: Date;
}

type EmailProviders = 'postmark' | 'mock' | 'smtp' | 'sendmail';

export interface EmailProvider {
  id: EmailProviders;
  send(email: Omit<Email, 'date'>): Promise<void>;
  history: Email[];
}

type PostmarkEmailProviderConfig = {
  provider: 'postmark';
  token: string;
  messageStream: string;
};

type MockEmailProviderConfig = {
  provider: 'mock';
};

type SMTPEmailProviderConfig = {
  provider: 'smtp';
  protocol: 'smtp' | 'smtps';
  host: string;
  port: number;
  auth: {
    user: string;
    pass: string;
  };
  tls: {
    rejectUnauthorized: boolean;
  };
  ignoreTLS: boolean;
};

type SendmailEmailProviderConfig = {
  provider: 'sendmail';
};

type EmailProviderConfig =
  | SMTPEmailProviderConfig
  | PostmarkEmailProviderConfig
  | SendmailEmailProviderConfig
  | MockEmailProviderConfig;

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
      history.push({
        ...email,
        date: new Date(),
      });
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
    ignoreTLS: config.ignoreTLS,
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
            // `sendmail` writes the message into SMTP DATA without doubling a line's leading
            // dot, as RFC 5321 §4.5.2 requires, so the receiving server drops that dot. Its
            // default quoted-printable body wraps at 76 characters and can start a line with
            // the "." of a URL: an invite to `…prod.proddsl.zzzzzzz…` arrived as
            // `…prod.proddslzzzzzzz…` (#7702). Base64 has no "." in its alphabet.
            textEncoding: 'base64',
          } as SendmailMailInput,
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
