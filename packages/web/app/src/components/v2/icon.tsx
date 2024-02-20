import { ReactElement } from 'react';
import { clsx } from 'clsx';

const DEFAULT_PATH_PROPS = {
  strokeWidth: '2',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

type IconProps = { className?: string };

export const GraphQLIcon = ({ className }: IconProps): ReactElement => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="24"
    width="24"
    viewBox="0 0 29.999 30"
    fill="currentColor"
    className={className}
  >
    <path d="M4.08 22.864l-1.1-.636L15.248.98l1.1.636z" />
    <path d="M2.727 20.53h24.538v1.272H2.727z" />
    <path d="M15.486 28.332L3.213 21.246l.636-1.1 12.273 7.086zm10.662-18.47L13.874 2.777l.636-1.1 12.273 7.086z" />
    <path d="M3.852 9.858l-.636-1.1L15.5 1.67l.636 1.1z" />
    <path d="M25.922 22.864l-12.27-21.25 1.1-.636 12.27 21.25zM3.7 7.914h1.272v14.172H3.7zm21.328 0H26.3v14.172h-1.272z" />
    <path d="M15.27 27.793l-.555-.962 10.675-6.163.555.962z" />
    <path d="M27.985 22.5a2.68 2.68 0 0 1-3.654.981 2.68 2.68 0 0 1-.981-3.654 2.68 2.68 0 0 1 3.654-.981c1.287.743 1.724 2.375.98 3.654M6.642 10.174a2.68 2.68 0 0 1-3.654.981A2.68 2.68 0 0 1 2.007 7.5a2.68 2.68 0 0 1 3.654-.981 2.68 2.68 0 0 1 .981 3.654M2.015 22.5a2.68 2.68 0 0 1 .981-3.654 2.68 2.68 0 0 1 3.654.981 2.68 2.68 0 0 1-.981 3.654c-1.287.735-2.92.3-3.654-.98m21.343-12.326a2.68 2.68 0 0 1 .981-3.654 2.68 2.68 0 0 1 3.654.981 2.68 2.68 0 0 1-.981 3.654 2.68 2.68 0 0 1-3.654-.981M15 30a2.674 2.674 0 1 1 2.674-2.673A2.68 2.68 0 0 1 15 30m0-24.652a2.67 2.67 0 0 1-2.674-2.674 2.67 2.67 0 1 1 5.347 0A2.67 2.67 0 0 1 15 5.347" />
  </svg>
);

export const SaveIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

export const TrendingUpIcon = ({ className }: IconProps): ReactElement => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M23 6L13.5 15.5L8.5 10.5L1 18" {...DEFAULT_PATH_PROPS} />
    <path d="M17 6H23V12" {...DEFAULT_PATH_PROPS} />
  </svg>
);

export const PlusIcon = (props: IconProps & { size?: number }): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 24}
    height={props.size ?? 24}
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={props.className}
  >
    <path d="M12 5V19" {...DEFAULT_PATH_PROPS} />
    <path d="M5 12H19" {...DEFAULT_PATH_PROPS} />
  </svg>
);

export const CalendarIcon = ({ className }: IconProps): ReactElement => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="3" y="4" width="18" height="18" rx="2" {...DEFAULT_PATH_PROPS} />
    <path d="M16 2V6" {...DEFAULT_PATH_PROPS} />
    <path d="M8 2V6" {...DEFAULT_PATH_PROPS} />
    <path d="M3 10H21" {...DEFAULT_PATH_PROPS} />
  </svg>
);

export const UserPlusMinusIcon = ({
  className,
  isPlus,
}: IconProps & { isPlus: boolean }): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M16 21V19C16 16.7909 14.2091 15 12 15H5C2.79086 15 1 16.7909 1 19V21"
      {...DEFAULT_PATH_PROPS}
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.5 11C10.7091 11 12.5 9.20914 12.5 7C12.5 4.79086 10.7091 3 8.5 3C6.29086 3 4.5 4.79086 4.5 7C4.5 9.20914 6.29086 11 8.5 11Z"
      {...DEFAULT_PATH_PROPS}
    />
    {isPlus && <path d="M20 8V14" {...DEFAULT_PATH_PROPS} />}
    <path d="M23 11H17" {...DEFAULT_PATH_PROPS} />
  </svg>
);

