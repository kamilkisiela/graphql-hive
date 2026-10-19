import { createRequire } from 'node:module';
import { createEmailProvider } from './providers';

const sent: Array<Record<string, unknown>> = [];

vi.mock('sendmail', () => ({
  default: () => (mail: Record<string, unknown>, callback: (err: null, reply: string) => void) => {
    sent.push(mail);
    callback(null, 'ok');
  },
}));

/** The message `sendmail` would put on the wire, built by the mailcomposer it depends on. */
function buildLikeSendmail(mail: Record<string, unknown>): Promise<string> {
  const requireFromSendmail = createRequire(createRequire(import.meta.url).resolve('sendmail'));
  const mailcomposer = requireFromSendmail('mailcomposer');
  return new Promise((resolve, reject) =>
    mailcomposer(mail).build((err: Error | null, message: Buffer) =>
      err ? reject(err) : resolve(message.toString()),
    ),
  );
}

describe('sendmail provider', () => {
  test('no line of the message starts with a dot, which SMTP would drop (#7702)', async () => {
    const provider = createEmailProvider({ provider: 'sendmail' }, 'hive@example.com');
    const url =
      'https://graphql-hive-dataservicelayer-prod.proddsl.zzzzzzz.aa.bbbbbb.cccc/join/3f6f16d1c';

    // Quoted-printable wraps at 76 characters; slide the URL through every alignment.
    for (let pad = 0; pad < 80; pad++) {
      sent.length = 0;
      await provider.send({
        to: 'someone@example.com',
        subject: 'Invitation',
        body: `<p>${'x'.repeat(pad)}<a href="${url}">${url}</a></p>`,
      });
      const message = await buildLikeSendmail(sent[0]);
      expect(message.split(/\r?\n/).filter(line => line.startsWith('.'))).toEqual([]);
    }
  });
});
