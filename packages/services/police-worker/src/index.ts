const CF_BASE_URL = 'https://api.cloudflare.com/client/v4';

addEventListener('scheduled', event => {
  event.waitUntil(handleSchedule());
});

async function execute(
  url: string,
  options: RequestInit<RequestInitCfProperties> = {},
): Promise<any> {
  const config = {
    headers: {
      Authorization: `Bearer ${CF_BEARER_TOKEN}`,
      'Content-type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
    ...options,
  };

  return await fetch(`${CF_BASE_URL}/zones/${ZONE_IDENTIFIER}${url}`, config).then(r => r.json());
}

/**
 * Requirements:
 *  - HIVE_POLICE KV store has to be available.
 *  - WAF_RULE_NAME has to be available
 *
 * Police Worker can block http requests based on:
 *  - IP
    - missing headers
 *  - headers with specific values
 *
 * @example:
 *  - header:x-api-token|authorization:empty:POST:/usage
 *    Blocks all POST requests to /usage without x-api-token and authorization headers.
 * 
 *  - header:content-type:empty:POST:/usage
 *    Block all POST requests to /usage without content-type header.
 *
 *  - ip:1.1.1.1
 *    Block all requests from 1.1.1.1 IP
 */
async function handleSchedule() {
  const data = await HIVE_POLICE.list();
  const rulesArr = data.keys.map(key => {
    const [type, value, ...rest] = key.name.split(':');

    switch (type) {
      // based on https://developers.cloudflare.com/ruleset-engine/rules-language/
      case 'ip': {
        return `ip.src == ${value}`;
      }
      case 'header': {
        const headerValue = rest[0];
        const method = rest[1];
        const path = rest[2];
        let rule: string | null = null;

        // allows for multiple headers to be specified
        const headerNames = value.includes('|') ? value.split('|') : [value];

        const headerRules: string[] = [];
        for (const headerName of headerNames) {
          // if header value is 'empty', block all requests without the header
          if (headerValue === 'empty' || headerValue === 'undefined') {
            headerRules.push(
              `not any(lower(http.request.headers.names[*])[*] contains "${headerName}")`,
            );
          } else {
            // if header value not 'empty', block all requests with the header of the given value
            headerRules.push(
              `any(http.request.headers["${headerName}"][*] contains "${headerValue}")`,
            );
          }
        }

        rule = headerRules.join(' and ');

        if (method) {
          // if method is specified, block all requests with the given method
          rule = `${rule} and http.request.method == "${method}"`;
        }

        if (path) {
          // if path is specified, block all requests with the given path
          rule = `${rule} and http.request.uri.path == "${path}"`;
        }

        return rule;
      }
      default: {
        return null;
      }
    }
  });

  if (rulesArr.length === 0) {
    console.warn(`No rules in expression, nothing to enforce yet.`);

    return;
  }

  let rulesExpression = rulesArr
    .filter(Boolean)
    .map(v => `(${v})`)
    .join(' or ');

  rulesExpression = `http.host in { ${HOSTNAMES.split(',')
    .map(v => `"${v}"`)
    .join(' ')} } and ${rulesExpression}`;

  console.log(`Calculated WAF Expression:`, rulesExpression);

  const firewallRules = await execute(`/firewall/rules`);
  let rule = firewallRules.result.find((v: any) => v.ref === WAF_RULE_NAME);

  console.log('found rule:', rule);

  if (!rule) {
    const response = await execute(`/firewall/rules`, {
      method: 'POST',
      body: JSON.stringify([
        {
          ref: WAF_RULE_NAME,
          action: 'block',
          description: WAF_RULE_NAME,
          filter: {
            paused: true,
            expression: rulesExpression,
            ref: `${WAF_RULE_NAME}-filter`,
          },
        },
      ]),
    });

    console.log(`Create response: `, response);
    rule = response.result[0];
  }

  if (!rule) {
    console.warn(`rule is empty`);

    return;
  }

  const updateResponse = await execute(`/filters`, {
    method: 'PUT',
    body: JSON.stringify([
      {
        id: rule.filter.id,
        ref: rule.filter.ref,
        paused: false,
        expression: rulesExpression,
      },
    ]),
  });
  console.log(`Update response: `, updateResponse.result);
}
