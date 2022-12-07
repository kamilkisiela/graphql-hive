import { z } from 'zod';

export const EmailInputShape = z.object({
  id: z.string().optional(),
  email: z.string().email().nonempty(),
  subject: z.string().nonempty(),
  body: z.string().nonempty(),
});

export type EmailInput = z.infer<typeof EmailInputShape>;
