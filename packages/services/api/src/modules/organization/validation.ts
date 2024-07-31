import { z } from 'zod';
import { NameModel } from '../../shared/entities';

export const OrganizationNameModel = NameModel.min(2).max(50);
export const OrganizationSlugModel = z
  .string({
    required_error: 'Organization slug is required',
  })
  .min(1, 'Organization slug is required')
  .max(50, 'Slug must be less than 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and dashes');