export const UsersIcon = (props: IconProps & { size: number }): ReactElement => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={props.size}
    height={props.size}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx={9} cy={7} r={4} />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const MoreIcon = ({ className, ...props }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className={clsx('size-6 stroke-current', className)}
    {...props}
  >
    <path
      d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z"
      {...DEFAULT_PATH_PROPS}
    />
    <path
      d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z"
      {...DEFAULT_PATH_PROPS}
    />
    <path
      d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z"
      {...DEFAULT_PATH_PROPS}
    />
  </svg>
);

export const EditIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 22 22"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M16 1.99988C16.7145 1.28535 17.756 1.00629 18.7321 1.26783C19.7081 1.52936 20.4705 2.29176 20.7321 3.26783C20.9936 4.2439 20.7145 5.28535 20 5.99988L6.5 19.4999L1 20.9999L2.5 15.4999L16 1.99988Z"
      {...DEFAULT_PATH_PROPS}
    />
  </svg>
);

export const TrashIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="currentColor"
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M3 6H5H21" {...DEFAULT_PATH_PROPS} />
    <path
      stroke="none"
      d="M20 6C20 5.44772 19.5523 5 19 5C18.4477 5 18 5.44772 18 6H20ZM6 6C6 5.44772 5.55228 5 5 5C4.44772 5 4 5.44772 4 6H6ZM7 6C7 6.55228 7.44772 7 8 7C8.55228 7 9 6.55228 9 6H7ZM15 6C15 6.55228 15.4477 7 16 7C16.5523 7 17 6.55228 17 6H15ZM18 6V20H20V6H18ZM18 20C18 20.5523 17.5523 21 17 21V23C18.6569 23 20 21.6569 20 20H18ZM17 21H7V23H17V21ZM7 21C6.44772 21 6 20.5523 6 20H4C4 21.6569 5.34315 23 7 23V21ZM6 20V6H4V20H6ZM9 6V4H7V6H9ZM9 4C9 3.44772 9.44772 3 10 3V1C8.34315 1 7 2.34315 7 4H9ZM10 3H14V1H10V3ZM14 3C14.5523 3 15 3.44772 15 4H17C17 2.34315 15.6569 1 14 1V3ZM15 4V6H17V4H15Z"
    />
    <path d="M10 11V17" {...DEFAULT_PATH_PROPS} />
    <path d="M14 11V17" {...DEFAULT_PATH_PROPS} />
  </svg>
);

export const ShareIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1={12} y1={2} x2={12} y2={15} />
  </svg>
);

export const CopyIcon = ({
  className,
  size = 24,
}: {
  className?: string;
  size?: number;
}): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    className={className}
  >
    <rect x="9" y="9" width="13" height="13" rx="2" {...DEFAULT_PATH_PROPS} />
    <path
      d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5"
      {...DEFAULT_PATH_PROPS}
    />
  </svg>
);

export const ArrowDownIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M6 9L12 15L18 9" />
  </svg>
);

export const CheckIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M20 6L9 17L4 12" {...DEFAULT_PATH_PROPS} />
  </svg>
);

export const TargetIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
      {...DEFAULT_PATH_PROPS}
    />
    <path
      d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z"
      {...DEFAULT_PATH_PROPS}
    />
    <path
      d="M12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z"
      {...DEFAULT_PATH_PROPS}
    />
  </svg>
);

export const GridIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect x="3" y="3" width="7" height="7" {...DEFAULT_PATH_PROPS} />
    <rect x="14" y="3" width="7" height="7" {...DEFAULT_PATH_PROPS} />
    <rect x="14" y="14" width="7" height="7" {...DEFAULT_PATH_PROPS} />
    <rect x="3" y="14" width="7" height="7" {...DEFAULT_PATH_PROPS} />
  </svg>
);

