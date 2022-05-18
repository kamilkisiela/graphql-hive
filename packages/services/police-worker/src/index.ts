const CF_BASE_URL = 'https://api.cloudflare.com/client/v4';

addEventListener('scheduled', (event) => {
  event.waitUntil(handleSchedule());
});

async function execute(
  url: string,
  options: Request | RequestInit = {}
): Promise<any> {
  const config = {
    headers: {
      Authorization: `Bearer ${CF_BEARER_TOKEN}`,
      'Content-type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  };

  return await fetch(
    `${CF_BASE_URL}/zones/${ZONE_IDENTIFIER}${url}`,
    config
  ).then((r) => r.json());
}

async function handleSchedule() {
  const data = await HIVE_POLICE.list();
  const rulesArr = data.keys.map((key) => {
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

        if (headerValue === 'empty' || headerValue === 'undefined') {
          rule = `not any(lower(http.request.headers.names[*])[*] contains "${value}")`;
        } else {
          rule = `any(http.request.headers["${value}"][*] contains "${headerValue}")`;
        }

        if (method) {
          rule = `${rule} and http.request.method == "${method}"`;
        }

        if (path) {
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
    .map((v) => `(${v})`)
    .join(' or ');

  rulesExpression = `http.host in { ${HOSTNAMES.split(',')
    .map((v) => `"${v}"`)
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
