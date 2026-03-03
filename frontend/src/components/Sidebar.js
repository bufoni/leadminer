import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { LayoutDashboard, TrendingUp, Search, List, Users, Settings, LogOut, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleSidebar = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', newState.toString());
  };

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/analytics', label: 'Analytics', icon: TrendingUp },
    { path: '/search', label: 'Nova Busca', icon: Plus },
    { path: '/searches', label: 'Buscas', icon: List },
    { path: '/leads', label: 'Leads', icon: Users },
    { path: '/settings', label: 'Configurações', icon: Settings },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div 
      className={`bg-gray-900/50 border-r border-white/5 h-screen fixed left-0 top-0 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <img 
              src="https://static.prod-images.emergentagent.com/jobs/303cf839-62ca-4b43-8c31-9c5fe9bec8e9/images/64a5a31919abdae9ff3732c8bdff9a51f971ae3cb297e25197ec7ab583a76e76.png" 
              alt="LeadMiner Logo" 
              className="w-8 h-8"
            />
            <h1 className="text-xl font-bold text-gradient">LeadMiner</h1>
          </div>
        )}
        {collapsed && (
          <img 
            src="https://static.prod-images.emergentagent.com/jobs/303cf839-62ca-4b43-8c31-9c5fe9bec8e9/images/64a5a31919abdae9ff3732c8bdff9a51f971ae3cb297e25197ec7ab583a76e76.png" 
            alt="LeadMiner" 
            className="w-8 h-8 mx-auto"
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="text-gray-400 hover:text-white p-1"
          data-testid="sidebar-toggle"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-white/5">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="relative">
            {user?.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user?.name} 
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                <span className="text-violet-400 font-semibold">{user?.name?.charAt(0)}</span>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.name}</div>
              <div className="text-xs text-gray-400 capitalize">{user?.plan}</div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`sidebar-${item.label.toLowerCase().replace(' ', '-')}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive(item.path)
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? item.label : ''}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-white/5">
        <Button
          data-testid="sidebar-logout"
          onClick={handleLogout}
          variant="ghost"
          className={`w-full justify-start text-gray-400 hover:text-white hover:bg-white/5 ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title={collapsed ? 'Sair' : ''}
        >
          <LogOut className={`h-5 w-5 ${collapsed ? '' : 'mr-3'}`} />
          {!collapsed && 'Sair'}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;