import { NextApiRequest, NextApiResponse } from 'next';

export default async function health(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({});
}
