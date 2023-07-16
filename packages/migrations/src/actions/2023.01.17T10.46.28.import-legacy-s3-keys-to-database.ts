import { createHmac } from 'crypto';
import bcryptjs from 'bcryptjs';
import pLimit from 'p-limit';
import * as zod from 'zod';
import { crypto, fetch, Headers, Request, TextEncoder } from '@whatwg-node/fetch';
import { type MigrationExecutor } from '../pg-migrator';

// treat an empty string (`''`) as undefined
const emptyString = <T extends zod.ZodType>(input: T) => {
  return zod.preprocess((value: unknown) => {
    if (value === '') return undefined;
    return value;
  }, input);
};

const TargetsModel = zod.array(
  zod.object({
    id: zod.string(),
    created_at_cursor: zod.string(),
  }),
);

const shouldRunModel = zod.object({
  RUN_S3_LEGACY_CDN_KEY_IMPORT: emptyString(
    zod.union([zod.literal('1'), zod.literal('0')]).optional(),
  ),
});

const envModel = zod.object({
  S3_ACCESS_KEY_ID: zod.string().min(1),
  S3_SECRET_ACCESS_KEY: zod.string().min(1),
  S3_ENDPOINT: zod.string().url(),
  S3_BUCKET_NAME: zod.string().min(1),
  CDN_AUTH_PRIVATE_KEY: zod.string().min(1),
});

type Cursor = {
  lastId: string;
  lastCreatedAt: string;
};

 const run: MigrationExecutor['run'] = async ({  connection, sql  }) => {
  // eslint-disable-next-line no-process-env
  const eenv = shouldRunModel.parse(process.env);
  const shouldRun = eenv.RUN_S3_LEGACY_CDN_KEY_IMPORT === '1';

  if (!shouldRun) {
    return;
  }

  // eslint-disable-next-line no-process-env
  const env = envModel.parse(process.env);

  const s3Client = new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    service: 's3',
  });

  function generateLegacyCDNAccessToken(targetId: string): string {
    const encoder = new TextEncoder();
    return createHmac('sha256', env.CDN_AUTH_PRIVATE_KEY)
      .update(encoder.encode(targetId))
      .digest('base64');
  }

  async function getPaginationTargets(
    cursor: null | Cursor,
  ): Promise<zod.TypeOf<typeof TargetsModel>> {
    // Note: there is no index for this query, so it might be slow
    // Also all this code runs inside a database transaction.
    // This will block any other writes to the table.
    // As the table should not be heavily in use when this is being run, it does not really matter.
    const query = sql`
      SELECT
        "id"
        , to_json("created_at") as "created_at_cursor"
      FROM
        "targets"
      ${
        cursor
          ? sql`
              WHERE
                ("created_at" = ${cursor.lastCreatedAt} AND "id" > ${cursor.lastId})
                OR "created_at" > ${cursor.lastCreatedAt}
            `
          : sql``
      }
      ORDER BY
        "created_at" ASC
        , "id" ASC
      LIMIT
        200
    `;

    const items = await connection.query(query);
    return TargetsModel.parse(items.rows);
  }

  let lastCursor: null | Cursor = null;

  async function seedLegacyCDNKey(item: zod.TypeOf<typeof TargetsModel>[number]): Promise<void> {
    const s3Key = `cdn-legacy-keys/${item.id}`;
    const privateAccessKey = generateLegacyCDNAccessToken(item.id);
    const firstCharacters = privateAccessKey.substring(0, 3);
    const lastCharacters = privateAccessKey.substring(privateAccessKey.length - 3);
    const accessKeyHash = await bcryptjs.hash(privateAccessKey, await bcryptjs.genSalt());

    // After creation on database
    const response = await s3Client.fetch([env.S3_ENDPOINT, env.S3_BUCKET_NAME, s3Key].join('/'), {
      method: 'PUT',
      body: accessKeyHash,
    });

    if (response.status !== 200) {
      throw new Error(`Unexpected Status for storing key. (status=${response.status})`);
    }

    const query = sql`
      INSERT INTO
        "cdn_access_tokens"
        (
          "target_id"
          , "s3_key"
          , "first_characters"
          , "last_characters"
          , "alias"
        )
      VALUES
        (
          ${item.id}
          , ${s3Key}
          , ${firstCharacters}
          , ${lastCharacters}
          , 'CDN Access Token'
        )
      ON CONFLICT DO NOTHING
    `;

    await connection.query(query);
  }

  const limit = pLimit(20);

  do {
    const items: zod.TypeOf<typeof TargetsModel> = await getPaginationTargets(lastCursor);
    await Promise.all(items.map(item => limit(() => seedLegacyCDNKey(item))));

    lastCursor = null;
    if (items.length > 0) {
      lastCursor = {
        lastId: items[items.length - 1].id,
        lastCreatedAt: items[items.length - 1].created_at_cursor,
      };
    }
  } while (lastCursor !== null);
};

