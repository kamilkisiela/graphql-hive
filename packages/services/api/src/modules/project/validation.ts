import { z } from 'zod';
import { NameModel } from '../../shared/entities';

export const ProjectNameModel = NameModel.min(2).max(40);
export const URLModel = z.string().url().max(500);
export const MaybeModel = <T extends z.ZodType>(value: T) =>
  z.union([z.null(), z.undefined(), value]);
