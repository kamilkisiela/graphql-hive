import { NextApiRequest, NextApiResponse } from 'next';
import { getLogger } from '@/server-logger';
import { captureException } from '@sentry/nextjs';

async function joinWaitingList(req: NextApiRequest, res: NextApiResponse) {
  const logger = getLogger(req);

  function success(message: string) {
    res.status(200).json({
      ok: true,
      message,
    });
  }

  function failure(message: string) {
    res.status(200).json({
      ok: false,
      message,
    });
  }

  try {
    logger.info('Joining the waiting list (input=%o)', req.body);

    if (req.body.email) {
      await fetch(`https://guild-ms-slack-bot.vercel.app/api/hive?email=${req.body.email}`, {
        method: 'GET',
      });
    } else {
      return failure('Missing email');
    }

    return success('Thank you for joining our waiting list!');
  } catch (error) {
    captureException(error);
    logger.error(`Failed to join waiting list: ${error}`);
    logger.error(error);
    return failure('Failed to join. Try again or contact@the-guild.dev');
  }
}

export default joinWaitingList;

export const config = {
  api: {
    externalResolver: true,
  },
};