export const SettingsIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    stroke="currentColor"
    fill="none"
    className={className}
  >
    <path
      d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
      {...DEFAULT_PATH_PROPS}
    />
    <path
      d="M19.4 15C19.1277 15.6171 19.2583 16.3378 19.73 16.82L19.79 16.88C20.1656 17.2551 20.3766 17.7642 20.3766 18.295C20.3766 18.8258 20.1656 19.3349 19.79 19.71C19.4149 20.0856 18.9058 20.2966 18.375 20.2966C17.8442 20.2966 17.3351 20.0856 16.96 19.71L16.9 19.65C16.4178 19.1783 15.6971 19.0477 15.08 19.32C14.4755 19.5791 14.0826 20.1724 14.08 20.83V21C14.08 22.1046 13.1846 23 12.08 23C10.9754 23 10.08 22.1046 10.08 21V20.91C10.0642 20.2327 9.63587 19.6339 9 19.4C8.38291 19.1277 7.66219 19.2583 7.18 19.73L7.12 19.79C6.74486 20.1656 6.23582 20.3766 5.705 20.3766C5.17418 20.3766 4.66514 20.1656 4.29 19.79C3.91445 19.4149 3.70343 18.9058 3.70343 18.375C3.70343 17.8442 3.91445 17.3351 4.29 16.96L4.35 16.9C4.82167 16.4178 4.95235 15.6971 4.68 15.08C4.42093 14.4755 3.82764 14.0826 3.17 14.08H3C1.89543 14.08 1 13.1846 1 12.08C1 10.9754 1.89543 10.08 3 10.08H3.09C3.76733 10.0642 4.36613 9.63587 4.6 9C4.87235 8.38291 4.74167 7.66219 4.27 7.18L4.21 7.12C3.83445 6.74486 3.62343 6.23582 3.62343 5.705C3.62343 5.17418 3.83445 4.66514 4.21 4.29C4.58514 3.91445 5.09418 3.70343 5.625 3.70343C6.15582 3.70343 6.66486 3.91445 7.04 4.29L7.1 4.35C7.58219 4.82167 8.30291 4.95235 8.92 4.68H9C9.60447 4.42093 9.99738 3.82764 10 3.17V3C10 1.89543 10.8954 1 12 1C13.1046 1 14 1.89543 14 3V3.09C14.0026 3.74764 14.3955 4.34093 15 4.6C15.6171 4.87235 16.3378 4.74167 16.82 4.27L16.88 4.21C17.2551 3.83445 17.7642 3.62343 18.295 3.62343C18.8258 3.62343 19.3349 3.83445 19.71 4.21C20.0856 4.58514 20.2966 5.09418 20.2966 5.625C20.2966 6.15582 20.0856 6.66486 19.71 7.04L19.65 7.1C19.1783 7.58219 19.0477 8.30291 19.32 8.92V9C19.5791 9.60447 20.1724 9.99738 20.83 10H21C22.1046 10 23 10.8954 23 12C23 13.1046 22.1046 14 21 14H20.91C20.2524 14.0026 19.6591 14.3955 19.4 15Z"
      {...DEFAULT_PATH_PROPS}
    />
  </svg>
);

export const FileTextIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"
      {...DEFAULT_PATH_PROPS}
    />
    <path d="M14 2V8H20" {...DEFAULT_PATH_PROPS} />
    <path d="M16 13H8" {...DEFAULT_PATH_PROPS} />
    <path d="M16 17H8" {...DEFAULT_PATH_PROPS} />
    <path d="M10 9H9H8" {...DEFAULT_PATH_PROPS} />
  </svg>
);

