import { Outlet } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';

export default function Layout() {
  const { session, logout } = useSession();

  return (
    <div className="app-layout">
      <nav className="app-nav">
        <span className="app-nav__title">정성을 보여줘</span>
        {session && (
          <button type="button" onClick={logout}>
            로그아웃
          </button>
        )}
      </nav>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
