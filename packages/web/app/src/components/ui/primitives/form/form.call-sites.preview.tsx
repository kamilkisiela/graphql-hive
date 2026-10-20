import { useState, type ReactNode } from 'react';
import { createPreview, type NavPath } from 'react-foundry';
import { useForm } from 'react-hook-form';
import {
  NewPasswordForm,
  NewPasswordFormSchema,
  ResetPasswordEmailForm,
  ResetPasswordFormSchema,
  type NewPasswordFormValues,
  type ResetPasswordFormValues,
} from '@/components/auth/reset-password-forms';
import {
  SignInForm,
  SignInFormSchema,
  type SignInFormValues,
} from '@/components/auth/sign-in-form';
import {
  SignUpForm,
  SignUpFormSchema,
  type SignUpFormValues,
} from '@/components/auth/sign-up-form';
import { SSOForm, SSOFormSchema, type SSOFormValues } from '@/components/auth/sso-form';
import { SlugForm, slugFormSchema, type SlugFormValues } from '@/components/common/slug-form';
import { CallSite, InventoryList } from '@/components/inventory/shared';
import {
  CreateOrganizationForm,
  CreateOrganizationFormSchema,
  type CreateOrganizationFormValues,
} from '@/components/organization/create-organization-form';
import {
  MemberInvitationForm,
  MemberInvitationFormSchema,
  type InvitableRole,
  type MemberInvitationFormValues,
} from '@/components/organization/members/invitation-form';
import {
  RoleFields,
  RoleForm,
  RoleFormSchema,
  type RoleFormValues,
} from '@/components/organization/members/role-form';
import {
  AccessTokenFormSchema,
  AccessTokenGeneralStep,
  AccessTokenPermissionsStep,
  type AccessTokenFormValues,
} from '@/components/organization/settings/access-tokens/access-token-form';
import {
  AuditLogsForm,
  AuditLogsFormSchema,
  type AuditLogsFormValues,
} from '@/components/organization/settings/audit-logs-form';
import {
  ConnectProviderForm,
  ConnectProviderFormSchema,
  OIDCMetadataUrlForm,
  OIDCMetadataUrlFormSchema,
  type ConnectProviderFormValues,
  type OIDCMetadataUrlFormValues,
} from '@/components/organization/settings/single-sign-on/connect-provider-form';
import {
  RegisterDomainForm,
  RegisterDomainFormSchema,
  type RegisterDomainFormValues,
} from '@/components/organization/settings/single-sign-on/register-domain-form';
import {
  TransferOwnershipForm,
  transferOwnershipFormSchema,
  type TransferableMember,
  type TransferOwnershipFormValues,
} from '@/components/organization/settings/transfer-ownership-form';
import {
  AlertForm,
  alertFormSchema,
  type AlertFormValues,
} from '@/components/project/alerts/alert-form';
import {
  ChannelForm,
  ChannelFormSchema,
  type ChannelFormValues,
} from '@/components/project/alerts/channel-form';
import {
  CreateProjectForm,
  CreateProjectFormSchema,
  type CreateProjectFormValues,
} from '@/components/project/create-project-form';
import {
  ExternalCompositionForm,
  ExternalCompositionFormSchema,
  type ExternalCompositionFormValues,
} from '@/components/project/settings/external-composition-form';
import {
  CreateTargetForm,
  CreateTargetFormSchema,
  type CreateTargetFormValues,
} from '@/components/target/create-target-form';
import {
  CollectionForm,
  CollectionFormSchema,
  type CollectionFormValues,
} from '@/components/target/laboratory/collection-form';
import {
  OperationForm,
  OperationFormSchema,
  type OperationFormValues,
} from '@/components/target/laboratory/operation-form';
import {
  AppDeploymentProtectionForm,
  AppDeploymentProtectionFormSchema,
  type AppDeploymentProtectionFormValues,
} from '@/components/target/settings/app-deployment-protection-form';
import {
  BreakingChangesForm,
  breakingChangesFormSchema,
  type BreakingChangesFormValues,
} from '@/components/target/settings/breaking-changes-form';
import {
  CdnTokenForm,
  CdnTokenFormSchema,
  type CdnTokenFormValues,
} from '@/components/target/settings/cdn-token-form';
import {
  ContractForm,
  ContractFormSchema,
  type ContractFormValues,
} from '@/components/target/settings/contract-form';
import {
  DangerousChangesForm,
  DangerousChangesFormSchema,
  SavedLabel,
  type DangerousChangesFormValues,
} from '@/components/target/settings/dangerous-changes-form';
import {
  GraphqlEndpointForm,
  GraphqlEndpointFormSchema,
  type GraphqlEndpointFormValues,
} from '@/components/target/settings/graphql-endpoint-form';
import {
  RegistryTokenForm,
  RegistryTokenFormSchema,
  type RegistryTokenFormValues,
} from '@/components/target/settings/registry-token-form';
import { Button } from '@/components/ui/primitives/button/button';
import { Card } from '@/components/ui/primitives/card/card';
import { Form } from '@/components/ui/primitives/form/form';
import {
  UserSettingsForm,
  UserSettingsFormSchema,
  type UserSettingsFormValues,
} from '@/components/user/user-settings-form';
import {
  AlertChannelType,
  AlertType,
  AppDeploymentProtectionRuleLogicType,
  BreakingChangeFormulaType,
  ProjectType,
  TokenExpirationPeriod,
} from '@/gql/graphql';
import type { DocumentCollectionOperation } from '@/lib/hooks/laboratory/use-collections';
import { zodResolver } from '@hookform/resolvers/zod';

