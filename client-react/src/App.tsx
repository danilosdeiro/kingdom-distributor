// src/App.tsx
import { Outlet } from 'react-router-dom';

function App() {
  // Adicionamos uma div com uma classe para ser o nosso layout principal
  return (
    <main className="app-layout">
      <Outlet />
    </main>
  );
}

export default App;