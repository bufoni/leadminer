import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { LayoutDashboard, TrendingUp, Search, List, Users, Settings, LogOut, Plus } from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
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
    <div className="w-64 bg-gray-900/50 border-r border-white/5 h-screen fixed left-0 top-0 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <h1 className="text-2xl font-bold text-gradient">LeadMiner</h1>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
            <span className="text-violet-400 font-semibold">{user?.name?.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{user?.name}</div>
            <div className="text-xs text-gray-400 capitalize">{user?.plan}</div>
          </div>
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
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium">{item.label}</span>
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
          className="w-full justify-start text-gray-400 hover:text-white hover:bg-white/5"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sair
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;