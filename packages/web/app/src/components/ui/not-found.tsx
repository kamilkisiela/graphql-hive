import Image from 'next/image';
import { Card, Heading } from '@/components/v2/index';
import { cn } from '@/lib/utils';
import ghost from '../../../public/images/figures/ghost.svg';

export const NotFound = ({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) => {
  return (
    <Card
      className={cn('flex grow flex-col items-center gap-y-2 cursor-default', className)}
      data-cy="empty-list"
    >
      <Image src={ghost} alt="Ghost illustration" width="200" height="200" className="drag-none" />
      <Heading className="text-center">{title}</Heading>
      <span className="text-center text-sm font-medium text-gray-500">{description}</span>
    </Card>
  );
};
