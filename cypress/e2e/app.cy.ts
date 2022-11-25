const baseUrl = 'http://localhost:8080';

const user = { email: '<RANDOMISED BEFORE EACH TEST>', password: 'Loc@l.h0st' };
beforeEach(() => {
  user.email = `${crypto.randomUUID()}@local.host`;
});

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
    cy.get('input[name="password"]')
      .focus()
      .should('be.enabled') // wait for enabled after focusing (async email input)
      .type(user.password);
    cy.root().submit();
  });

  cy.contains('Create Project');
});
