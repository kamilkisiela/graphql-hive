import { env } from '@/env/frontend';

export const getPaddleClientConfig = () => {
  const { paddle } = env;

  if (!paddle?.clientSideKey) {
    return null;
  }

  return {
    clientSideKey: paddle.clientSideKey,
    environment: paddle.environment ?? 'production',
  };
};

export const getIsPaddleEnabled = () => !!getPaddleClientConfig();
