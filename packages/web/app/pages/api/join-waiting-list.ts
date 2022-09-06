import { NextApiRequest, NextApiResponse } from 'next';
import { withSentry, captureException } from '@sentry/nextjs';

async function joinWaitingList(req: NextApiRequest, res: NextApiResponse) {
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
    console.log('Joining the waiting list (input=%o)', req.body);

    if (req.body.email) {
      await fetch(`https://guild-ms-slack-bot.vercel.app/api/hive?email=${req.body.email}`, {
        method: 'GET',
      });
    } else {
      return failure('Missing email');
    }

    return success('Thank you for joining our waiting list!');
  } catch (error) {
    console.error(`Failed to join waiting list: ${error}`);
    console.error(error);
    captureException(error);
    return failure('Failed to join. Try again or contact@the-guild.dev');
  }
}

export default withSentry(joinWaitingList);

export const config = {
  api: {
    externalResolver: true,
  },
};