const encoder = new TextEncoder();

const HOST_SERVICES: Record<string, string | void> = {
  appstream2: 'appstream',
  cloudhsmv2: 'cloudhsm',
  email: 'ses',
  marketplace: 'aws-marketplace',
  mobile: 'AWSMobileHubService',
  pinpoint: 'mobiletargeting',
  queue: 'sqs',
  'git-codecommit': 'codecommit',
  'mturk-requester-sandbox': 'mturk-requester',
  'personalize-runtime': 'personalize',
};

// https://github.com/aws/aws-sdk-js/blob/cc29728c1c4178969ebabe3bbe6b6f3159436394/lib/signers/v4.js#L190-L198
const UNSIGNABLE_HEADERS = new Set([
  'authorization',
  'content-type',
  'content-length',
  'user-agent',
  'presigned-expires',
  'expect',
  'x-amzn-trace-id',
  'range',
  'connection',
]);

type AwsRequestInit = RequestInit & {
  aws?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    service?: string;
    region?: string;
    cache?: Map<string, ArrayBuffer>;
    datetime?: string;
    signQuery?: boolean;
    appendSessionToken?: boolean;
    allHeaders?: boolean;
    singleEncode?: boolean;
  };
};

class AwsClient {
  private secretAccessKey: string;
  private accessKeyId: string;
  private sessionToken?: string;
  private service?: string;
  private region?: string;
  private cache: Map<string, ArrayBuffer>;
  private retries: number;
  private initRetryMs: number;

  constructor({
    accessKeyId,
    secretAccessKey,
    sessionToken,
    service,
    region,
    cache,
    retries,
    initRetryMs,
  }: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    service?: string;
    region?: string;
    cache?: Map<string, ArrayBuffer>;
    retries?: number;
    initRetryMs?: number;
  }) {
    if (accessKeyId == null) throw new TypeError('accessKeyId is a required option');
    if (secretAccessKey == null) throw new TypeError('secretAccessKey is a required option');
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    this.service = service;
    this.region = region;
    this.cache = cache || new Map();
    this.retries = retries != null ? retries : 10; // Up to 25.6 secs
    this.initRetryMs = initRetryMs || 50;
  }

  async sign(input: RequestInfo, init?: AwsRequestInit) {
    if (input instanceof Request) {
      const { method, url, headers, body } = input;
      init = Object.assign({ method, url, headers }, init);
      if (init.body == null && headers.has('Content-Type')) {
        init.body =
          body != null && headers.has('X-Amz-Content-Sha256')
            ? body
            : await input.clone().arrayBuffer();
      }
      input = url;
    }
    const signer = new AwsV4Signer(Object.assign({ url: input }, init, this, init && init.aws));
    const signed = Object.assign({}, init, await signer.sign());
    delete signed.aws;
    try {
      return new Request(signed.url.toString(), signed);
    } catch (e) {
      if (e instanceof TypeError) {
        // https://bugs.chromium.org/p/chromium/issues/detail?id=1360943
        return new Request(signed.url.toString(), Object.assign({ duplex: 'half' }, signed));
      }
      throw e;
    }
  }

  async fetch(input: RequestInfo, init: AwsRequestInit): Promise<Response> {
    for (let i = 0; i <= this.retries; i++) {
      const fetched = fetch(await this.sign(input, init));
      if (i === this.retries) {
        return fetched; // No need to await if we're returning anyway
      }
      const res = await fetched;
      if (res.status < 500 && res.status !== 429 && res.status !== 499) {
        return res;
      }
      await new Promise(resolve =>
        setTimeout(resolve, Math.random() * this.initRetryMs * Math.pow(2, i)),
      );
    }
    throw new Error('An unknown error occurred, ensure retries is not negative');
  }
}

class AwsV4Signer {
  private method: string;
  private url: URL;
  private headers: Headers;
  private body?: BodyInit | null;
  private accessKeyId: string;
  private secretAccessKey: string;
  private sessionToken?: string;
  private service: string;
  private region: string;
  private cache: Map<string, ArrayBuffer>;
  private datetime: string;
  private signQuery?: boolean;
  private appendSessionToken?: boolean;
  private signableHeaders: Array<string>;
  private signedHeaders: string;
  private canonicalHeaders: string;
  private credentialString: string;
  private encodedPath: string;
  private encodedSearch: string;

