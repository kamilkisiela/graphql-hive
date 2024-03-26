import { createContext, ReactNode, Suspense, useContext, useEffect, useState } from 'react';
import { initializePaddle } from '@paddle/paddle-js';
import { getPaddleClientConfig } from './paddle-public-key';

type PaddleInstance = Awaited<ReturnType<typeof initializePaddle>>;

const PaddleContext = createContext<PaddleInstance>(undefined);

export const usePaddle = () => {
  const paddle = useContext(PaddleContext);

  return {
    enabled: paddle !== undefined,
    instance: paddle!,
  };
};

export const HivePaddleProvider = ({ children }: { children: ReactNode }) => {
  const [paddleInstance, setPaddleInstance] = useState<PaddleInstance | null>(null);
  const paddleConfig = getPaddleClientConfig();

  useEffect(() => {
    if (paddleConfig) {
      void initializePaddle({
        environment: paddleConfig.environment,
        token: paddleConfig.clientSideKey,
      }).then(r => {
        setPaddleInstance(r);
      });
    }
  }, []);

  if (paddleInstance === null || paddleConfig === null) {
    return children;
  }

  return (
    <Suspense fallback={children}>
      <PaddleContext.Provider value={paddleInstance}>{children}</PaddleContext.Provider>
    </Suspense>
  );
};
