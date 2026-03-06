import React from 'react';
import Sidebar from './Sidebar';
import NotificationDropdown from './NotificationDropdown';
import LanguageSelector from './LanguageSelector';
import ThemeSelector from './ThemeSelector';

const DashboardLayout = ({ children }) => {
  const [collapsed, setCollapsed] = React.useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  React.useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem('sidebar-collapsed');
      setCollapsed(saved === 'true');
    };
    window.addEventListener('storage', handleStorage);
    // Also listen for custom event
    const interval = setInterval(() => {
      const saved = localStorage.getItem('sidebar-collapsed');
      if ((saved === 'true') !== collapsed) {
        setCollapsed(saved === 'true');
      }
    }, 100);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712]">
      <Sidebar />
      {/* Top Bar with Notifications */}
      <div className={`fixed top-0 right-0 z-40 transition-all duration-300 ${collapsed ? 'left-20' : 'left-64'}`}>
        <div className="h-16 bg-white/80 dark:bg-[#0a0f1a]/80 border-b border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2 px-6 backdrop-blur-sm">
          <LanguageSelector />
          <ThemeSelector />
          <NotificationDropdown />
        </div>
      </div>
      <div className={`transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-64'} pt-16`}>
        {children}
      </div>
    </div>
  );
};

export default DashboardLayout;