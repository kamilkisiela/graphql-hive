namespace Cypress {
  export interface Chainable {
    fillAuthFormAndSubmit(data: { email: string; password: string }): Chainable;
    signup(data: { email: string; password: string }): Chainable;
    login(data: { email: string; password: string }): Chainable;
    dataCy(name: string): Chainable<JQuery<HTMLElement>>;
  }
}

Cypress.Commands.add('fillAuthFormAndSubmit', user => {
  cy.get('form').within(() => {
    cy.get('input[name="email"]').type(user.email);
    cy.get('input[name="password"]').type(user.password, {
      force: true, // skip waiting for async email validation
    });
    cy.root().submit();
  });
});

Cypress.Commands.add('signup', user => {
  cy.visit('/');

  cy.get('a[data-auth-link="sign-up"]').contains('Sign Up').click();
  cy.fillAuthFormAndSubmit(user);

  cy.contains('Create Organization');
});

Cypress.Commands.add('login', user => {
  cy.visit('/');

  cy.fillAuthFormAndSubmit(user);

  cy.contains('Create Organization');
});

Cypress.Commands.add('dataCy', value => {
  return cy.get(`[data-cy="${value}"]`);
});
