// src/main.tsx

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Home } from './components/Home.tsx';
import { Lobby } from './components/Lobby.tsx';
import { RoleView } from './components/RoleView.tsx'; // A importação já deveria estar aqui, mas confirme.

// Aqui definimos nosso mapa de rotas
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        path: '/',
        element: <Home />,
      },
      {
        path: '/lobby/:codigo',
        element: <Lobby />,
      },
      // --- A ROTA QUE FALTAVA FOI ADICIONADA AQUI ---
      {
        path: '/role',
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