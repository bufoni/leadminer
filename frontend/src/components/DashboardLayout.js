import React from 'react';
import Sidebar from './Sidebar';

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
    <div className="min-h-screen bg-[#030712]">
      <Sidebar />
      <div className={`transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-64'}`}>
        {children}
      </div>
    </div>
  );
};

export default DashboardLayout;