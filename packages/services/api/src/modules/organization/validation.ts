import { NameModel } from '../../shared/entities';

export const OrganizationNameModel = NameModel.min(2).max(50);
