import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Home } from './components/Home.tsx';
import { Lobby } from './components/Lobby.tsx';
import { RoleView } from './components/RoleView.tsx';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />, // Mantemos o App como o pai de todos
    children: [
      {
        // Esta é a rota da Home sem código (acesso normal)
        index: true, 
        element: <Home />,
      },
      {
        // Esta é a rota que captura o código (ex: /ABCD)
        path: ':codigoConvite', 
        element: <Home />,
      },
      {
        path: 'lobby/:codigo',
        element: <Lobby />,
      },
      {
        path: 'role',
        element: <RoleView />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)