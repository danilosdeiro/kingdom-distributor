import { Outlet } from 'react-router-dom';
import { Footer } from './components/footer';
function App() {
  return (
    <div className="app-layout">
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default App;