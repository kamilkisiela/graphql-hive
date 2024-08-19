import { z } from 'zod';
import { NameModel } from '../../shared/entities';

export const TargetNameModel = NameModel.min(2).max(30);
export const PercentageModel = z.number().min(0).max(100).step(0.01);