export const nav: NavPath = 'Primitives/FormControls/Form/Component Examples';

/**
 * Every form of the app on base Form, mounted from its own file with the `useForm` its page
 * builds. The pages own the queries and mutations, so a slot the page fills with a component that
 * runs its own query (the permission, resource and exclusion pickers, the composition status)
 * gets a stand-in here. What a submit hands over is printed under each form.
 *
 * Two forms are not mounted: the metric alert form and the schema policy form run their own
 * queries. The support forms have a preview of their own under Components.
 */

const ENTRIES = [
  { source: 'components/auth/sign-in-form.tsx', what: 'Sign in', coveredBy: 'Auth' },
  { source: 'components/auth/sign-up-form.tsx', what: 'Sign up', coveredBy: 'Auth' },
  {
    source: 'components/auth/reset-password-forms.tsx',
    what: 'Reset password: the email step and the new password step',
    coveredBy: 'Auth',
  },
  { source: 'components/auth/sso-form.tsx', what: 'SSO sign in', coveredBy: 'Auth' },
  {
    source: 'components/organization/create-organization-form.tsx',
    what: 'New organization, on a card',
    coveredBy: 'Create',
  },
  {
    source: 'components/project/create-project-form.tsx',
    what: 'New project, in a dialog: slug and project type',
    coveredBy: 'Create',
  },
  {
    source: 'components/target/create-target-form.tsx',
    what: 'New target, in a dialog',
    coveredBy: 'Create',
  },
  {
    source: 'components/target/laboratory/collection-form.tsx',
    what: 'New or edited collection, in a dialog',
    coveredBy: 'Create',
  },
  {
    source: 'components/target/laboratory/operation-form.tsx',
    what: 'New or edited operation, in a dialog; creating also picks the collection',
    coveredBy: 'Create',
  },
  {
    source: 'components/common/slug-form.tsx',
    what: 'The organization, project and target slug settings',
    coveredBy: 'Slugs',
  },
  {
    source: 'components/organization/settings/audit-logs-form.tsx',
    what: 'Audit log export: a date range',
    coveredBy: 'Organization settings',
  },
  {
    source: 'components/user/user-settings-form.tsx',
    what: 'Profile, in a dialog',
    coveredBy: 'Organization settings',
  },
  {
    source: 'components/organization/settings/transfer-ownership-form.tsx',
    what: 'Transfer ownership, in a dialog: a member and a typed confirmation',
    coveredBy: 'Organization settings',
  },
  {
    source: 'components/organization/members/invitation-form.tsx',
    what: 'Invite a member, in a dialog: email, role, then the resource picker',
    coveredBy: 'Members',
  },
  {
    source: 'components/organization/members/role-form.tsx',
    what: 'Create and edit a role, in a dialog: fields beside the permission picker',
    coveredBy: 'Members',
  },
  {
    source: 'components/organization/settings/access-tokens/access-token-form.tsx',
    what: 'The three access token sheets: a general step and a permissions step',
    coveredBy: 'Access tokens',
  },
  {
    source: 'components/organization/settings/single-sign-on/connect-provider-form.tsx',
    what: 'OIDC provider, in a sheet: the metadata URL form and the provider form',
    coveredBy: 'Single sign-on',
  },
  {
    source: 'components/organization/settings/single-sign-on/register-domain-form.tsx',
    what: 'OIDC domain, in a sheet',
    coveredBy: 'Single sign-on',
  },
  {
    source: 'components/project/settings/external-composition-form.tsx',
    what: 'External composition: endpoint and secret, the status beside the endpoint',
    coveredBy: 'Project settings',
  },
  {
    source: 'components/project/alerts/channel-form.tsx',
    what: 'New alert channel, in a dialog: the fields follow the channel type',
    coveredBy: 'Project settings',
  },
  {
    source: 'components/project/alerts/alert-form.tsx',
    what: 'New alert rule, in a dialog: three selects',
    coveredBy: 'Project settings',
  },
  {
    source: 'components/target/settings/graphql-endpoint-form.tsx',
    what: 'GraphQL endpoint URL: one field beside its Save',
    coveredBy: 'Target settings',
  },
  {
    source: 'components/target/settings/dangerous-changes-form.tsx',
    what: 'Dangerous change types: a checklist with pending marks',
    coveredBy: 'Target settings',
  },
  {
    source: 'components/target/settings/app-deployment-protection-form.tsx',
    what: 'App deployment protection: numbers inside sentences',
    coveredBy: 'Target settings',
  },
  {
    source: 'components/target/settings/breaking-changes-form.tsx',
    what: 'Conditional breaking changes: radio cards, exclusions, a target checklist',
    coveredBy: 'Target settings',
  },
  {
    source: 'components/target/settings/contract-form.tsx',
    what: 'New schema contract, in a dialog: tag fields with suggestions',
    coveredBy: 'Target tokens and contracts',
  },
  {
    source: 'components/target/settings/cdn-token-form.tsx',
    what: 'New CDN token, in a dialog',
    coveredBy: 'Target tokens and contracts',
  },
  {
    source: 'components/target/settings/registry-token-form.tsx',
    what: 'New registry token, in a dialog: a description and the scope picker',
    coveredBy: 'Target tokens and contracts',
  },
  {
    source: 'components/organization/new-ticket-form.tsx, reply-ticket-form.tsx',
    what: 'Support ticket and reply',
    coveredBy: 'Components/SupportForms',
  },
  {
    source: 'components/target/alerts/alert-form.tsx',
    what: 'Metric alert rule; runs its own queries, so not mounted',
  },
  {
    source: 'components/policy/policy-settings.tsx',
    what: 'Schema policy; runs its own query, so not mounted',
  },
].map(entry => ({ origin: 'base' as const, ...entry }));