export const LogOutIcon = ({ className }: IconProps): ReactElement => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    stroke="currentColor"
    className={className}
  >
    <path
      d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9"
      {...DEFAULT_PATH_PROPS}
    />
    <path d="M16 17L21 12L16 7" {...DEFAULT_PATH_PROPS} />
    <path d="M21 12H9" {...DEFAULT_PATH_PROPS} />
  </svg>
);

export const LinkIcon = ({ className, ...props }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className={clsx('size-6 fill-none stroke-current', className)}
    {...props}
  >
    <path
      d="M10 13C10.869 14.1617 12.1996 14.8887 13.6466 14.9923C15.0937 15.0959 16.5144 14.566 17.54 13.54L20.54 10.54C22.4349 8.57807 22.4078 5.45954 20.4791 3.53087C18.5504 1.6022 15.4319 1.57511 13.47 3.46997L11.75 5.17997"
      {...DEFAULT_PATH_PROPS}
    />
    <path
      d="M14.0002 11C13.1312 9.8383 11.8006 9.1113 10.3536 9.00766C8.90653 8.90403 7.48583 9.43399 6.4602 10.46L3.4602 13.46C1.56534 15.4219 1.59244 18.5404 3.52111 20.4691C5.44978 22.3978 8.56831 22.4249 10.5302 20.53L12.2402 18.82"
      {...DEFAULT_PATH_PROPS}
    />
  </svg>
);

export const KeyIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    className={className}
  >
    <path d="M21.7069 2.70711C22.0974 2.31658 22.0974 1.68342 21.7069 1.29289C21.3164 0.902369 20.6832 0.902369 20.2927 1.29289L21.7069 2.70711ZM18.2927 3.29289C17.9022 3.68342 17.9022 4.31658 18.2927 4.70711C18.6832 5.09763 19.3164 5.09763 19.7069 4.70711L18.2927 3.29289ZM11.3898 11.61L12.0921 10.8982C11.7009 10.5122 11.0716 10.5142 10.6828 10.9027L11.3898 11.61ZM3.61179 19.388L2.89246 20.0828L2.89996 20.0904L3.61179 19.388ZM11.3888 11.611L10.6941 12.3303C11.0864 12.7092 11.71 12.7039 12.0957 12.3183L11.3888 11.611ZM10.6827 10.9029C10.2922 11.2934 10.2922 11.9266 10.6827 12.3171C11.0732 12.7076 11.7064 12.7076 12.0969 12.3171L10.6827 10.9029ZM16.2069 8.20711C16.5974 7.81658 16.5974 7.18342 16.2069 6.79289C15.8164 6.40237 15.1832 6.40237 14.7927 6.79289L16.2069 8.20711ZM16.2069 6.79289C15.8164 6.40237 15.1832 6.40237 14.7927 6.79289C14.4022 7.18342 14.4022 7.81658 14.7927 8.20711L16.2069 6.79289ZM18.4998 10.5L17.7927 11.2071C18.1832 11.5976 18.8164 11.5976 19.2069 11.2071L18.4998 10.5ZM21.9998 7L22.7069 7.70711C23.0974 7.31658 23.0974 6.68342 22.7069 6.29289L21.9998 7ZM19.7069 3.29289C19.3164 2.90237 18.6832 2.90237 18.2927 3.29289C17.9022 3.68342 17.9022 4.31658 18.2927 4.70711L19.7069 3.29289ZM14.7927 6.79289C14.4022 7.18342 14.4022 7.81658 14.7927 8.20711C15.1832 8.59763 15.8164 8.59763 16.2069 8.20711L14.7927 6.79289ZM19.7069 4.70711C20.0974 4.31658 20.0974 3.68342 19.7069 3.29289C19.3164 2.90237 18.6832 2.90237 18.2927 3.29289L19.7069 4.70711ZM20.2927 1.29289L18.2927 3.29289L19.7069 4.70711L21.7069 2.70711L20.2927 1.29289ZM10.6874 12.3218C11.837 13.456 12.2906 15.1193 11.8761 16.68L13.8091 17.1934C14.4078 14.9389 13.7526 12.5365 12.0921 10.8982L10.6874 12.3218ZM11.8761 16.68C11.4616 18.2408 10.2426 19.4598 8.68182 19.8743L9.19514 21.8073C11.4496 21.2086 13.2104 19.4478 13.8091 17.1934L11.8761 16.68ZM8.68182 19.8743C7.12104 20.2888 5.45783 19.8352 4.32362 18.6856L2.89996 20.0904C4.53827 21.7508 6.94068 22.406 9.19514 21.8073L8.68182 19.8743ZM4.33108 18.6933C2.6257 16.9276 2.65009 14.1209 4.38589 12.3851L2.97168 10.9709C0.464409 13.4782 0.42918 17.5322 2.8925 20.0827L4.33108 18.6933ZM4.38589 12.3851C6.12169 10.6493 8.92837 10.6249 10.6941 12.3303L12.0835 10.8917C9.53304 8.42839 5.47895 8.46362 2.97168 10.9709L4.38589 12.3851ZM12.0957 12.3183L12.0967 12.3173L10.6828 10.9027L10.6818 10.9037L12.0957 12.3183ZM12.0969 12.3171L16.2069 8.20711L14.7927 6.79289L10.6827 10.9029L12.0969 12.3171ZM14.7927 8.20711L17.7927 11.2071L19.2069 9.79289L16.2069 6.79289L14.7927 8.20711ZM19.2069 11.2071L22.7069 7.70711L21.2927 6.29289L17.7927 9.79289L19.2069 11.2071ZM22.7069 6.29289L19.7069 3.29289L18.2927 4.70711L21.2927 7.70711L22.7069 6.29289ZM16.2069 8.20711L19.7069 4.70711L18.2927 3.29289L14.7927 6.79289L16.2069 8.20711Z" />
  </svg>
);

