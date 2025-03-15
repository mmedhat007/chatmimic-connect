import { useState } from 'react';
import { MessageSquare, BarChart2, Menu, LogOut, Bot, Settings, Users, Send, Grid, Database } from 'lucide-react';
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

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="fixed left-0 top-0 h-screen w-16 flex flex-col items-center py-4 bg-white border-r">
      <Link to="/" className="mb-8">
        <img
          src="/original icon.png"
          alt="ChatMimic"
          className="w-10 h-10"
          style={{ objectFit: 'contain' }}
        />
      </Link>

      <nav className="flex-1 flex flex-col items-center space-y-4">
        <Link
          to="/"
          className={`p-3 rounded-lg transition-colors ${
            isActive('/') ? 'bg-[#e6f3f8] text-[#09659c]' : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Chat"
        >
          <MessageSquare size={20} />
        </Link>

        <Link
          to="/agent-setup"
          className={`p-3 rounded-lg transition-colors ${
            isActive('/agent-setup') ? 'bg-[#e6f3f8] text-[#09659c]' : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Setup Agent"
        >
          <Bot size={20} />
        </Link>

        <Link
          to="/knowledge-base"
          className={`p-3 rounded-lg transition-colors ${
            isActive('/knowledge-base') ? 'bg-[#e6f3f8] text-[#09659c]' : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Knowledge Base"
        >
          <Database size={20} />
        </Link>

        <Link
          to="/contacts"
          className={`p-3 rounded-lg transition-colors ${
            isActive('/contacts') ? 'bg-[#e6f3f8] text-[#09659c]' : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Contacts"
        >
          <Users size={20} />
        </Link>

        <Link
          to="/broadcast"
          className={`p-3 rounded-lg transition-colors ${
            isActive('/broadcast') ? 'bg-[#e6f3f8] text-[#09659c]' : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Broadcast"
        >
          <Send size={20} />
        </Link>

        <Link
          to="/analytics"
          className={`p-3 rounded-lg transition-colors ${
            isActive('/analytics') ? 'bg-[#e6f3f8] text-[#09659c]' : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Analytics"
        >
          <BarChart2 size={20} />
        </Link>

        <Link
          to="/settings"
          className={`p-3 rounded-lg transition-colors ${
            isActive('/settings') ? 'bg-[#e6f3f8] text-[#09659c]' : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Settings"
        >
          <Settings size={20} />
        </Link>
      </nav>

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