export const Inventory = createPreview({
  label: 'Inventory',
  render: () => (
    <InventoryList
      component="base/form"
      summary={
        <>
          Every form is a presentational component taking <code>form</code> and{' '}
          <code>onSubmit</code>, with its zod schema and values type exported beside it, and a spec
          of its own. The page keeps the query, the mutation and the toasts. Labels are text-only;
          helper text sits in the label's tooltip.
        </>
      }
      entries={ENTRIES}
    />
  ),
});

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

function Submitted(props: { values: unknown }) {
  return props.values ? (
    <pre className="mt-4 text-xs text-fg-default">{JSON.stringify(props.values, null, 2)}</pre>
  ) : null;
}

/** A slot the page fills with a component that runs its own query. */
function QueryBacked(props: { name: string }) {
  return (
    <div className="rounded-sm border border-dashed border-line-strong p-3 text-xs text-fg-secondary">
      {props.name} runs its own query, so the page supplies it.
    </div>
  );
}

/** The overlay widths, so a form is seen at the width it ships at. */
const panelWidth = {
  card: 'w-[28rem]',
  dialog: 'w-[520px]',
  'dialog-lg': 'w-[640px]',
  'dialog-xl': 'w-[960px]',
  sheet: 'w-[700px]',
} as const;

/** The raised panel a dialog, sheet or card puts the form on, at that overlay's width. */
function Raised(props: { children: ReactNode; width: keyof typeof panelWidth }) {
  if (props.width === 'card') {
    return (
      <div className={panelWidth.card}>
        <Card variants={{ onSurface: 'raised' }}>{props.children}</Card>
      </div>
    );
  }
  return (
    <div
      className={`rounded-md border border-line bg-surface-overlay p-6 ${panelWidth[props.width]}`}
    >
      {props.children}
    </div>
  );
}

