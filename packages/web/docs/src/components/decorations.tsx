export function ArchDecoration(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="432"
      height="432"
      viewBox="0 0 432 432"
      preserveAspectRatio="xMidYMid meet"
      {...props}
    >
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
    <svg width="432" height="432" viewBox="0 0 432 432" className="absolute -z-10">
      <defs>
        <linearGradient
          id="arch-decoration-a"
          x1="48.5"
          y1="53.5"
          x2="302.5"
          y2="341"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" stopOpacity=".1" />
          <stop offset="1" stopColor="#fff" stopOpacity=".3" />
        </linearGradient>
        <linearGradient
          id="arch-decoration-b"
          x1="1"
          y1="1"
          x2="431"
          y2="431"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fff" stopOpacity=".1" />
          <stop offset="1" stopColor="#fff" stopOpacity=".4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function HighlightDecoration(props: React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg width="895" height="674" viewBox="0 0 895 674" fill="#86B6C1" {...props}>
      <g filter="url(#filter0_f_711_1774)">
        <path d="M350 280.534C350 296.208 356.24 311.261 367.33 322.351L453.447 408.468L463.532 418.553L549.649 504.67C560.739 515.76 575.792 522 591.466 522L894 522L894 408.468L552.251 408.468C503.249 408.468 463.532 368.751 463.532 319.749L463.532 -22L350 -22L350 280.534Z" />
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

export function LargeHiveIconDecoration(props: React.SVGAttributes<SVGSVGElement>) {
  return (
    <svg width={305} height={217} viewBox="0 0 305 217" fill="none" {...props}>
      <g clipPath="url(#clip0_711_1997)">
        <mask id="a" fill="#fff">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M91.485 0h122.03L305 91.485v122.03L213.515 305H91.485L0 213.515V91.485L91.485 0zm77.641 285.534l116.396-116.397c9.186-9.186 9.186-24.076 0-33.263L169.126 19.478c-9.187-9.186-24.077-9.186-33.263 0L19.478 135.874c-9.186 9.187-9.186 24.077 0 33.263l116.385 116.397c9.186 9.186 24.076 9.186 33.263 0zm-48.561-133.04l31.928-31.929 31.929 31.929-31.929 31.929-31.928-31.929z"
          />
        </mask>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M91.485 0h122.03L305 91.485v122.03L213.515 305H91.485L0 213.515V91.485L91.485 0zm77.641 285.534l116.396-116.397c9.186-9.186 9.186-24.076 0-33.263L169.126 19.478c-9.187-9.186-24.077-9.186-33.263 0L19.478 135.874c-9.186 9.187-9.186 24.077 0 33.263l116.385 116.397c9.186 9.186 24.076 9.186 33.263 0zm-48.561-133.04l31.928-31.929 31.929 31.929-31.929 31.929-31.928-31.929z"
          fill="url(#paint0_linear_711_1997)"
        />
        <path
          d="M213.515 0l.707-.707L213.93-1h-.415v1zM91.485 0v-1h-.415l-.292.293.707.707zM305 91.485h1v-.415l-.293-.292-.707.707zm0 122.03l.707.707.293-.292v-.415h-1zM213.515 305v1h.415l.292-.293-.707-.707zm-122.03 0l-.707.707.292.293h.415v-1zM0 213.515h-1v.415l.293.292.707-.707zm0-122.03l-.707-.707-.293.292v.415h1zm285.522 77.652l.707.707-.707-.707zM169.126 285.534l-.708-.707.708.707zm116.396-149.66l.707-.707-.707.707zM169.126 19.478l-.708.707.708-.707zm-33.263 0l-.707-.707.707.707zM19.478 135.874l.707.708-.707-.708zm0 33.263l.707-.707-.707.707zm116.385 116.397l-.707.707.707-.707zm16.63-164.969l.708-.707-.708-.707-.707.707.707.707zm-31.928 31.929l-.707-.707-.708.707.708.707.707-.707zm63.857 0l.707.707.708-.707-.708-.707-.707.707zm-31.929 31.929l-.707.707.707.707.708-.707-.708-.707zM213.515-1H91.485v2h122.03v-2zm92.192 91.778L214.222-.707 212.808.707l91.485 91.485 1.414-1.414zM306 213.515V91.485h-2v122.03h2zm-91.778 92.192l91.485-91.485-1.414-1.414-91.485 91.485 1.414 1.414zM91.485 306h122.03v-2H91.485v2zM-.707 214.222l91.485 91.485 1.414-1.414L.707 212.808l-1.414 1.414zM-1 91.485v122.03h2V91.485h-2zM90.778-.707L-.707 90.778l1.414 1.414L92.192.707 90.778-.707zM284.815 168.43L168.418 284.827l1.415 1.414 116.396-116.397-1.414-1.414zm0-31.848c8.796 8.795 8.796 23.053 0 31.848l1.414 1.414c9.577-9.576 9.577-25.1 0-34.677l-1.414 1.415zM168.418 20.185l116.397 116.397 1.414-1.415L169.833 18.771l-1.415 1.414zm-31.848 0c8.795-8.796 23.053-8.796 31.848 0l1.415-1.414c-9.577-9.577-25.101-9.577-34.677 0l1.414 1.414zM20.185 136.582L136.57 20.185l-1.414-1.414L18.771 135.167l1.414 1.415zm0 31.848c-8.796-8.795-8.796-23.053 0-31.848l-1.414-1.415c-9.577 9.577-9.577 25.101 0 34.677l1.414-1.414zM136.57 284.827L20.185 168.43l-1.414 1.414 116.385 116.397 1.414-1.414zm31.848 0c-8.795 8.795-23.053 8.795-31.848 0l-1.414 1.414c9.576 9.577 25.1 9.577 34.677 0l-1.415-1.414zm-16.632-164.969l-31.928 31.929 1.414 1.414 31.929-31.929-1.415-1.414zm33.343 31.929l-31.928-31.929-1.415 1.414 31.929 31.929 1.414-1.414zm-31.928 33.343l31.928-31.929-1.414-1.414-31.929 31.929 1.415 1.414zm-33.343-31.929l31.928 31.929 1.415-1.414-31.929-31.929-1.414 1.414z"
          fill="url(#paint1_linear_711_1997)"
          mask="url(#a)"
        />
      </g>
      <defs>
        <linearGradient
          id="paint0_linear_711_1997"
          x1={0}
          y1={0}
          x2={305}
          y2={305}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#004540" stopOpacity={0.4} />
          <stop offset={1} stopColor="#004540" />
        </linearGradient>
        <linearGradient
          id="paint1_linear_711_1997"
          x1={0}
          y1={0}
          x2={305}
          y2={305}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#4F6C6A" stopOpacity={0.1} />
          <stop offset={1} stopColor="#4F6C6A" stopOpacity={0.8} />
        </linearGradient>
        <clipPath id="clip0_711_1997">
          <path fill="#fff" d="M0 0H305V305H0z" />
        </clipPath>
      </defs>
    </svg>
  );
}
