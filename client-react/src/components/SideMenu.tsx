import './SideMenu.css';
import { FAQ } from './FAQ';
import logoCoroa from '../assets/Coroa2.png';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SideMenu({ isOpen, onClose }: SideMenuProps) {
  return (
    <div className={`sidemenu-container ${isOpen ? 'open' : ''}`}>
      <div className="sidemenu-backdrop" onClick={onClose}></div>
      <div className="sidemenu-content">

        <div className="sidemenu-header">
          <img src={logoCoroa} alt="Logo Meu Kingdom" className="sidemenu-logo" />
        </div>
      
        <FAQ />
      </div>
    </div>
  );
}