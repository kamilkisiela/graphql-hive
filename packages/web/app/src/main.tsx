import 'regenerator-runtime/runtime';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import './index.css';
import { router } from './router';

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

Error.stackTraceLimit = 15;

ReactDOM.createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
