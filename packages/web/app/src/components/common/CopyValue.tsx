import React from 'react';
import { VscFiles } from 'react-icons/vsc';
import {
  InputGroup,
  Input,
  InputRightElement,
  IconButton,
} from '@chakra-ui/react';
import { useClipboard } from '@/lib/hooks/use-clipboard';

export const CopyValue: React.FC<{ value: string; width?: string | number }> =
  ({ value, width }) => {
    const copyToClipboard = useClipboard();
    const copy = React.useCallback(() => {
      copyToClipboard(value);
    }, [value, copyToClipboard]);

    return (
      <InputGroup size="md" style={{ width: width || 430 }}>
        <Input pr="4.5rem" type="text" value={value} readOnly />
        <InputRightElement width="3rem">
          <IconButton
            h="1.75rem"
            size="sm"
            onClick={copy}
            aria-label="Copy"
            icon={<VscFiles />}
          />
        </InputRightElement>
      </InputGroup>
    );
  };
