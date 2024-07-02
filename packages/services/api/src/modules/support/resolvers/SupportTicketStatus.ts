import { SupportTicketStatus as SupportTicketStatusEnum } from '../../../shared/entities';
import type { SupportTicketStatusResolvers } from './../../../__generated__/types.next';

export const SupportTicketStatus: SupportTicketStatusResolvers = {
  OPEN: SupportTicketStatusEnum.OPEN,
  SOLVED: SupportTicketStatusEnum.SOLVED,
};
