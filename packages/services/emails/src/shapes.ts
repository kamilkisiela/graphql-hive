import { z } from 'zod';

export const EmailInputShape = z
  .object({
    id: z.string().nonempty(),
    email: z.string().email().nonempty(),
    subject: z.string().nonempty(),
    body: z.string().nonempty(),
  })
  .required();

export type EmailInput = z.infer<typeof EmailInputShape>;
