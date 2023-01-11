import { Button, useColorMode } from '@chakra-ui/react';
import { FiMoon, FiSun } from 'react-icons/fi';

const ThemeButton = () => {
  const { colorMode, toggleColorMode } = useColorMode();

  const toggle = () => {
    toggleColorMode();
    if (colorMode === 'light') {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  };

  return (
    <Button onClick={toggle} size="sm" variant="ghost">
      {colorMode === 'light' ? <FiMoon /> : <FiSun />}
    </Button>
  );
};

export default ThemeButton;
