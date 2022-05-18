import React from 'react';

export function useEventListener<T extends Function>(
  eventName: string,
  handler: T
) {
  const savedHandler = React.useRef<T>();

  React.useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  React.useEffect(() => {
    const eventListener = (event) => savedHandler.current(event);

    window.addEventListener(eventName, eventListener);

    return () => {
      window.removeEventListener(eventName, eventListener);
    };
  }, [eventName, window]);
}
