import React from 'react';
import 'twin.macro';
import { Spinner as CSpinner } from '@chakra-ui/react';

export const Spinner = () => (
  <div tw="h-full w-full flex justify-center items-center">
    <CSpinner color="#eab308" size="lg" />
  </div>
);
