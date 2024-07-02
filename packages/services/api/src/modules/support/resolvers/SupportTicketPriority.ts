import { SupportTicketPriority as SupportTicketPriorityEnum } from '../../../shared/entities';
import type { SupportTicketPriorityResolvers } from './../../../__generated__/types.next';

export const SupportTicketPriority: SupportTicketPriorityResolvers = {
  NORMAL: SupportTicketPriorityEnum.NORMAL,
  HIGH: SupportTicketPriorityEnum.HIGH,
  URGENT: SupportTicketPriorityEnum.URGENT,
};
