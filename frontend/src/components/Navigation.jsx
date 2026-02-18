import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navigation() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className="nav">
      <div className="container">
        <Link to="/" className="nav-brand">
          The Human <span>Archive</span>
        </Link>
        <ul className="nav-links">
          <li><Link to="/" className={isActive('/')}>Tableau de bord</Link></li>
          <li><Link to="/archives" className={isActive('/archives')}>Archives</Link></li>
          <li><Link to="/territories" className={isActive('/territories')}>Territoires</Link></li>
          <li><Link to="/upload" className={isActive('/upload')}>Déposer</Link></li>
          <li>
            <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}
               style={{ cursor: 'pointer' }}>
              Déconnexion ({user?.full_name})
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
