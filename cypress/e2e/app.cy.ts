const user = { email: '<RANDOMISED BEFORE EACH TEST>', password: 'Loc@l.h0st' };

Cypress.on('uncaught:exception', (_err, _runnable) => {
  return false;
});

before(() => {
  user.email = `${crypto.randomUUID()}@local.host`;
});

it('should be visitable', () => {
  cy.visit('/');
});

it('should redirect anon to auth', () => {
  cy.visit('/');
  cy.url().should('include', '/auth?redirectToPath=%2F');
});

it('should sign up', () => {
  cy.signup(user);
});

it('should log in', () => {
  cy.login(user);
});

it('should log in and log out', () => {
  cy.login(user);
  cy.get('header').find('button[aria-haspopup="menu"]').click();
  cy.get('a[href="/logout"]').click();
});
