// src/App.tsx
import { Outlet } from 'react-router-dom';

function App() {
  // O Outlet renderiza o componente da rota atual (Home ou Lobby)
  return <Outlet />;
}

export default App;