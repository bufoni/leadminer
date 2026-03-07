import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { LayoutDashboard, TrendingUp, Search, List, Users, Settings, LogOut, Plus, ChevronLeft, ChevronRight, Shield, X } from 'lucide-react';

const Sidebar = ({ collapsed, onToggleCollapse, mobileOpen, onMobileClose }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    if (onMobileClose) onMobileClose();
    navigate('/');
  };

  const menuItems = [
    { path: '/dashboard', label: t('sidebar.dashboard'), labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
    { path: '/analytics', label: t('sidebar.analytics'), labelKey: 'sidebar.analytics', icon: TrendingUp },
    { path: '/search', label: t('sidebar.newSearch'), labelKey: 'sidebar.newSearch', icon: Plus },
    { path: '/searches', label: t('sidebar.searches'), labelKey: 'sidebar.searches', icon: List },
    { path: '/leads', label: t('sidebar.leads'), labelKey: 'sidebar.leads', icon: Users },
    { path: '/settings', label: t('sidebar.settings'), labelKey: 'sidebar.settings', icon: Settings },
  ];

  const adminMenuItems = user?.role === 'admin' ? [
    { path: '/admin', label: t('sidebar.admin'), labelKey: 'sidebar.admin', icon: Shield, isAdmin: true },
  ] : [];

  const isActive = (path) => location.pathname === path;

  return (
    <div 
      className={`bg-white dark:bg-gray-900/95 border-r border-gray-200 dark:border-white/5 h-dvh fixed left-0 top-0 flex flex-col transition-all duration-300 z-50 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 ${
        collapsed
          ? 'w-[min(280px,78vw)] lg:w-20'
          : 'w-[min(280px,78vw)] lg:w-64'
      }`}
    >
      {/* Logo - click goes to home */}
      <div className="p-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between gap-2 min-h-[3.5rem]">
        <Link
          to="/"
          className={`flex items-center min-w-0 ${collapsed ? 'justify-center flex-1' : 'gap-3'}`}
          title="Ir para o início"
        >
          <span className="flex shrink-0 w-8 h-8 items-center justify-center overflow-hidden rounded">
            <img
              src="https://static.prod-images.emergentagent.com/jobs/303cf839-62ca-4b43-8c31-9c5fe9bec8e9/images/64a5a31919abdae9ff3732c8bdff9a51f971ae3cb297e25197ec7ab583a76e76.png"
              alt="LeadMiner Logo"
              className="h-8 w-8 object-contain"
              width={32}
              height={32}
              loading="lazy"
              decoding="async"
            />
          </span>
          {!collapsed && <h1 className="text-xl font-bold text-gradient truncate">LeadMiner</h1>}
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          className="hidden lg:inline-flex text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-1"
          data-testid="sidebar-toggle"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileClose}
          className="lg:hidden text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* User Info - click goes to Settings > Perfil */}
      <Link
        to="/settings?tab=profile"
        className="block p-4 border-b border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        title="Ver perfil"
        onClick={onMobileClose}
      >
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="relative">
            {user?.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user?.name ?? ''} 
                className="w-10 h-10 rounded-full object-cover"
                width={40}
                height={40}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                <span className="text-violet-400 font-semibold">{user?.name?.charAt(0)}</span>
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.plan}</div>
            </div>
          )}
        </div>
      </Link>

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
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? item.label : ''}
              onClick={onMobileClose}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}

        {/* Admin Section */}
        {adminMenuItems.length > 0 && (
          <>
            {!collapsed && (
              <div className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide px-4 pt-4 pb-2">
                Administração
              </div>
            )}
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  data-testid={`sidebar-${item.label.toLowerCase()}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive(item.path)
                      ? 'bg-red-600 text-white'
                      : 'text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-white'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? item.label : ''}
                  onClick={onMobileClose}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200 dark:border-white/5">
        <Button
          data-testid="sidebar-logout"
          onClick={handleLogout}
          variant="ghost"
          className={`w-full justify-start text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title={collapsed ? 'Sair' : ''}
        >
          <LogOut className={`h-5 w-5 ${collapsed ? '' : 'mr-3'}`} />
          {!collapsed && t('sidebar.logout')}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;