const Submit = (label: string) => (
  <Button type="submit" width="full" onSurface="raised">
    {label}
  </Button>
);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function SignInExample() {
  const [submitted, setSubmitted] = useState<SignInFormValues | null>(null);
  const form = useForm<SignInFormValues>({
    mode: 'onSubmit',
    resolver: zodResolver(SignInFormSchema),
    defaultValues: { email: '', password: '' },
  });
  return (
    <CallSite
      source="pages/auth-sign-in.tsx"
      origin="base"
      note="On the raised auth card. The reset link sits beside the password label; the submit is a slot so the page can wrap it with its last-used marker."
    >
      <Raised width="card">
        <SignInForm
          form={form}
          onSubmit={setSubmitted}
          submit={Submit('Sign in')}
          forgotPasswordLink={() => (
            <a href="#" tabIndex={-1} className="ml-auto inline-block text-sm underline">
              Forgot your password?
            </a>
          )}
        />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

function SignUpExample() {
  const [submitted, setSubmitted] = useState<SignUpFormValues | null>(null);
  const form = useForm<SignUpFormValues>({
    mode: 'onSubmit',
    resolver: zodResolver(SignUpFormSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });
  return (
    <CallSite source="pages/auth-sign-up.tsx" origin="base">
      <Raised width="card">
        <SignUpForm form={form} onSubmit={setSubmitted} submit={Submit('Create an account')} />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

function ResetPasswordExample() {
  const [email, setEmail] = useState<ResetPasswordFormValues | null>(null);
  const [password, setPassword] = useState<NewPasswordFormValues | null>(null);
  const emailForm = useForm<ResetPasswordFormValues>({
    mode: 'onSubmit',
    resolver: zodResolver(ResetPasswordFormSchema),
    defaultValues: { email: '' },
  });
  const passwordForm = useForm<NewPasswordFormValues>({
    mode: 'onSubmit',
    resolver: zodResolver(NewPasswordFormSchema),
    defaultValues: { newPassword: '' },
  });
  return (
    <CallSite
      source="pages/auth-reset-password.tsx"
      origin="base"
      note="Two steps on the same page: the email that gets the link, then the new password once the link is followed."
    >
      <div className="flex flex-wrap gap-8">
        <Raised width="card">
          <ResetPasswordEmailForm
            form={emailForm}
            onSubmit={setEmail}
            submit={Submit('Email me')}
          />
          <Submitted values={email} />
        </Raised>
        <Raised width="card">
          <NewPasswordForm
            form={passwordForm}
            onSubmit={setPassword}
            submit={Submit('Change password')}
          />
          <Submitted values={password} />
        </Raised>
      </div>
    </CallSite>
  );
}

function SSOExample() {
  const [submitted, setSubmitted] = useState<SSOFormValues | null>(null);
  const form = useForm<SSOFormValues>({
    mode: 'onSubmit',
    resolver: zodResolver(SSOFormSchema),
    defaultValues: { slug: '' },
  });
  return (
    <CallSite
      source="pages/auth-sso.tsx"
      origin="base"
      note="The label carries the explanation of the slug in its tooltip."
    >
      <Raised width="card">
        <SSOForm form={form} onSubmit={setSubmitted} submit={Submit('Sign in')} />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

export const Auth = createPreview({
  label: 'Auth',
  render: () => (
    <div className="flex flex-col gap-8">
      <SignInExample />
      <SignUpExample />
      <ResetPasswordExample />
      <SSOExample />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

function CreateOrganizationExample() {
  const [submitted, setSubmitted] = useState<CreateOrganizationFormValues | null>(null);
  const form = useForm<CreateOrganizationFormValues>({
    mode: 'onChange',
    resolver: zodResolver(CreateOrganizationFormSchema),
    defaultValues: { slug: '' },
  });
  return (
    <CallSite
      source="pages/organization-new.tsx"
      origin="base"
      note="Centered on the page, on a card of its own; the form brings its container."
    >
      <div className="w-[56rem]">
        <CreateOrganizationForm form={form} onSubmit={setSubmitted} />
        <Submitted values={submitted} />
      </div>
    </CallSite>
  );
}

function CreateProjectExample() {
  const [submitted, setSubmitted] = useState<CreateProjectFormValues | null>(null);
  const form = useForm<CreateProjectFormValues>({
    mode: 'onChange',
    resolver: zodResolver(CreateProjectFormSchema),
    defaultValues: { projectSlug: '', projectType: ProjectType.Single },
  });
  return (
    <CallSite
      source="components/layouts/organization.tsx"
      origin="base"
      note="In a dialog. The project type is a radio group inside a group item, so its label is the legend."
    >
      <Raised width="dialog-lg">
        <CreateProjectForm form={form} onSubmit={setSubmitted} />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

function CreateTargetExample() {
  const [submitted, setSubmitted] = useState<CreateTargetFormValues | null>(null);
  const form = useForm<CreateTargetFormValues>({
    mode: 'onChange',
    resolver: zodResolver(CreateTargetFormSchema),
    defaultValues: { targetSlug: '' },
  });
  return (
    <CallSite source="components/layouts/project.tsx" origin="base" note="In a dialog.">
      <Raised width="dialog">
        <CreateTargetForm form={form} onSubmit={setSubmitted} />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

function CollectionExample() {
  const [submitted, setSubmitted] = useState<CollectionFormValues | null>(null);
  const form = useForm<CollectionFormValues>({
    mode: 'onChange',
    resolver: zodResolver(CollectionFormSchema),
    defaultValues: { name: '', description: '' },
  });
  return (
    <CallSite
      source="components/target/laboratory/create-collection-modal.tsx"
      origin="base"
      note="In a dialog, submitted from the footer by the form's id."
    >
      <Raised width="dialog-lg">
        <CollectionForm form={form} onSubmit={setSubmitted} />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

const COLLECTIONS = [
  { id: 'c1', name: 'Checkout' },
  { id: 'c2', name: 'Smoke tests' },
] as unknown as DocumentCollectionOperation[];

function OperationExample() {
  const [submitted, setSubmitted] = useState<OperationFormValues | null>(null);
  const form = useForm<OperationFormValues>({
    mode: 'onChange',
    resolver: zodResolver(OperationFormSchema),
    defaultValues: { name: '', collectionId: '' },
  });
  return (
    <CallSite
      source="components/target/laboratory/create-operation-modal.tsx, edit-operation-modal.tsx"
      origin="base"
      note="In a dialog. Creating picks the collection too; editing passes no collections and only renames."
    >
      <Raised width="dialog-lg">
        <OperationForm
          form={form}
          onSubmit={setSubmitted}
          id="preview-operation-form"
          collections={COLLECTIONS}
        />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

export const Create = createPreview({
  label: 'Create',
  render: () => (
    <div className="flex flex-col gap-8">
      <CreateOrganizationExample />
      <CreateProjectExample />
      <CreateTargetExample />
      <CollectionExample />
      <OperationExample />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

function SlugExample(props: {
  noun: 'Organization' | 'Project' | 'Target';
  slug: string;
  prefixText: string;
  source: string;
}) {
  const [submitted, setSubmitted] = useState<SlugFormValues | null>(null);
  const form = useForm<SlugFormValues>({
    mode: 'all',
    resolver: zodResolver(slugFormSchema(props.noun)),
    defaultValues: { slug: props.slug },
  });
  return (
    <CallSite source={props.source} origin="base">
      <div className="w-[36rem]">
        <SlugForm form={form} onSubmit={setSubmitted} prefixText={props.prefixText} />
        <Submitted values={submitted} />
      </div>
    </CallSite>
  );
}

export const Slugs = createPreview({
  label: 'Slugs',
  render: () => (
    <div className="flex flex-col gap-8">
      <SlugExample
        noun="Organization"
        slug="the-guild"
        prefixText="app.graphql-hive.com/"
        source="pages/organization-settings.tsx"
      />
      <SlugExample
        noun="Project"
        slug="shop"
        prefixText="app.graphql-hive.com/the-guild/"
        source="pages/project-settings.tsx"
      />
      <SlugExample
        noun="Target"
        slug="production"
        prefixText="app.graphql-hive.com/the-guild/shop/"
        source="pages/target-settings.tsx"
      />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Organization settings
// ---------------------------------------------------------------------------

function AuditLogsExample() {
  const [submitted, setSubmitted] = useState<AuditLogsFormValues | null>(null);
  const today = new Date().toISOString().split('T')[0];
  const lastYear = new Date(new Date().setFullYear(new Date().getFullYear() - 1))
    .toISOString()
    .split('T')[0];
  const form = useForm<AuditLogsFormValues>({
    mode: 'onSubmit',
    resolver: zodResolver(AuditLogsFormSchema),
    defaultValues: { startDate: lastYear, endDate: today },
  });
  return (
    <CallSite source="pages/organization-settings.tsx" origin="base">
      <div className="w-[36rem]">
        <AuditLogsForm form={form} onSubmit={setSubmitted} />
        <Submitted values={submitted} />
      </div>
    </CallSite>
  );
}

function UserSettingsExample() {
  const [submitted, setSubmitted] = useState<UserSettingsFormValues | null>(null);
  const form = useForm<UserSettingsFormValues>({
    resolver: zodResolver(UserSettingsFormSchema),
    defaultValues: { fullName: 'Ada Lovelace', displayName: 'ada' },
  });
  return (
    <CallSite
      source="components/user/settings.tsx"
      origin="base"
      note="In a dialog. The page hands the form `values` so the fields fill in once the profile arrives."
    >
      <Raised width="dialog">
        <UserSettingsForm form={form} onSubmit={setSubmitted} />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

const MEMBERS: TransferableMember[] = [
  { id: 'u1', fullName: 'Ada Lovelace', displayName: 'ada', email: 'ada@the-guild.dev' },
  { id: 'u2', fullName: 'Grace Hopper', displayName: 'grace', email: 'grace@the-guild.dev' },
];

function TransferOwnershipExample() {
  const [submitted, setSubmitted] = useState<TransferOwnershipFormValues | null>(null);
  const form = useForm<TransferOwnershipFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(transferOwnershipFormSchema('the-guild')),
    defaultValues: { newOwner: '', confirmation: '' },
  });
  return (
    <CallSite
      source="components/organization/settings/transfer-ownership-dialog.tsx"
      origin="base"
      note="In a dialog. The confirmation must match the organization slug, which the label's tooltip names."
    >
      <Raised width="dialog-xl">
        <TransferOwnershipForm form={form} onSubmit={setSubmitted} members={MEMBERS} />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

export const OrganizationSettings = createPreview({
  label: 'Organization settings',
  render: () => (
    <div className="flex flex-col gap-8">
      <AuditLogsExample />
      <UserSettingsExample />
      <TransferOwnershipExample />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

const ROLES: InvitableRole[] = [
  {
    id: 'r-admin',
    name: 'Admin',
    description: 'Full access to the organization',
    isLocked: true,
    canInvite: true,
  },
  {
    id: 'r-viewer',
    name: 'Viewer',
    description: 'Read-only access',
    isLocked: true,
    canInvite: true,
  },
];

function InvitationExample() {
  const [submitted, setSubmitted] = useState<MemberInvitationFormValues | null>(null);
  const form = useForm<MemberInvitationFormValues>({
    resolver: zodResolver(MemberInvitationFormSchema),
    mode: 'onChange',
    defaultValues: { email: '', role: 'r-viewer' },
  });
  return (
    <CallSite
      source="components/organization/members/invitations.tsx"
      origin="base"
      note="In a dialog. The role selector sits outside FormControl, since it is not one input."
    >
      <Raised width="dialog-xl">
        <MemberInvitationForm
          form={form}
          onSubmit={setSubmitted}
          roles={ROLES}
          defaultRole={ROLES[1]}
          resources={<QueryBacked name="ResourceSelector" />}
        />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

function RoleExample() {
  const [submitted, setSubmitted] = useState<RoleFormValues | null>(null);
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(RoleFormSchema),
    mode: 'onChange',
    defaultValues: { name: '', description: '', selectedPermissions: [] },
  });
  return (
    <CallSite
      source="components/organization/members/roles.tsx"
      origin="base"
      note="In a dialog, creating and editing alike. The fields sit beside the permission picker, which scrolls in a fixed height. The creator walks two steps, so its buttons stay plain and submit by hand."
    >
      <Raised width="dialog-xl">
        <RoleForm
          form={form}
          onSubmit={setSubmitted}
          footer={
            <>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
              <Button type="submit" onSurface="raised">
                Confirm selection
              </Button>
            </>
          }
        >
          <RoleFields form={form} permissions={<QueryBacked name="PermissionSelector" />} />
        </RoleForm>
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

export const Members = createPreview({
  label: 'Members',
  render: () => (
    <div className="flex flex-col gap-8">
      <InvitationExample />
      <RoleExample />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Access tokens
// ---------------------------------------------------------------------------

function AccessTokenExample() {
  const form = useForm<AccessTokenFormValues>({
    mode: 'onChange',
    resolver: zodResolver(AccessTokenFormSchema),
    defaultValues: {
      title: '',
      description: '',
      permissions: [],
      expirationPeriod: TokenExpirationPeriod.Never,
    },
  });
  return (
    <CallSite
      source="create-access-token-sheet-content.tsx, create-personal-access-token-sheet-content.tsx, create-project-access-token-sheet-content.tsx"
      origin="base"
      note="The three sheets share one form over a stepper; the sheet submits from its footer. Both steps at once here."
    >
      <Raised width="sheet">
        <Form form={form} onSubmit={() => {}}>
          <AccessTokenGeneralStep form={form} />
          <AccessTokenPermissionsStep form={form}>
            <QueryBacked name="PermissionSelector" />
          </AccessTokenPermissionsStep>
        </Form>
      </Raised>
    </CallSite>
  );
}

export const AccessTokens = createPreview({
  label: 'Access tokens',
  render: () => <AccessTokenExample />,
});

// ---------------------------------------------------------------------------
// Single sign-on
// ---------------------------------------------------------------------------

function MetadataUrlExample() {
  const [submitted, setSubmitted] = useState<OIDCMetadataUrlFormValues | null>(null);
  const form = useForm<OIDCMetadataUrlFormValues>({
    resolver: zodResolver(OIDCMetadataUrlFormSchema),
    defaultValues: { url: '' },
    mode: 'onSubmit',
  });
  return (
    <CallSite
      source="connect-single-sign-on-provider-sheet.tsx (metadata tab)"
      origin="base"
      note="Fetches the provider's document and fills the endpoints of the provider form."
    >
      <Raised width="sheet">
        <OIDCMetadataUrlForm form={form} onSubmit={setSubmitted} isPending={false} />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

function ConnectProviderExample(props: { editing: boolean }) {
  const [submitted, setSubmitted] = useState<ConnectProviderFormValues | null>(null);
  const form = useForm<ConnectProviderFormValues>({
    resolver: zodResolver(ConnectProviderFormSchema),
    defaultValues: props.editing
      ? {
          authorization_endpoint: 'https://login.example.com/oauth2/authorize',
          token_endpoint: 'https://login.example.com/oauth2/token',
          userinfo_endpoint: 'https://login.example.com/oauth2/userinfo',
          clientId: 'hive-console',
          clientSecret: '',
          userIdClaim: 'sub',
          additionalScopes: 'groups',
        }
      : {
          authorization_endpoint: '',
          token_endpoint: '',
          userinfo_endpoint: '',
          clientId: '',
          clientSecret: '',
          userIdClaim: '',
          additionalScopes: '',
        },
  });
  return (
    <CallSite
      source={`connect-single-sign-on-provider-sheet.tsx (${props.editing ? 'editing' : 'manual tab'})`}
      origin="base"
      note={
        props.editing
          ? 'Editing a stored provider: the endpoints are read-only and the secret field previews the stored tail so an empty field keeps it.'
          : 'The manual tab: the endpoints are typed in.'
      }
    >
      <Raised width="sheet">
        <ConnectProviderForm
          form={form}
          onSubmit={setSubmitted}
          endpointsEditable={!props.editing}
          clientSecretPreview={props.editing ? 'a91f' : null}
        />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

function RegisterDomainExample() {
  const [submitted, setSubmitted] = useState<RegisterDomainFormValues | null>(null);
  const form = useForm<RegisterDomainFormValues>({
    resolver: zodResolver(RegisterDomainFormSchema),
    defaultValues: { domainName: '' },
    mode: 'onSubmit',
  });
  return (
    <CallSite source="oidc-registered-domain-sheet.tsx" origin="base">
      <Raised width="sheet">
        <RegisterDomainForm form={form} onSubmit={setSubmitted} />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

export const SingleSignOn = createPreview({
  label: 'Single sign-on',
  render: () => (
    <div className="flex flex-col gap-8">
      <MetadataUrlExample />
      <ConnectProviderExample editing={false} />
      <ConnectProviderExample editing />
      <RegisterDomainExample />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Project settings
// ---------------------------------------------------------------------------

function ExternalCompositionExample() {
  const [submitted, setSubmitted] = useState<ExternalCompositionFormValues | null>(null);
  const form = useForm<ExternalCompositionFormValues>({
    resolver: zodResolver(ExternalCompositionFormSchema),
    mode: 'onChange',
    defaultValues: { endpoint: 'https://composition.example.com/compose', secret: '' },
  });
  return (
    <CallSite
      source="components/project/settings/external-composition.tsx"
      origin="base"
      note="The reachability check sits beside the endpoint until the fields are edited. The submit label follows the composition mode."
    >
      <div className="w-[36rem]">
        <ExternalCompositionForm
          form={form}
          onSubmit={setSubmitted}
          endpointStatus={<QueryBacked name="ExternalCompositionStatus" />}
          submitLabel="Save Configuration"
        />
        <Submitted values={submitted} />
      </div>
    </CallSite>
  );
}

function ChannelExample() {
  const [submitted, setSubmitted] = useState<ChannelFormValues | null>(null);
  const form = useForm<ChannelFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(ChannelFormSchema),
    defaultValues: {
      name: '',
      type: '' as AlertChannelType,
      slackChannel: '',
      endpoint: '',
    },
  });
  return (
    <CallSite
      source="components/project/alerts/create-channel.tsx"
      origin="base"
      note="In a dialog. Pick a type: Slack asks for a channel, the webhook kinds for an endpoint with a setup guide under it."
    >
      <Raised width="dialog">
        <ChannelForm form={form} onSubmit={setSubmitted} />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

const CHANNELS = [
  { id: 'ch-1', name: 'Slack #hives' },
  { id: 'ch-2', name: 'Deploy webhook' },
];
const TARGETS = [{ slug: 'production' }, { slug: 'staging' }];

function AlertExample() {
  const [submitted, setSubmitted] = useState<AlertFormValues | null>(null);
  const form = useForm<AlertFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(
      alertFormSchema({
        channelIds: CHANNELS.map(channel => channel.id),
        targetSlugs: TARGETS.map(target => target.slug),
      }),
    ),
    defaultValues: { type: AlertType.SchemaChangeNotifications, channel: '', target: '' },
  });
  return (
    <CallSite
      source="components/project/alerts/create-alert.tsx"
      origin="base"
      note="In a dialog. The schema is built from the channels and targets the page loaded."
    >
      <Raised width="dialog">
        <AlertForm form={form} onSubmit={setSubmitted} channels={CHANNELS} targets={TARGETS} />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

export const ProjectSettings = createPreview({
  label: 'Project settings',
  render: () => (
    <div className="flex flex-col gap-8">
      <ExternalCompositionExample />
      <ChannelExample />
      <AlertExample />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Target settings
// ---------------------------------------------------------------------------

function GraphqlEndpointExample() {
  const [submitted, setSubmitted] = useState<GraphqlEndpointFormValues | null>(null);
  const form = useForm<GraphqlEndpointFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(GraphqlEndpointFormSchema),
    defaultValues: { graphqlEndpointUrl: '' },
  });
  return (
    <CallSite source="pages/target-settings.tsx (GraphQLEndpointUrl)" origin="base">
      <div className="w-[36rem]">
        <GraphqlEndpointForm form={form} onSubmit={setSubmitted} />
        <Submitted values={submitted} />
      </div>
    </CallSite>
  );
}

function DangerousChangesExample() {
  const [submitted, setSubmitted] = useState<DangerousChangesFormValues | null>(null);
  const form = useForm<DangerousChangesFormValues>({
    resolver: zodResolver(DangerousChangesFormSchema),
    defaultValues: { failingChangeTypes: [], failAllDangerousChanges: false },
  });
  return (
    <CallSite
      source="pages/target-settings.tsx (DangerousChangeTypeForm)"
      origin="base"
      note="A changed row gets a pending dot until it is saved. The status beside the button is the page's own saved / just saved / unsaved label."
    >
      <div className="w-[36rem]">
        <DangerousChangesForm form={form} onSubmit={setSubmitted} enabled status={<SavedLabel />} />
        <Submitted values={submitted} />
      </div>
    </CallSite>
  );
}

function AppDeploymentProtectionExample() {
  const [submitted, setSubmitted] = useState<AppDeploymentProtectionFormValues | null>(null);
  const form = useForm<AppDeploymentProtectionFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(AppDeploymentProtectionFormSchema),
    defaultValues: {
      minDaysInactive: 30,
      minDaysSinceCreation: 3,
      maxTrafficPercentage: 1.0,
      trafficPeriodDays: 30,
      ruleLogic: AppDeploymentProtectionRuleLogicType.And,
    },
  });
  return (
    <CallSite
      source="pages/target-settings.tsx (AppDeploymentProtection)"
      origin="base"
      note="Numbers inside sentences, so their messages are listed under the rules instead of under each field."
    >
      <div className="w-[36rem]">
        <AppDeploymentProtectionForm form={form} onSubmit={setSubmitted} enabled />
        <Submitted values={submitted} />
      </div>
    </CallSite>
  );
}

const BREAKING_TARGETS = [
  { id: 't-1', slug: 'production' },
  { id: 't-2', slug: 'staging' },
];

function BreakingChangesExample() {
  const [submitted, setSubmitted] = useState<BreakingChangesFormValues | null>(null);
  const form = useForm<BreakingChangesFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(breakingChangesFormSchema(30)),
    defaultValues: {
      percentage: 0,
      requestCount: 1,
      period: 30,
      breakingChangeFormula: BreakingChangeFormulaType.Percentage,
      targetIds: ['t-1'],
      excludedClients: [],
      excludedAppDeployments: [],
    },
  });
  return (
    <CallSite
      source="pages/target-settings.tsx (BreakingChanges)"
      origin="base"
      note="The period is capped by the organization's retention, so the schema is built per page. The two exclusion pickers run their own queries."
    >
      <div className="w-[48rem]">
        <BreakingChangesForm
          form={form}
          onSubmit={setSubmitted}
          enabled
          maxPeriod={30}
          targets={BREAKING_TARGETS}
          clientExclusion={() => <QueryBacked name="ClientExclusion" />}
          appDeploymentExclusion={() => <QueryBacked name="AppDeploymentExclusion" />}
        />
        <Submitted values={submitted} />
      </div>
    </CallSite>
  );
}

export const TargetSettings = createPreview({
  label: 'Target settings',
  render: () => (
    <div className="flex flex-col gap-8">
      <GraphqlEndpointExample />
      <DangerousChangesExample />
      <AppDeploymentProtectionExample />
      <BreakingChangesExample />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Target tokens and contracts
// ---------------------------------------------------------------------------

function ContractExample() {
  const [submitted, setSubmitted] = useState<ContractFormValues | null>(null);
  const form = useForm<ContractFormValues>({
    resolver: zodResolver(ContractFormSchema),
    defaultValues: {
      contractName: '',
      includeTags: [],
      excludeTags: [],
      removeUnreachableTypesFromPublicApiSchema: true,
    },
  });
  return (
    <CallSite
      source="components/target/settings/schema-contracts.tsx"
      origin="base"
      note="In a dialog. The tags on the latest schema version are offered under both tag fields."
    >
      <Raised width="dialog">
        <ContractForm
          form={form}
          onSubmit={setSubmitted}
          suggestedTags={['public', 'internal', 'partner']}
        />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

function CdnTokenExample() {
  const [submitted, setSubmitted] = useState<CdnTokenFormValues | null>(null);
  const form = useForm<CdnTokenFormValues>({
    resolver: zodResolver(CdnTokenFormSchema),
    defaultValues: { alias: '' },
  });
  return (
    <CallSite
      source="components/target/settings/cdn-access-tokens.tsx"
      origin="base"
      note="In a dialog, submitted from the footer by the form's id."
    >
      <Raised width="dialog-lg">
        <CdnTokenForm form={form} onSubmit={setSubmitted} />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

function RegistryTokenExample() {
  const [submitted, setSubmitted] = useState<RegistryTokenFormValues | null>(null);
  const form = useForm<RegistryTokenFormValues>({
    mode: 'onChange',
    resolver: zodResolver(RegistryTokenFormSchema),
    defaultValues: { tokenDescription: '' },
  });
  return (
    <CallSite
      source="components/target/settings/registry-access-token.tsx"
      origin="base"
      note="In a dialog. The buttons stay inside the form because the e2e helper scopes the submit through it."
    >
      <Raised width="dialog-lg">
        <RegistryTokenForm
          form={form}
          onSubmit={setSubmitted}
          permissions={<QueryBacked name="PermissionScopeItem" />}
          noPermissionsSelected={false}
          onCancel={() => {}}
        />
        <Submitted values={submitted} />
      </Raised>
    </CallSite>
  );
}

export const TargetTokensAndContracts = createPreview({
  label: 'Target tokens and contracts',
  render: () => (
    <div className="flex flex-col gap-8">
      <ContractExample />
      <CdnTokenExample />
      <RegistryTokenExample />
    </div>
  ),
});
