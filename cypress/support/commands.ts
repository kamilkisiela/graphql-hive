namespace Cypress {
  export interface Chainable {
    fillSupertokensFormAndSubmit(user: { email: string; password: string }): Chainable;
    signup(user: { email: string; password: string }): Chainable;
    login(user: { email: string; password: string }): Chainable;
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

  cy.contains('Create Project');
});

Cypress.Commands.add('login', user => {
  cy.visit('/');

  cy.fillSupertokensFormAndSubmit(user);

  cy.contains('Create Project');
});