  constructor({
    method,
    url,
    headers,
    body,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    service,
    region,
    cache,
    datetime,
    signQuery,
    appendSessionToken,
    allHeaders,
    singleEncode,
  }: {
    method?: string;
    url: string;
    headers?: HeadersInit;
    body?: BodyInit | null;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    service?: string;
    region?: string;
    cache?: Map<string, ArrayBuffer>;
    datetime?: string;
    signQuery?: boolean;
    appendSessionToken?: boolean;
    allHeaders?: boolean;
    singleEncode?: boolean;
  }) {
    if (url == null) throw new TypeError('url is a required option');
    if (accessKeyId == null) throw new TypeError('accessKeyId is a required option');
    if (secretAccessKey == null) throw new TypeError('secretAccessKey is a required option');
    this.method = method || (body ? 'POST' : 'GET');
    this.url = new URL(url);
    this.headers = new Headers(headers || {});
    this.body = body;

    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;

    let guessedService, guessedRegion;
    if (!service || !region) {
      [guessedService, guessedRegion] = guessServiceRegion(this.url, this.headers);
    }
    /** @type {string} */
    this.service = service || guessedService || '';
    this.region = region || guessedRegion || 'us-east-1';

    this.cache = cache || new Map();
    this.datetime = datetime || new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    this.signQuery = signQuery;
    this.appendSessionToken = appendSessionToken || this.service === 'iotdevicegateway';

    this.headers.delete('Host'); // Can't be set in insecure env anyway

    if (this.service === 's3' && !this.signQuery && !this.headers.has('X-Amz-Content-Sha256')) {
      this.headers.set('X-Amz-Content-Sha256', 'UNSIGNED-PAYLOAD');
    }

    const params = this.signQuery ? this.url.searchParams : this.headers;

    params.set('X-Amz-Date', this.datetime);
    if (this.sessionToken && !this.appendSessionToken) {
      params.set('X-Amz-Security-Token', this.sessionToken);
    }

    const theHeaders: Array<string> = ['host'];

    // headers are always lowercase in keys()
    this.signableHeaders = theHeaders
      .filter(header => allHeaders || !UNSIGNABLE_HEADERS.has(header))
      .sort();

    this.signedHeaders = this.signableHeaders.join(';');

    // headers are always trimmed:
    // https://fetch.spec.whatwg.org/#concept-header-value-normalize
    this.canonicalHeaders = this.signableHeaders
      .map(
        header =>
          header +
          ':' +
          (header === 'host'
            ? this.url.host
            : (this.headers.get(header) || '').replace(/\s+/g, ' ')),
      )
      .join('\n');

    this.credentialString = [
      this.datetime.slice(0, 8),
      this.region,
      this.service,
      'aws4_request',
    ].join('/');

    if (this.signQuery) {
      if (this.service === 's3' && !params.has('X-Amz-Expires')) {
        params.set('X-Amz-Expires', this.headers.get('X-Amz-Expires') ?? '86400'); // 24 hours
      }
      params.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
      params.set('X-Amz-Credential', this.accessKeyId + '/' + this.credentialString);
      params.set('X-Amz-SignedHeaders', this.signedHeaders);
    }

    if (this.service === 's3') {
      try {
        /** @type {string} */
        this.encodedPath = decodeURIComponent(this.url.pathname.replace(/\+/g, ' '));
      } catch (e) {
        this.encodedPath = this.url.pathname;
      }
    } else {
      this.encodedPath = this.url.pathname.replace(/\/+/g, '/');
    }
    if (!singleEncode) {
      this.encodedPath = encodeURIComponent(this.encodedPath).replace(/%2F/g, '/');
    }
    this.encodedPath = encodeRfc3986(this.encodedPath);

    const searchParams: Array<[string, string]> = [];

    this.url.searchParams.forEach((value, key) => searchParams.push([key, value]));

    const seenKeys = new Set();
    this.encodedSearch = searchParams
      .filter(([k]) => {
        if (!k) return false; // no empty keys
        if (this.service === 's3') {
          if (seenKeys.has(k)) return false; // first val only for S3
          seenKeys.add(k);
        }
        return true;
      })
      .map(pair => pair.map(p => encodeRfc3986(encodeURIComponent(p))))
      .sort(([k1, v1], [k2, v2]) => (k1 < k2 ? -1 : k1 > k2 ? 1 : v1 < v2 ? -1 : v1 > v2 ? 1 : 0))
      .map(pair => pair.join('='))
      .join('&');
  }

  async sign(): Promise<{
    method: string;
    url: URL;
    headers: Headers;
    body?: BodyInit | null;
  }> {
    if (this.signQuery) {
      this.url.searchParams.set('X-Amz-Signature', await this.signature());
      if (this.sessionToken && this.appendSessionToken) {
        this.url.searchParams.set('X-Amz-Security-Token', this.sessionToken);
      }
    } else {
      this.headers.set('Authorization', await this.authHeader());
    }

    return {
      method: this.method,
      url: this.url,
      headers: this.headers,
      body: this.body,
    };
  }

