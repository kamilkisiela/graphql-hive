namespace Cypress {
  export interface Chainable {
    fillSignInFormAndSubmit(data: { email: string; password: string }): Chainable;
    fillSignUpFormAndSubmit(data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }): Chainable;
    signup(data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }): Chainable;
    login(data: { email: string; password: string }): Chainable;
    dataCy(name: string): Chainable<JQuery<HTMLElement>>;
    createOIDCIntegration(organizationSlug: string): Chainable<{
      loginUrl: string;
      organizationSlug: string;
    }>;
  }
}

Cypress.Commands.add('createOIDCIntegration', (organizationSlug: string) => {
  cy.get('input[name="slug"]').type(organizationSlug);
  cy.get('button[type="submit"]').click();
  cy.get('[data-cy="organization-picker-current"]').contains(organizationSlug);
  cy.get('a[href$="/view/settings"]').click();
  cy.get('a[href$="/view/settings#create-oidc-integration"]').click();
  cy.get('input[id="tokenEndpoint"]').type('http://oidc-server-mock:80/connect/token');
  cy.get('input[id="userinfoEndpoint"]').type('http://oidc-server-mock:80/connect/userinfo');
  cy.get('input[id="authorizationEndpoint"]').type('http://localhost:7043/connect/authorize');
  cy.get('input[id="clientId"]').type('implicit-mock-client');
  cy.get('input[id="clientSecret"]').type('client-credentials-mock-client-secret');

  cy.get('div[role="dialog"]').find('button[type="submit"]').last().click();

  cy.url().then(url => {
    return new URL(url).pathname.split('/')[0];
  });

  return cy
    .get('div[role="dialog"]')
    .find('input[id="sign-in-uri"]')
    .then(async $elem => {
      const url = $elem.val();

      if (!url) {
        throw new Error('Failed to resolve OIDC integration URL');
      }

      if (typeof url !== 'string') {
        throw new Error('OIDC integration URL is not a string');
      }

      return url;
    })
    .then(loginUrl => {
      return cy.url().then(url => {
        const organizationSlug = new URL(url).pathname.split('/')[1];

        if (!organizationSlug) {
          throw new Error('Failed to resolve organization slug from URL:' + url);
        }

        return {
          loginUrl,
          organizationSlug,
        };
      });
    });
});

Cypress.Commands.add('fillSignInFormAndSubmit', user => {
  cy.get('form').within(() => {
    cy.get('input[name="email"]').type(user.email);
    cy.get('input[name="password"]').type(user.password, {
      force: true, // skip waiting for async email validation
    });
    cy.root().submit();
  });
});

Cypress.Commands.add('fillSignUpFormAndSubmit', user => {
  cy.get('form').within(() => {
    cy.get('input[name="firstName"]').type(user.firstName);
    cy.get('input[name="lastName"]').type(user.lastName);
    cy.get('input[name="email"]').type(user.email);
    cy.get('input[name="password"]').type(user.password, {
      force: true, // skip waiting for async email validation
    });
    cy.root().submit();
  });
});

Cypress.Commands.add('signup', user => {
  cy.visit('/');

  cy.get('a[data-auth-link="sign-up"]').click();
  cy.fillSignUpFormAndSubmit(user);

  cy.contains('Create Organization');
});

Cypress.Commands.add('login', user => {
  cy.visit('/');

  cy.fillSignInFormAndSubmit(user);

  cy.contains('Create Organization');
});

Cypress.Commands.add('dataCy', value => {
  return cy.get(`[data-cy="${value}"]`);
});