export const XIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    className={className}
  >
    <path d="M18 6L6 18" {...DEFAULT_PATH_PROPS} />
    <path d="M6 6L18 18" {...DEFAULT_PATH_PROPS} />
  </svg>
);

export const LinkedInIcon = ({ className, ...props }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className={clsx('size-6 fill-current', className)}
    {...props}
  >
    <path d="M16 8C19.3137 8 22 10.6863 22 14V21H18V14C18 12.8954 17.1046 12 16 12C14.8954 12 14 12.8954 14 14V21H10V14C10 10.6863 12.6863 8 16 8Z" />
    <rect x={2} y={9} width={4} height={12} />
    <path d="M4 6C5.10457 6 6 5.10457 6 4C6 2.89543 5.10457 2 4 2C2.89543 2 2 2.89543 2 4C2 5.10457 2.89543 6 4 6Z" />
  </svg>
);

export const GoogleIcon = ({ className }: IconProps): ReactElement => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M22 12.2339C22 17.9395 18.0287 22 12.1639 22C6.54098 22 2 17.5323 2 12C2 6.46774 6.54098 2 12.1639 2C14.9016 2 17.2049 2.9879 18.9795 4.61694L16.2131 7.23387C12.5943 3.79839 5.86475 6.37903 5.86475 12C5.86475 15.4879 8.69672 18.3145 12.1639 18.3145C16.1885 18.3145 17.6967 15.4758 17.9344 14.004H12.1639V10.5645H21.8402C21.9344 11.0766 22 11.5685 22 12.2339Z" />
  </svg>
);

