const baseUrl = 'http://localhost:8080';
const user = { email: 'john@doe.coma', password: 'JohnatanD0e' };

it('should be visitable', () => {
  cy.visit(baseUrl);
});

it('should redirect anon to auth', () => {
  cy.visit(baseUrl);
  cy.url().should('eq', baseUrl + '/auth?redirectToPath=%2F');
});

it.only('should allow signups', () => {
  cy.visit(baseUrl);

  cy.get('span[data-supertokens="link"]', { includeShadowDom: true }).contains('Sign Up').click();

  cy.get('form', { includeShadowDom: true }).within(() => {
    cy.get('input[name="email"]').type(user.email);
    cy.get('input[name="password"]').type(user.password);
    cy.root().submit();
  });

  cy.get('button').contains('Create Project').should('be.visible');
});
