import { withSessionProtection } from '@/lib/supertokens/guard';

export { default } from '../checks';

export const getServerSideProps = withSessionProtection();
