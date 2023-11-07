import { ReactElement, useState } from 'react';
import clsx from 'clsx';
import { Button, Heading, HiveLink, Input, Link, ShineBackground } from '@/components/v2';
import { GitHubIcon, GoogleIcon, LinkedInIcon } from '@/components/v2/icon';

const IndexPage = (): ReactElement => {
  const [isLoginPage, setIsLoginPage] = useState(true);

  return (
    <div className="flex">
      <ShineBackground />

      <div
        className="
          flex h-screen
          w-1/3
          flex-col
          bg-gray-800/10 pb-[50px] pl-[30px] pr-[50px] pt-[30px]
        "
      >
        <GuildLink textClassName="flex-col" />
        <div className="mt-[50px] grow rounded-[30px] bg-gray-800/30" />
        <Heading size="2xl" className="mb-[5px] mt-[22px]">
          Hive
        </Heading>
        <p className="font-light text-gray-500">Open GraphQL Platform</p>
      </div>

      <div className="grow px-9 pb-9 pt-11">
        <div className="mx-auto flex w-[500px] flex-col">
          <HiveLink />
          <h2 className="mb-1 mt-20 text-2xl font-light text-white">
            {isLoginPage ? 'Log In' : 'Create an account'}
          </h2>
          <p className="font-light text-[#9b9b9b]">
            {isLoginPage ? "Don't Have An Account" : 'Already A Member'}?{' '}
            <Button
              variant="link"
              onClick={() => setIsLoginPage(prev => !prev)}
              className="font-light"
            >
              {isLoginPage ? 'Create Account' : 'Log In'}
            </Button>
          </p>
          <div className="my-5 flex gap-x-3.5">
            <Button size="large" block variant="secondary" title="Log in with GitHub">
              <GitHubIcon />
              <span className="grow">Continue with GitHub</span>
            </Button>
            <Button size="large" variant="secondary" title="Log in with Google">
              <GoogleIcon />
            </Button>
            <Button size="large" variant="secondary" title="Log in with LinkedIn">
              <LinkedInIcon />
            </Button>
          </div>
          <div className="mb-5 flex items-center">
            <hr className="grow border-gray-800" />
            <span className="px-5 text-sm font-medium text-gray-500">Or</span>
            <hr className="grow border-gray-800" />
          </div>
          <Input placeholder="Email" />
          <Input placeholder="Password" type="password" className="mb-1 mt-7" />
          <Link
            variant="primary"
            href="#"
            className={clsx('mb-11 ml-auto', !isLoginPage && 'invisible')}
          >
            Forgot password?
          </Link>
          <Button size="large" variant="primary" block>
            {isLoginPage ? 'Log In' : 'Create Account'}
          </Button>
          <GuildLink className="mx-auto mb-6 mt-20 opacity-10 transition hover:opacity-100" />
          <p className={clsx('mb-4 text-xs text-[#9b9b9b]', isLoginPage && 'invisible')}>
            Creating an account means you're okay with our{' '}
            <Link variant="primary" href="#">
              Terms of Service
            </Link>
            ,{' '}
            <Link variant="primary" href="#">
              Privacy Policy
            </Link>
            , and our default Notification Settings.
          </p>
          <p className="text-xs text-gray-800">
            This site is protected by reCAPTCHA and the Google Privacy Policy and Terms of Service
            apple
          </p>
        </div>
      </div>
    </div>
  );
};

