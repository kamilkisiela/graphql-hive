export function ArchDecoration(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="432" height="432" {...props}>
      <path
        d="M.75 431v.25h90.24V160.868c0-38.596 31.282-69.878 69.878-69.878H431.25V.75H191.864a47.017 47.017 0 0 0-33.23 13.771l-68.07 68.071-7.972 7.971-68.07 68.071A47.018 47.018 0 0 0 .75 191.864V431Z"
        fill="url(#arch-decoration-a)"
        stroke="url(#arch-decoration-b)"
        strokeWidth=".5"
      />
    </svg>
  );
}

export function ArchDecorationGradientDefs() {
  return (
    <svg width="432" height="432" className="absolute -z-10">
      <defs>
        <linearGradient
          id="arch-decoration-a"
          x1="48.5"
          y1="53.5"
          x2="302.5"
          y2="341"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="#fff" stop-opacity=".1" />
          <stop offset="1" stop-color="#fff" stop-opacity=".3" />
        </linearGradient>
        <linearGradient
          id="arch-decoration-b"
          x1="1"
          y1="1"
          x2="431"
          y2="431"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="#fff" stop-opacity=".1" />
          <stop offset="1" stop-color="#fff" stop-opacity=".4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function HighlightDecoration(props: React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg width="895" height="674" viewBox="0 0 895 674" {...props}>
      <g filter="url(#filter0_f_711_1774)">
        <path
          d="M350 280.534C350 296.208 356.24 311.261 367.33 322.351L453.447 408.468L463.532 418.553L549.649 504.67C560.739 515.76 575.792 522 591.466 522L894 522L894 408.468L552.251 408.468C503.249 408.468 463.532 368.751 463.532 319.749L463.532 -22L350 -22L350 280.534Z"
          fill="#86B6C1"
        />
      </g>
      <defs>
        <filter
          id="filter0_f_711_1774"
          x="-3.05176e-05"
          y="-372"
          width="1244"
          height="1244"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="175" result="effect1_foregroundBlur_711_1774" />
        </filter>
      </defs>
    </svg>
  );
}
