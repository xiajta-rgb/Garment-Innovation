import { createBrowserRouter } from 'react-router-dom';
import EditorLayout from '@/app/layouts/EditorLayout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <EditorLayout />,
  },
]);
