import { got, type Method, type OptionsInit } from 'got';

/**
 * This is a copy of https://github.com/mhart/aws4fetch which is licensed MIT
 * See https://github.com/mhart/aws4fetch/issues/22
 */

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

type AwsRequestInit = {
  method: Method;
  body?: string | undefined;
  headers?: Record<string, string>;
} & Pick<OptionsInit, 'retry' | 'signal' | 'timeout'> & {
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

export class AwsClient {
  private secretAccessKey: string;
  private accessKeyId: string;
  private sessionToken?: string;
  private service?: string;
  private region?: string;
  private cache: Map<string, ArrayBuffer>;

  constructor({
    accessKeyId,
    secretAccessKey,
    sessionToken,
    service,
    region,
    cache,
  }: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    service?: string;
    region?: string;
    cache?: Map<string, ArrayBuffer>;
  }) {
    if (accessKeyId == null) throw new TypeError('accessKeyId is a required option');
    if (secretAccessKey == null) throw new TypeError('secretAccessKey is a required option');
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    this.service = service;
    this.region = region;
    this.cache = cache || new Map();
  }

  async fetch(url: string, init: AwsRequestInit) {
    console.log(`Calling ${init.method} ${url}`);
    const startedAt = Date.now();

    const signed = await this.sign(url, init);

    return got(signed.url, {
      method: signed.init.method,
      body: signed.init.body,
      headers: signed.init.headers,
      responseType: 'text',
      retry: signed.init.retry ?? {
        // By default in GOT
        limit: 2,
        // By default in GOT
        methods: ['GET', 'PUT', 'HEAD', 'DELETE', 'OPTIONS', 'TRACE'],
        // By default in GOT
        statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
        // By default in GOT
        errorCodes: [
          'ETIMEDOUT',
          'ECONNRESET',
          'EADDRINUSE',
          'ECONNREFUSED',
          'EPIPE',
          'ENOTFOUND',
          'ENETUNREACH',
          'EAI_AGAIN',
        ],
      },
      signal: signed.init.signal,
      timeout: signed.init.timeout ?? {
        lookup: 3000,
        connect: 3000,
        secureConnect: 3000,
        request: 10_000, // more than enough to PUT
      },
      // To mimic Fetch API, we do not throw non 2xx and 3xx responses
      throwHttpErrors: false,
      hooks: {
        beforeRetry: [
          (error, retryCount) => {
            console.log(`Retrying ${init.method} ${url} [${retryCount}]: ${error.code}`);
          },
        ],
      },
    }).finally(() => {
      console.log(`Finished ${init.method} ${url} in ${Date.now() - startedAt}ms`);
    });
  }

  private async sign(url: string, init?: AwsRequestInit) {
    const signer = new AwsV4Signer({
      method: init?.method,
      url,
      headers: init?.headers,
      body: init?.body,
      accessKeyId: init?.aws?.accessKeyId || this.accessKeyId,
      secretAccessKey: init?.aws?.secretAccessKey || this.secretAccessKey,
      sessionToken: init?.aws?.sessionToken || this.sessionToken,
      service: init?.aws?.service || this.service,
      region: init?.aws?.region || this.region,
      cache: init?.aws?.cache || this.cache,
      datetime: init?.aws?.datetime,
      signQuery: init?.aws?.signQuery,
      appendSessionToken: init?.aws?.appendSessionToken,
      allHeaders: init?.aws?.allHeaders,
      singleEncode: init?.aws?.singleEncode,
    });
    const signed = await signer.sign();

    return {
      url: signed.url.toString(),
      init: {
        ...init,
        method: signed.method,
        body: signed.body,
        headers: signed.headers,
      },
    };
  }
}

export class AwsV4Signer {
  private method: Method;
  private url: URL;
  private headers: Headers;
  private body?: string | undefined;
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
    method?: Method;
    url: string;
    headers?: Record<string, string>;
    body?: string | undefined;
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
    method: Method;
    url: URL;
    headers: Record<string, string>;
    body?: string | undefined;
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
      headers: Object.fromEntries(this.headers.entries()),
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
