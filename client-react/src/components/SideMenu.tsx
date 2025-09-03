import './SideMenu.css';
import { FAQ } from './FAQ';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SideMenu({ isOpen, onClose }: SideMenuProps) {
  return (
    <div className={`sidemenu-container ${isOpen ? 'open' : ''}`}>
      <div className="sidemenu-backdrop" onClick={onClose}></div>
      <div className="sidemenu-content">
        <FAQ />
      </div>
    </div>
  );
}