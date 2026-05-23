/**
 * MainLayout — persistent app shell.
 *
 * Renders the top NavigationMenu and a <main> content area that hosts
 * the current route's page via React Router's <Outlet />.
 *
 * All pages that sit inside the auth/role-aware shell are nested under
 * this layout in routes.jsx.
 *
 * Source: docs/spec_brief.txt §6 Recommended Architecture, §15.1 Component Hierarchy
 */

import { Outlet } from 'react-router-dom';
import NavigationMenu from './NavigationMenu.jsx';

/**
 * MainLayout renders the shared application shell.
 *
 * @returns {JSX.Element}
 */
function MainLayout() {
  return (
    <div className="ems-layout">
      <NavigationMenu />
      <main className="ems-main">
        <Outlet />
      </main>
    </div>
  );
}

export default MainLayout;