export const GitHubIcon = ({ className }: IconProps): ReactElement => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M9.28735 19.9578C9.81634 19.7991 10.1165 19.2416 9.95783 18.7127C9.79913 18.1837 9.24164 17.8835 8.71265 18.0422L9.28735 19.9578ZM2.24254 15.0299C1.70674 14.8959 1.16381 15.2217 1.02986 15.7575C0.895909 16.2933 1.22167 16.8362 1.75746 16.9701L2.24254 15.0299ZM8.71265 18.0422C7.57636 18.3831 6.82286 18.3817 6.30601 18.2607C5.80203 18.1427 5.42857 17.8894 5.08211 17.5429C4.90325 17.364 4.73545 17.1642 4.5569 16.9406C4.39069 16.7324 4.18875 16.4689 3.99562 16.2422C3.60492 15.7835 3.05841 15.2338 2.24254 15.0299L1.75746 16.9701C1.94159 17.0162 2.14508 17.154 2.47313 17.5391C2.63937 17.7342 2.789 17.9317 2.99388 18.1883C3.18643 18.4295 3.40925 18.6985 3.66789 18.9571C4.19643 19.4856 4.88547 19.9823 5.85024 20.2081C6.80214 20.4308 7.92364 20.3669 9.28735 19.9578L8.71265 18.0422Z" />
    <path d="M16.0001 21.9999V18.1299C16.076 17.1653 15.7336 16.2147 15.0601 15.5199C18.2001 15.1699 21.5001 13.9799 21.5001 8.51994C21.4998 7.12376 20.9628 5.78114 20.0001 4.76994C20.4559 3.54844 20.4237 2.19829 19.9101 0.999938C19.9101 0.999938 18.7301 0.649938 16.0001 2.47994C13.7081 1.85876 11.2921 1.85876 9.00008 2.47994C6.27008 0.649938 5.09008 0.999938 5.09008 0.999938C4.57645 2.19829 4.54422 3.54844 5.00008 4.76994C4.0302 5.78864 3.4926 7.1434 3.50008 8.54994C3.50008 13.9699 6.80008 15.1599 9.94008 15.5499C9.2747 16.2375 8.93295 17.1755 9.00008 18.1299V21.9999" />
  </svg>
);

export const SlackIcon = ({ className }: IconProps): ReactElement => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M14.5 10C13.67 10 13 9.33 13 8.5V3.5C13 2.67 13.67 2 14.5 2C15.33 2 16 2.67 16 3.5V8.5C16 9.33 15.33 10 14.5 10Z" />
    <path d="M20.5 10H19V8.5C19 7.67 19.67 7 20.5 7C21.33 7 22 7.67 22 8.5C22 9.33 21.33 10 20.5 10Z" />
    <path d="M9.5 14C10.33 14 11 14.67 11 15.5V20.5C11 21.33 10.33 22 9.5 22C8.67 22 8 21.33 8 20.5V15.5C8 14.67 8.67 14 9.5 14Z" />
    <path d="M3.5 14H5V15.5C5 16.33 4.33 17 3.5 17C2.67 17 2 16.33 2 15.5C2 14.67 2.67 14 3.5 14Z" />
    <path d="M14 14.5C14 13.67 14.67 13 15.5 13H20.5C21.33 13 22 13.67 22 14.5C22 15.33 21.33 16 20.5 16H15.5C14.67 16 14 15.33 14 14.5Z" />
    <path d="M15.5 19H14V20.5C14 21.33 14.67 22 15.5 22C16.33 22 17 21.33 17 20.5C17 19.67 16.33 19 15.5 19Z" />
    <path d="M10 9.5C10 8.67 9.33 8 8.5 8H3.5C2.67 8 2 8.67 2 9.5C2 10.33 2.67 11 3.5 11H8.5C9.33 11 10 10.33 10 9.5Z" />
    <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2C7.67 2 7 2.67 7 3.5C7 4.33 7.67 5 8.5 5Z" />
  </svg>
);

