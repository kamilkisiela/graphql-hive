namespace Cypress {
  export interface Chainable {
    fillSupertokensFormAndSubmit(data: { email: string; password: string }): Chainable;

    signup(data: { email: string; password: string }): Chainable;

    login(data: { email: string; password: string }): Chainable;

    loginAndSetCookie(data: { email: string; password: string }): Chainable;

    dataCy(name: string): Chainable<JQuery<HTMLElement>>;
  }
}

Cypress.Commands.add('fillSupertokensFormAndSubmit', user => {
  cy.get('form', { includeShadowDom: true }).within(() => {
    cy.get('input[name="email"]').type(user.email);
    cy.get('input[name="password"]').type(user.password, {
      force: true, // skip waiting for async email validation
    });
    cy.root().submit();
  });
});

Cypress.Commands.add('signup', user => {
  cy.visit('/');

  cy.get('span[data-supertokens="link"]', { includeShadowDom: true }).contains('Sign Up').click();
  cy.fillSupertokensFormAndSubmit(user);

  cy.contains('Create Organization');
});

Cypress.Commands.add('login', user => {
  cy.visit('/');

  cy.fillSupertokensFormAndSubmit(user);

  cy.contains('Create Organization');
});

Cypress.Commands.add('loginAndSetCookie', ({ email, password }) => {
  cy.request({
    method: 'POST',
    url: '/api/auth/signin',
    body: {
      formFields: [
        { id: 'email', value: email },
        { id: 'password', value: password },
      ],
    },
  }).then(response => {
    const { status, headers, body } = response;
    if (status !== 200) {
      throw new Error(`Create session failed. ${status}.\n${JSON.stringify(body)}`);
    }
    const frontToken = headers['front-token'] as string;
    const accessToken = headers['st-access-token'] as string;
    const timeJoined = String(body.user.timeJoined);

    cy.setCookie('sAccessToken', accessToken);
    cy.setCookie('sFrontToken', frontToken);
    cy.setCookie('st-last-access-token-update', timeJoined);
  });
});

Cypress.Commands.add('dataCy', value => {
  return cy.get(`[data-cy="${value}"]`);
});
