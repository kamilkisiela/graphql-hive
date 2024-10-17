import { z } from 'zod';
import { NameModel } from '../../shared/entities';
import { reservedOrganizationSlugs } from './providers/organization-config';

export const OrganizationNameModel = NameModel.min(2).max(50);
export const OrganizationSlugModel = z
  .string({
    required_error: 'Organization slug is required',
  })
  .min(1, 'Organization slug is required')
  .max(50, 'Slug must be less than 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and dashes')
  .refine(slug => !reservedOrganizationSlugs.includes(slug), {
    message: "Slug can't be one of the reserved names",
  });
export const createOrUpdateMemberRoleInputSchema = z.object({
  name: z
    .string({
      required_error: 'Please enter role name',
    })
    .trim()
    .min(2, 'Role name must be at least 2 characters long')
    .max(64, 'Role name must be at most 64 characters long')
    .refine(
      val => typeof val === 'string' && val.length > 0 && val[0] === val[0].toUpperCase(),
      'Must start with a capital letter',
    )
    .refine(val => val !== 'Viewer' && val !== 'Admin', 'Viewer and Admin are reserved'),
  description: z
    .string({
      required_error: 'Please enter role description',
    })
    .trim()
    .min(2, 'Role description must be at least 2 characters long')
    .max(256, 'Role description must be at most 256 characters long'),
});
