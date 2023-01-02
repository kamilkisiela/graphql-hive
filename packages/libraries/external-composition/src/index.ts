import crypto from 'crypto';

export const signatureHeaderName = 'x-hive-signature-256';
const sigHashAlg = 'sha256';

function hash(secret: string, algo: string, data: string) {
  return crypto.createHmac(algo, secret).update(data, 'utf-8').digest('hex');
}

export function verifyRequest(input: { body: string; signature: string; secret: string }) {
  const { body, signature, secret } = input;

  if (!body) {
    return 'ERR_EMPTY_BODY';
  }

  const sig = Buffer.from(signature ?? '', 'utf8');
  const digest = Buffer.from(hash(secret, sigHashAlg, body), 'utf8');

  if (sig.length !== digest.length || !crypto.timingSafeEqual(digest, sig)) {
    return 'ERR_INVALID_SIGNATURE';
  }
}

export interface CompositionSuccess {
  type: 'success';
  result: {
    supergraph: string;
    sdl: string;
  };
}

export interface CompositionFailure {
  type: 'failure';
  result: {
    errors: Array<{
      message: string;
      source: 'graphql' | 'composition';
    }>;
  };
}

type Input = Array<{
  sdl: string;
  name: string;
  url?: string;
}>;

export function compose(composition: (input: Input) => CompositionSuccess | CompositionFailure) {
  return (input: Input) => composition(input);
}