export const HiveLogo = ({ className }: IconProps): ReactElement => (
  <svg
    width="42"
    height="44"
    viewBox="0 0 57 61"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={clsx('inline fill-none', className)}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0 16.1C0 17.7999 0.900024 19.2999 2.30005 20.1C2.45459 20.203 2.63562 20.2794 2.81592 20.343C2.9856 20.403 3.15454 20.4515 3.30005 20.5H3.40002C3.45203 20.552 3.53125 20.577 3.60925 20.589C3.68115 20.6 3.75208 20.6 3.80005 20.6H3.90002H4.5H5H5.1001C5.15015 20.6 5.2251 20.575 5.30005 20.55C5.375 20.525 5.44995 20.5 5.5 20.5H5.6001C5.65015 20.5 5.7251 20.475 5.80005 20.45C5.875 20.425 5.94995 20.4 6 20.4C7.69995 19.7001 9 18.1 9 16.1C9 15.8784 8.94543 15.7114 8.91699 15.5186C8.90686 15.4502 8.90002 15.3785 8.90002 15.3L27.7 4.5C28 4.40002 28.3 4.30005 28.6001 4.30005C28.9 4.30005 29.2 4.30005 29.5 4.5L45.4 13.7C46 12.2999 46.9 11.1001 48.1001 10.3L31.7 0.800049C30.8 0.300049 29.8 0 28.7 0C27.7 0 26.6 0.300049 25.7 0.800049L6.40002 11.9C5.90002 11.6 5.30005 11.5 4.6001 11.5C2.1001 11.5 0 13.6 0 16.1ZM55.1001 19.5C56.1001 18.7 56.7 17.5 56.7 16.1C56.7 13.6 54.6 11.5 52 11.5C51.5 11.5 51 11.6 50.6001 11.7C50.4 11.7999 50.3 11.8 50.1001 11.9C50.1001 12 50 12 50 12C49.9236 12.0382 49.8618 12.0618 49.8091 12.0819C49.7236 12.1146 49.6619 12.1382 49.6001 12.2C49.6001 12.2999 49.5 12.3 49.5 12.3C49.2 12.5 49 12.7 48.7 13C48.6499 13.05 48.6 13.125 48.55 13.2C48.5 13.275 48.45 13.3501 48.4 13.4C47.8 14.2001 47.5 15.1 47.5 16.1C47.5 18.2 48.9 19.9 50.8 20.5V41.2C50.8 41.8999 50.5 42.5 49.9 42.8L34.3 51.8C35.2 52.9 35.7 54.4 35.7 55.9L52.1001 46.5C53.9 45.4 55.1001 43.3999 55.1001 41.2V19.5ZM33.295 56.3519C33.3 56.261 33.3 56.1737 33.3 56.1C33.3 55.9 33.3 55.8 33.4 55.8V55.6V55.3V55.1C33.3425 55.0425 33.3181 55.0181 33.3077 54.9886C33.3 54.9669 33.3 54.9425 33.3 54.9C33.3 54.8 33.2 54.7999 33.2 54.7C33.1 54.6 33.1001 54.6 33.1001 54.5C33.1001 54.5 33.0583 54.4583 33.0288 54.4019C33.0126 54.3708 33 54.3354 33 54.3C32.9 54.3 32.9 54.2 32.9 54.2C32.9 54.2 32.8 54.1 32.8 54C32.7 54 32.7 53.9 32.7 53.9C32.6499 53.8501 32.625 53.8 32.6 53.75C32.575 53.7 32.55 53.6499 32.5 53.6V53.5C31.6 52.3 30.3 51.6 28.8 51.6C27.4 51.6 26.1 52.2 25.3 53.2L7.5 42.9C7 42.6 6.6001 42 6.6001 41.3V22.9C6 23.1 5.30005 23.2 4.6001 23.2C3.90002 23.2 3.09998 23 2.40002 22.8V41.3C2.40002 43.5 3.5 45.5 5.40002 46.6L24.4 57.6C25 59.4 26.7 60.7 28.7 60.7C31 60.7 32.8 59 33.2 56.9V56.8C33.2632 56.6738 33.2865 56.5076 33.295 56.3519ZM43.8319 24.9475L41.345 29.2535L43.8319 33.5596C44.056 33.9475 44.056 34.4257 43.8319 34.8137L40.9828 39.7468C40.7588 40.1349 40.3446 40.3739 39.8964 40.3739H34.9225L32.4355 44.6801C32.2114 45.068 31.7972 45.3071 31.349 45.3071H25.651C25.2028 45.3071 24.7886 45.068 24.5645 44.6801L22.0775 40.374H17.1036C16.6554 40.374 16.2412 40.135 16.0172 39.7469L13.1681 34.8137C12.944 34.4257 12.944 33.9476 13.1681 33.5596L15.655 29.2535L13.1681 24.9475C12.944 24.5594 12.944 24.0814 13.1681 23.6934L16.0172 18.7603C16.2412 18.3722 16.6554 18.1331 17.1036 18.1331H22.0775L24.5645 13.827C24.7886 13.439 25.2028 13.2 25.651 13.2H31.349C31.7972 13.2 32.2114 13.439 32.4355 13.827L34.9225 18.1331H39.8964C40.3446 18.1331 40.7588 18.3722 40.9828 18.7603L43.8319 23.6932C44.056 24.0813 44.056 24.5594 43.8319 24.9475ZM17.828 37.8656H22.0775L24.2023 34.1866L22.0775 30.5077H17.828L15.7032 34.1866L17.828 37.8656ZM17.828 27.9994H22.0775L24.2023 24.3203L22.0775 20.6414H17.828L15.7032 24.3203L17.828 27.9994ZM26.3754 42.7987H30.6248L32.7495 39.1199L30.6248 35.4409H26.3754L24.2505 39.1199L26.3754 42.7987ZM26.3752 25.5746L24.2505 29.2535L26.3752 32.9325H30.6248L32.7495 29.2535L30.6248 25.5746H26.3752ZM26.3754 23.0662H30.6248L32.7495 19.3872L30.6246 15.7084H26.3752L24.2505 19.3872L26.3754 23.0662ZM34.9225 37.8656H39.172L41.2968 34.1866L39.172 30.5077H34.9225L32.7977 34.1866L34.9225 37.8656ZM34.9225 27.9994H39.172L41.2968 24.3204L39.172 20.6415H34.9225L32.7977 24.3204L34.9225 27.9994Z"
      fill="#eab308"
    />
  </svg>
);

