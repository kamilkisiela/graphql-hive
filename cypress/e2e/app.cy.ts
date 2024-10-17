function randomSlug() {
  return Math.random().toString(36).substring(2);
}

const getUser = () =>
  ({
    email: `${crypto.randomUUID()}@local.host`,
    password: 'Loc@l.h0st',
    firstName: 'Local',
    lastName: 'Host',
  }) as const;

Cypress.on('uncaught:exception', (_err, _runnable) => {
  return false;
});

describe('basic user flow', () => {
  const user = getUser();

  it('should be visitable', () => {
    cy.visit('/');
  });

  it('should redirect anon to auth', () => {
    cy.visit('/');
    cy.url().should('include', '/auth/sign-in?redirectToPath=');
  });

  it('should sign up', () => {
    cy.signup(user);
  });

  it('should log in', () => {
    cy.login(user);
  });

  it('should log in and log out', () => {
    cy.login(user);

    const slug = randomSlug();
    cy.get('input[name="slug"]').type(slug);
    cy.get('button[type="submit"]').click();

    // Logout
    cy.get('[data-cy="user-menu-trigger"]').click();
    cy.get('[data-cy="user-menu-logout"]').click();
    cy.url().should('include', '/auth/sign-in?redirectToPath=');
  });
});

it('create organization', () => {
  const slug = randomSlug();
  const user = getUser();
  cy.visit('/');
  cy.signup(user);
  cy.get('input[name="slug"]').type(slug);
  cy.get('button[type="submit"]').click();
  cy.get('[data-cy="organization-picker-current"]').contains(slug);
});

describe('oidc', () => {
  it('oidc login for organization', () => {
    const organizationAdminUser = getUser();
    cy.visit('/');
    cy.signup(organizationAdminUser);

    const slug = randomSlug();
    cy.createOIDCIntegration(slug).then(({ loginUrl }) => {
      cy.visit('/logout');

      cy.clearAllCookies();
      cy.clearAllLocalStorage();
      cy.clearAllSessionStorage();
      cy.visit(loginUrl);

      cy.get('input[id="Input_Username"]').type('test-user');
      cy.get('input[id="Input_Password"]').type('password');
      cy.get('button[value="login"]').click();

      cy.get('[data-cy="organization-picker-current"]').contains(slug);
    });
  });

  it('oidc login with organization slug', () => {
    const organizationAdminUser = getUser();
    cy.visit('/');
    cy.signup(organizationAdminUser);

    const slug = randomSlug();
    cy.createOIDCIntegration(slug).then(({ organizationSlug }) => {
      cy.visit('/logout');

      cy.clearAllCookies();
      cy.clearAllLocalStorage();
      cy.clearAllSessionStorage();
      cy.get('a[href^="/auth/sso"]').click();

      // Select organization
      cy.get('input[name="slug"]').type(organizationSlug);
      cy.get('button[type="submit"]').click();

      cy.get('input[id="Input_Username"]').type('test-user');
      cy.get('input[id="Input_Password"]').type('password');
      cy.get('button[value="login"]').click();

      cy.get('[data-cy="organization-picker-current"]').contains(slug);
    });
  });

  it('first time oidc login of non-admin user', () => {
    const organizationAdminUser = getUser();
    cy.visit('/');
    cy.signup(organizationAdminUser);

    const slug = randomSlug();
    cy.createOIDCIntegration(slug).then(({ organizationSlug }) => {
      cy.visit('/logout');

      cy.clearAllCookies();
      cy.clearAllLocalStorage();
      cy.clearAllSessionStorage();
      cy.get('a[href^="/auth/sso"]').click();

      // Select organization
      cy.get('input[name="slug"]').type(organizationSlug);
      cy.get('button[type="submit"]').click();

      cy.get('input[id="Input_Username"]').type('test-user-2');
      cy.get('input[id="Input_Password"]').type('password');
      cy.get('button[value="login"]').click();

      cy.get('[data-cy="organization-picker-current"]').contains(slug);
    });
  });

  it('oidc login for invalid url shows correct error message', () => {
    cy.clearAllCookies();
    cy.clearAllLocalStorage();
    cy.clearAllSessionStorage();
    cy.visit('/auth/oidc?id=invalid');
    cy.get('[data-cy="auth-card-header-description"]').contains('Could not find OIDC integration.');
  });
});
