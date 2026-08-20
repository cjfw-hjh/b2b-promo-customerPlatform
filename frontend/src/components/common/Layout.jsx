import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../../hooks/useSession';

// 6-wireframe.md 공통 레이아웃 원칙: 역할별 우측 메뉴 구성.
// 거래처 Know-how(P1, FE-11)는 거래처를 먼저 골라야 진입하는 화면이라 고정 메뉴 링크를 두지 않는다.
const NAV_ITEMS = {
  salesperson: [
    { to: '/salesperson/logs/new', label: '일지 작성' },
    { to: '/salesperson/logs', label: '내 일지 조회' },
  ],
  manager: [
    { to: '/manager/logs', label: '팀원 일지 목록' },
    { to: '/manager/comments', label: '내 코멘트 이력' },
  ],
};

export default function Layout() {
  const { session, logout } = useSession();
  const navItems = session ? NAV_ITEMS[session.role] ?? [] : [];

  return (
    <div className="app-layout">
      <nav className="app-nav">
        <span className="app-nav__title">정성을 보여줘</span>
        <div className="app-nav__menu">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
          {session && (
            <button type="button" onClick={logout}>
              로그아웃
            </button>
          )}
        </div>
      </nav>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
