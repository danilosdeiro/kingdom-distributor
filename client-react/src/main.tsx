import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as CapacitorApp } from '@capacitor/app';
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

const APP_LINK_HOST = 'meukingdom.vercel.app';

function handleIncomingAppUrl(urlString: string) {
  try {
    const url = new URL(urlString);
    if (url.hostname !== APP_LINK_HOST) return;

    const route = `${url.pathname}${url.search}${url.hash}`;
    if (route && route !== '/') {
      void router.navigate(route);
    }
  } catch (error) {
    console.warn('Invalid app link:', error);
  }
}

void CapacitorApp.getLaunchUrl().then((launchUrl) => {
  if (launchUrl?.url) {
    handleIncomingAppUrl(launchUrl.url);
  }
});

void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
  handleIncomingAppUrl(url);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