export const AlertTriangleIcon = ({ className }: IconProps): ReactElement => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.2898 3.8602L1.81978 18.0002C1.46442 18.6156 1.4623 19.3734 1.8142 19.9907C2.16611 20.6081 2.81919 20.9924 3.52978 21.0002H20.4698C21.1804 20.9924 21.8334 20.6081 22.1854 19.9907C22.5373 19.3734 22.5351 18.6156 22.1798 18.0002L13.7098 3.8602C13.3472 3.26249 12.6989 2.89746 11.9998 2.89746C11.3007 2.89746 10.6523 3.26249 10.2898 3.8602Z"
      {...DEFAULT_PATH_PROPS}
    />
    <path d="M12 9V13" {...DEFAULT_PATH_PROPS} />
    <path d="M12 17V18" {...DEFAULT_PATH_PROPS} />
  </svg>
);

export const PulseIcon = ({ className }: IconProps): ReactElement => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 16 16"
    height="16"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path d="M11.8 9L10 3H9L7.158 9.64 5.99 4.69h-.97L3.85 9H1v.99h3.23l.49-.37.74-2.7L6.59 12h1.03l1.87-7.04 1.46 4.68.48.36H15V9h-3.2z" />
  </svg>
);

export const DiffIcon = ({ className }: IconProps): ReactElement => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 16 16"
    height="16"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 3.5l.5-.5h5l.5.5v9l-.5.5h-5l-.5-.5v-9zM3 12h4V6H3v6zm0-7h4V4H3v1zm6.5-2h5l.5.5v9l-.5.5h-5l-.5-.5v-9l.5-.5zm.5 9h4v-2h-4v2zm0-4h4V4h-4v4z"
    />
  </svg>
);

export const PackageIcon = (
  props: IconProps & {
    size?: number;
  },
): ReactElement => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? 16}
    height={props.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    className={props.className}
  >
    <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
  </svg>
);
