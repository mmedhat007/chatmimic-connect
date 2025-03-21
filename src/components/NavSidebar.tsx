import { useState } from 'react';
import { MessageSquare, BarChart, Menu, LogOut, Settings, Users, Send, Grid, Workflow } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logoutUser } from '../services/firebase';
import GoogleSheetsIcon from './icons/GoogleSheetsIcon';
import LifecycleIcon from './icons/LifecycleIcon';

const NavSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const mainNavItems = [
    { icon: MessageSquare, text: 'Chats', path: '/' },
    { icon: Users, text: 'Contacts', path: '/contacts' },
    { icon: Send, text: 'Broadcast', path: '/broadcast' },
    { icon: BarChart, text: 'Analytics', path: '/analytics' },
    { icon: Workflow, text: 'Automations', path: '/automations' },
    { 
      icon: GoogleSheetsIcon, 
      text: 'Google Sheets', 
      path: '/google-sheets',
      iconColor: '#0F9D58' // Google Sheets green color
    },
    { 
      icon: LifecycleIcon, 
      text: 'Lifecycle Tagging', 
      path: '/lifecycle-tagging',
      alwaysWhite: true // Always use white color for this icon
    },
  ];

  return (
    <div className="bg-chatmimic-blue text-white h-screen w-16 flex flex-col fixed">
      {/* Main navigation items */}
      <div className="flex flex-col items-center pt-6 gap-6">
        {mainNavItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`p-3 rounded-lg transition-colors mx-2 flex justify-center ${
                isActive
                  ? 'bg-chatmimic-blue-dark'
                  : 'hover:bg-chatmimic-blue-dark'
              }`}
              title={item.text}
            >
              {isActive || item.alwaysWhite ? (
                <IconComponent 
                  size={24} 
                  className="text-white"
                />
              ) : (
                <IconComponent 
                  size={24} 
                  color={item.iconColor || undefined}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom section with Platform Select, Settings and Logout */}
      <div className="mt-auto flex flex-col items-center gap-4 pb-4">
        <Link
          to="/platform-select"
          className={`p-3 rounded-lg transition-colors mx-2 flex justify-center ${
            location.pathname === '/platform-select'
              ? 'bg-chatmimic-blue-dark'
              : 'hover:bg-chatmimic-blue-dark'
          }`}
          title="Platforms"
        >
          <Grid size={24} />
        </Link>

        <Link
          to="/settings"
          className={`p-3 rounded-lg transition-colors mx-2 flex justify-center ${
            location.pathname === '/settings'
              ? 'bg-chatmimic-blue-dark'
              : 'hover:bg-chatmimic-blue-dark'
          }`}
          title="Settings"
        >
          <Settings size={24} />
        </Link>

        <button
          onClick={handleLogout}
          className="p-3 rounded-lg hover:bg-chatmimic-blue-dark transition-colors mx-2 flex justify-center"
          title="Logout"
        >
          <LogOut size={24} />
        </button>
      </div>
    </div>
  );
};

export default NavSidebar;