const GuildLink = ({
  className,
  textClassName,
}: {
  className?: string;
  textClassName?: string;
}): ReactElement => (
  <a
    href="https://the-guild.dev"
    target="_blank"
    rel="noreferrer"
    title="The Guild website homepage"
    className={clsx('flex items-center', className)}
  >
    <svg
      width="34"
      height="37"
      viewBox="0 0 34 37"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M1.38036 13.5726C1.79761 13.7147 2.24265 13.7954 2.70718 13.7954C3.12443 13.7954 3.52689 13.7314 3.90696 13.6158V24.6009C3.90696 24.9891 4.11414 25.3507 4.44837 25.5448L14.9547 31.6536C15.4517 31.0695 16.1877 30.6977 17.0096 30.6977C17.904 30.6977 18.6955 31.1382 19.1889 31.8132C19.1976 31.8256 19.207 31.8372 19.2157 31.8492C19.2503 31.8986 19.2828 31.9492 19.3142 32.0011L19.3503 32.0604C19.3781 32.1084 19.4037 32.1571 19.4282 32.2065C19.4416 32.233 19.4542 32.2599 19.4669 32.2868C19.4878 32.3326 19.5077 32.3792 19.5264 32.4264C19.5398 32.4602 19.5517 32.494 19.5636 32.5282C19.5788 32.5714 19.5936 32.6151 19.6062 32.659C19.6185 32.7008 19.6282 32.743 19.6387 32.7852L19.6657 32.904C19.6762 32.9567 19.6831 33.0102 19.6903 33.064C19.6943 33.096 19.7004 33.1272 19.7033 33.1592C19.7116 33.2464 19.7166 33.3344 19.7166 33.4238C19.7166 33.5663 19.7026 33.7048 19.6813 33.8415L19.6737 33.8924C19.4524 35.1729 18.3433 36.15 17.0096 36.15C15.8203 36.15 14.81 35.3725 14.4472 34.2966L3.18507 27.7487C2.06795 27.0995 1.38036 25.8992 1.38036 24.6009V13.5726ZM30.8608 6.88911C32.3536 6.88911 33.5678 8.11188 33.5678 9.61527C33.5678 10.4331 33.2069 11.1659 32.6388 11.6661V24.6009C32.6388 25.8992 31.9512 27.0995 30.8341 27.7487L21.1579 33.3744C21.1471 32.454 20.8381 31.6067 20.3256 30.9201L29.5708 25.5448C29.905 25.3507 30.1122 24.9891 30.1122 24.6009V12.2331C28.9828 11.9053 28.1537 10.857 28.1537 9.61527C28.1537 9.01079 28.3526 8.45356 28.6846 8.00102C28.6897 7.99375 28.6951 7.98684 28.7002 7.97957C28.763 7.89597 28.8301 7.81528 28.9016 7.73931L28.9113 7.72877C29.0597 7.57319 29.2257 7.43616 29.4069 7.31948C29.4257 7.30712 29.4455 7.29585 29.4646 7.28385C29.5365 7.2406 29.6097 7.19989 29.6855 7.16318C29.7076 7.15263 29.7296 7.141 29.752 7.13083C29.8469 7.08793 29.9436 7.04831 30.044 7.01669C30.0443 7.01669 30.0443 7.01669 30.0443 7.01633L30.2408 6.96179C30.44 6.91446 30.6475 6.88911 30.8608 6.88911ZM27.1611 12.7668V21.7828C27.1611 22.8507 26.5905 23.846 25.6722 24.3799V24.3803L18.4364 28.5826L17.7687 28.9512L17.7766 28.1798V24.9833L23.7322 21.5207V18.3496L18.6627 16.8968L27.1611 12.7668ZM6.85803 12.7614L10.287 14.4553V21.5204L16.1523 24.9307V28.9182L8.34692 24.3804C7.42868 23.846 6.85803 22.8508 6.85803 21.7829V12.7614ZM15.5206 6.67294C16.4248 6.1477 17.5942 6.1477 18.4984 6.67294L26.4366 11.3107L25.6822 11.6702L22.7373 13.1252L17.0095 9.79495L11.2817 13.1252L7.59429 11.3031L8.30282 10.8734C8.30931 10.8676 8.32772 10.8552 8.34757 10.844L15.5206 6.67294ZM17.0095 0C17.6328 0 18.2558 0.162116 18.8142 0.486712L28.5477 6.14624C27.8313 6.63259 27.2769 7.33958 26.9719 8.16761L17.5509 2.69055C17.3866 2.59459 17.1993 2.54443 17.0095 2.54443C16.8196 2.54443 16.6326 2.59459 16.468 2.69055L5.37084 9.14285C5.39755 9.2966 5.41415 9.45363 5.41415 9.61538C5.41415 10.7884 4.6735 11.7876 3.63939 12.1714C3.63145 12.1743 3.62315 12.1776 3.61521 12.1802C3.53327 12.2096 3.45026 12.2351 3.36508 12.2565L3.31418 12.2696C3.23622 12.2878 3.15645 12.3019 3.07632 12.3132L3.01099 12.323C2.91101 12.3343 2.80994 12.3416 2.70708 12.3416C2.59699 12.3416 2.4887 12.3328 2.3815 12.3197C2.35263 12.3161 2.32448 12.311 2.29596 12.3067C2.21367 12.2939 2.13281 12.2776 2.05305 12.2576C2.0285 12.2514 2.00396 12.2456 1.97941 12.2387C1.76826 12.1787 1.56758 12.0955 1.38025 11.989L1.21935 11.8898C0.485782 11.4019 0 10.5653 0 9.61538C0 8.11199 1.21457 6.88921 2.70708 6.88921C3.09437 6.88921 3.46181 6.97282 3.79496 7.12076L15.2047 0.486712C15.7631 0.162116 16.3865 0 17.0095 0Z" />
    </svg>

    <div className={clsx('ml-2 flex gap-1', textClassName)}>
      <svg
        width="31"
        height="11"
        viewBox="0 0 31 11"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M0.313477 2.77294H3.57946V10.6541H6.26751V2.77294H9.53349V0.163818H0.313477V2.77294Z" />
        <path d="M17.8588 0.163818V4.23889H13.5848V0.163818H10.9102V10.6541H13.5848V6.75386H17.8588V10.6541H20.5468V0.163818H17.8588Z" />
        <path d="M22.568 10.6541H30.6187V8.05842H25.2561V6.71352H29.6645V4.27923H25.2561V2.77294H30.6187V0.163818H22.568V10.6541Z" />
      </svg>

      <svg
        width="47"
        height="11"
        viewBox="0 0 47 11"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M5.53497 6.91933H8.05247V7.20426C7.55963 7.90361 6.76042 8.35689 5.82801 8.35689C4.25624 8.35689 3.00414 7.1395 3.00414 5.61129C3.00414 4.08308 4.25624 2.86568 5.82801 2.86568C6.73378 2.86568 7.53299 3.26716 8.05247 3.90176L10.2237 2.47716C9.22464 1.20796 7.61291 0.36615 5.82801 0.36615C2.81766 0.36615 0.313477 2.72323 0.313477 5.61129C0.313477 8.49935 2.81766 10.8564 5.82801 10.8564C6.89362 10.8564 7.94591 10.4679 8.45208 9.71674V10.6622H10.5433V4.76948H5.53497V6.91933Z" />
        <path d="M19.0352 0.560414V6.09047C19.0352 7.55393 18.3026 8.35689 16.904 8.35689C15.5187 8.35689 14.7994 7.55393 14.7994 6.09047V0.560414H12.1354V6.24588C12.1354 8.84903 13.7871 10.8564 16.904 10.8564C20.0076 10.8564 21.6859 8.84903 21.6859 6.24588V0.560414H19.0352Z" />
        <path d="M23.5364 0.560414V10.6622H26.2004V0.560414H23.5364Z" />
        <path d="M28.1958 10.6622H35.8283V8.16263H30.8465V0.560414H28.1958V10.6622Z" />
        <path d="M37.1999 10.6622H42.0218C45.2719 10.6622 46.937 8.36984 46.937 5.61129C46.937 2.86569 45.2719 0.560414 42.0218 0.560414H37.1999V10.6622ZM41.822 3.0729C43.4071 3.0729 44.2463 4.09603 44.2463 5.61129C44.2463 7.12655 43.4071 8.16263 41.822 8.16263H39.864V3.0729H41.822Z" />
      </svg>
    </div>
  </a>
);

export default IndexPage;
