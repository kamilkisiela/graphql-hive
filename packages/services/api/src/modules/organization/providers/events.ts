export const ENSURE_PERSONAL_ORGANIZATION_EVENT = 'ensure-personal-organization-event';
export interface EnsurePersonalOrganizationEventPayload {
  name: string;
  user: {
    id: string;
    externalAuthUserId: string;
  };
}
