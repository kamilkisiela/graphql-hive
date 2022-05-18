export function Honeycomb() {
  return (
    <svg width="100%" height="100%">
      <defs>
        <polygon
          points="0, -10, 8.66, -5, 8.66, 5,0,10,-8.66, 5, -8.66, -5"
          id="hex"
          fill="url(#wax)"
        />
      </defs>
      <radialGradient id="wax" fx=".75" fy=".75">
        <stop stopColor="#D1FAE5" />
        <stop offset="1" stopColor="#059669" />
      </radialGradient>
      <pattern
        id="h"
        x="0"
        y="0"
        width="20"
        height="34.64"
        patternUnits="userSpaceOnUse"
        viewBox="0 0 20 34.64"
      >
        <use xlinkHref="#hex" />
        <use xlinkHref="#hex" x="20" />
        <use xlinkHref="#hex" x="10" y="17.32" />
        <use xlinkHref="#hex" y="34.64" />
        <use xlinkHref="#hex" x="20" y="34.64" />
      </pattern>
      <rect width="100%" height="100%" fill="url(#h)" />
    </svg>
  );
}
