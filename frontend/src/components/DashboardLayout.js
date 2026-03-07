import React from 'react';
import Sidebar from './Sidebar';
import NotificationDropdown from './NotificationDropdown';
import LanguageSelector from './LanguageSelector';
import ThemeSelector from './ThemeSelector';
import { Button } from './ui/button';
import { Menu } from 'lucide-react';

const DashboardLayout = ({ children }) => {
  const [collapsed, setCollapsed] = React.useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, []);

  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712]">
      <Sidebar
        collapsed={mobileSidebarOpen ? false : collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      {/* Top Bar with Notifications */}
      <div className={`fixed top-0 right-0 z-30 transition-all duration-300 left-0 ${collapsed ? 'lg:left-20' : 'lg:left-64'}`}>
        <div className="h-16 bg-white/80 dark:bg-[#0a0f1a]/80 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 sm:px-6 backdrop-blur-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden text-gray-700 dark:text-gray-200"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center justify-end gap-2 ml-auto">
            <LanguageSelector />
            <ThemeSelector />
            <NotificationDropdown />
          </div>
        </div>
      </div>
      <div className={`transition-all duration-300 ml-0 ${collapsed ? 'lg:ml-20' : 'lg:ml-64'} pt-16`}>
        {children}
      </div>
    </div>
  );
};

export default DashboardLayout;