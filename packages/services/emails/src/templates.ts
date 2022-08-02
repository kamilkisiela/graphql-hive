import { z } from 'zod';

export const templateShapes = z.discriminatedUnion('id', [
  z.object({
    id: z.literal('rate-limit-exceeded'),
    organization: z
      .object({
        id: z.string().nonempty(),
        name: z.string().nonempty(),
        limit: z.number(),
        usage: z.number(),
        period: z
          .object({
            start: z.number(),
            end: z.number(),
          })
          .required(),
      })
      .required(),
  }),
  z.object({
    id: z.literal('rate-limit-warning'),
    organization: z
      .object({
        id: z.string().nonempty(),
        name: z.string().nonempty(),
        limit: z.number(),
        usage: z.number(),
        period: z
          .object({
            start: z.number(),
            end: z.number(),
          })
          .required(),
      })
      .required(),
  }),
]);

type TemplateShapes = z.infer<typeof templateShapes>;

export interface RenderedTemplate {
  jobId: string;
  subject: string;
  body: string;
}

function createRateLimitJobId(template: {
  id: string;
  organization: { id: string; period: { start: number; end: number }; limit: number };
}): string {
  // If the jobId would include only the period and org id, then we would be able to notify the user once per month.
  // There's a chance that an organization will increase the limit and we might need to notify them again.

  return JSON.stringify({
    id: template.id,
    organization: template.organization.id,
    period: {
      start: template.organization.period.start,
      end: template.organization.period.end,
    },
    limit: template.organization.limit,
  });
}

export function renderTemplate(template: TemplateShapes): RenderedTemplate {
  switch (template.id) {
    case 'rate-limit-exceeded': {
      return {
        jobId: createRateLimitJobId(template),
        subject: `${template.organization.name} has exceeded its rate limit`,
        body: `
          ${template.organization.name} has exceeded its rate limit. ${template.organization.usage}/${template.organization.limit}
        `,
      };
    }
    case 'rate-limit-warning': {
      return {
        jobId: createRateLimitJobId(template),
        subject: `${template.organization.name} is approaching its rate limit`,
        body: `
          ${template.organization.name} is approaching its rate limit. ${template.organization.usage}/${template.organization.limit}
        `,
      };
    }
  }
}
