import { withSessionProtection } from '@/lib/supertokens/guard';
import HistoryPage from '../history';

export const getServerSideProps = withSessionProtection();

export default HistoryPage;
