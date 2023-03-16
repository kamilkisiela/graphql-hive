namespace Cypress {
  export interface Chainable {
    fillSupertokensFormAndSubmit(data: { email: string; password: string }): Chainable;

    signup(data: { email: string; password: string }): Chainable;

    login(data: { email: string; password: string }): Chainable;

    loginAndSetCookie(data: { email: string; password: string }): Chainable;
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
    url: 'http://localhost:3000/api/auth/signin',
    body: {
      formFields: [
        { id: 'email', value: email },
        { id: 'password', value: password },
      ],
    },
  }).then(response => {
    if (response.status !== 200) {
      throw new Error(`Create session failed. ${response.status}.\n${response.body}`);
    }
    const frontToken = response.headers['front-token'] as string;
    const accessToken = response.headers['st-access-token'] as string;
    const timeJoined = String(response.body.user.timeJoined);

    cy.setCookie('sAccessToken', accessToken);
    cy.setCookie('sFrontToken', frontToken);
    cy.setCookie('st-last-access-token-update', timeJoined);
  });
});
