import { withSessionProtection } from '@/components/authenticated-container';
import HistoryPage from '../history';

export const getServerSideProps = withSessionProtection();

export default HistoryPage;
