import { NextApiRequest, NextApiResponse } from 'next';

export default async function graphql(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({});
}
