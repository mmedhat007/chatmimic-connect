import { useState } from 'react';
import { MessageSquare, BarChart, Menu, LogOut, Bot, Settings, Users } from 'lucide-react';
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

  const navItems = [
    { icon: MessageSquare, text: 'Chats', path: '/' },
    { icon: Users, text: 'Contacts', path: '/contacts' },
    { icon: BarChart, text: 'Analytics', path: '/analytics' },
    { icon: Bot, text: 'Assistant', path: '/chatbot' },
    { icon: Settings, text: 'Settings', path: '/settings' },
  ];

  return (
    <div className="bg-[#09659c] text-white h-screen w-16 flex flex-col fixed">
      {/* Navigation items */}
      <div className="flex flex-col items-center pt-6 gap-6">
        {navItems.slice(0, -1).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`p-3 rounded-lg transition-colors mx-2 flex justify-center ${
              location.pathname === item.path
                ? 'bg-[#074e79]'
                : 'hover:bg-[#074e79]'
            }`}
            title={item.text}
          >
            <item.icon size={24} />
          </Link>
        ))}
      </div>

      {/* Bottom section with Settings and Logout */}
      <div className="mt-auto flex flex-col items-center gap-4 pb-4">
        <Link
          to="/settings"
          className={`p-3 rounded-lg transition-colors mx-2 flex justify-center ${
            location.pathname === '/settings'
              ? 'bg-[#074e79]'
              : 'hover:bg-[#074e79]'
          }`}
          title="Settings"
        >
          <Settings size={24} />
        </Link>

        <button
          onClick={handleLogout}
          className="p-3 rounded-lg hover:bg-[#074e79] transition-colors mx-2 flex justify-center"
          title="Logout"
        >
          <LogOut size={24} />
        </button>
      </div>
    </div>
  );
};

export default NavSidebar;