  async authHeader(): Promise<string> {
    return [
      'AWS4-HMAC-SHA256 Credential=' + this.accessKeyId + '/' + this.credentialString,
      'SignedHeaders=' + this.signedHeaders,
      'Signature=' + (await this.signature()),
    ].join(', ');
  }

  async signature(): Promise<string> {
    const date = this.datetime.slice(0, 8);
    const cacheKey = [this.secretAccessKey, date, this.region, this.service].join();
    let kCredentials = this.cache.get(cacheKey);
    if (!kCredentials) {
      const kDate = await hmac('AWS4' + this.secretAccessKey, date);
      const kRegion = await hmac(kDate, this.region);
      const kService = await hmac(kRegion, this.service);
      kCredentials = await hmac(kService, 'aws4_request');
      this.cache.set(cacheKey, kCredentials);
    }
    return buf2hex(await hmac(kCredentials, await this.stringToSign()));
  }

  async stringToSign(): Promise<string> {
    return [
      'AWS4-HMAC-SHA256',
      this.datetime,
      this.credentialString,
      buf2hex(await hash(await this.canonicalString())),
    ].join('\n');
  }

  async canonicalString(): Promise<string> {
    return [
      this.method.toUpperCase(),
      this.encodedPath,
      this.encodedSearch,
      this.canonicalHeaders + '\n',
      this.signedHeaders,
      await this.hexBodyHash(),
    ].join('\n');
  }

  async hexBodyHash(): Promise<string> {
    let hashHeader =
      this.headers.get('X-Amz-Content-Sha256') ||
      (this.service === 's3' && this.signQuery ? 'UNSIGNED-PAYLOAD' : null);
    if (hashHeader == null) {
      if (this.body && typeof this.body !== 'string' && !('byteLength' in this.body)) {
        throw new Error(
          'body must be a string, ArrayBuffer or ArrayBufferView, unless you include the X-Amz-Content-Sha256 header',
        );
      }
      hashHeader = buf2hex(await hash(this.body || ''));
    }
    return hashHeader;
  }
}

async function hmac(
  key: string | ArrayBufferView | ArrayBuffer,
  string: string,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? encoder.encode(key) : key,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(string));
}

async function hash(content: string | ArrayBufferView | ArrayBuffer): Promise<ArrayBuffer> {
  return crypto.subtle.digest(
    'SHA-256',
    typeof content === 'string' ? encoder.encode(content) : content,
  );
}

function buf2hex(buffer: ArrayBuffer) {
  return Array.prototype.map
    .call(new Uint8Array(buffer), x => ('0' + x.toString(16)).slice(-2))
    .join('');
}

function encodeRfc3986(urlEncodedStr: string): string {
  return urlEncodedStr.replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function guessServiceRegion(url: URL, headers: Headers) {
  const { hostname, pathname } = url;

  if (hostname.endsWith('.r2.cloudflarestorage.com')) {
    return ['s3', 'auto'];
  }
  if (hostname.endsWith('.backblazeb2.com')) {
    const match = hostname.match(/^(?:[^.]+\.)?s3\.([^.]+)\.backblazeb2\.com$/);
    return match != null ? ['s3', match[1]] : ['', ''];
  }
  const match = hostname
    .replace('dualstack.', '')
    .match(/([^.]+)\.(?:([^.]*)\.)?amazonaws\.com(?:\.cn)?$/);
  let [service, region] = (match || ['', '']).slice(1, 3);

  if (region === 'us-gov') {
    region = 'us-gov-west-1';
  } else if (region === 's3' || region === 's3-accelerate') {
    region = 'us-east-1';
    service = 's3';
  } else if (service === 'iot') {
    if (hostname.startsWith('iot.')) {
      service = 'execute-api';
    } else if (hostname.startsWith('data.jobs.iot.')) {
      service = 'iot-jobs-data';
    } else {
      service = pathname === '/mqtt' ? 'iotdevicegateway' : 'iotdata';
    }
  } else if (service === 'autoscaling') {
    const targetPrefix = (headers.get('X-Amz-Target') || '').split('.')[0];
    if (targetPrefix === 'AnyScaleFrontendService') {
      service = 'application-autoscaling';
    } else if (targetPrefix === 'AnyScaleScalingPlannerFrontendService') {
      service = 'autoscaling-plans';
    }
  } else if (region == null && service.startsWith('s3-')) {
    region = service.slice(3).replace(/^fips-|^external-1/, '');
    service = 's3';
  } else if (service.endsWith('-fips')) {
    service = service.slice(0, -5);
  } else if (region && /-\d$/.test(service) && !/-\d$/.test(region)) {
    [service, region] = [region, service];
  }

  return [HOST_SERVICES[service] || service, region];
}

export default {
  name: '2023.01.17T10.46.28.import-legacy-s3-keys-to-database.mts',
  run,
} satisfies MigrationExecutor
