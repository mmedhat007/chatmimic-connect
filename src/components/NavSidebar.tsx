import { useState } from 'react';
import { MessageSquare, BarChart, Menu, LogOut, Bot, Settings, Users, Send, Grid, Workflow } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logoutUser } from '../services/firebase';

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
  ];

  return (
    <div className="bg-chatmimic-blue text-white h-screen w-16 flex flex-col fixed">
      {/* Main navigation items */}
      <div className="flex flex-col items-center pt-6 gap-6">
        {mainNavItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`p-3 rounded-lg transition-colors mx-2 flex justify-center ${
              location.pathname === item.path
                ? 'bg-chatmimic-blue-dark'
                : 'hover:bg-chatmimic-blue-dark'
            }`}
            title={item.text}
          >
            <item.icon size={24} />
          </Link>
        ))}
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
