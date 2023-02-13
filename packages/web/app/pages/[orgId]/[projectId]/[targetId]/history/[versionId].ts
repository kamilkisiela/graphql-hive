import { withSessionProtection } from '@/lib/supertokens/guard';

export { default } from '../history';

export const getServerSideProps = withSessionProtection();
