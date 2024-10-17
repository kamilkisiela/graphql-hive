import { z } from 'zod';
import { NameModel } from '../../shared/entities';

export const ProjectNameModel = NameModel.min(2).max(40);
export const ProjectSlugModel = z
  .string({
    required_error: 'Project slug is required',
  })
  .min(1, 'Project slug is required')
  .max(50, 'Slug must be less than 50 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and dashes')
  .refine(slug => slug !== 'view', {
    message: "Slug can't be 'view'",
  });
export const URLModel = z.string().url().max(500);
export const MaybeModel = <T extends z.ZodType>(value: T) =>
  z.union([z.null(), z.undefined(), value]);
