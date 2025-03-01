
import { useState } from 'react';
import { MessageSquare, BarChart, Menu } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const NavSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className={`bg-whatsapp-teal-green-dark text-white transition-all duration-300 flex flex-col ${collapsed ? 'w-16' : 'w-20'}`}>
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-4 hover:bg-whatsapp-teal-green text-center"
      >
        <Menu size={24} />
      </button>
      
      {/* Navigation items */}
      <div className="flex-1 flex flex-col items-center pt-6 gap-8">
        <Link 
          to="/"
          className={`p-3 rounded-lg transition-colors ${
            location.pathname === '/' 
              ? 'bg-whatsapp-teal-green' 
              : 'hover:bg-whatsapp-teal-green'
          }`}
        >
          <MessageSquare size={24} />
          {!collapsed && (
            <span className="text-xs mt-1 block">Chats</span>
          )}
        </Link>
        
        <Link 
          to="/analytics"
          className={`p-3 rounded-lg transition-colors ${
            location.pathname === '/analytics' 
              ? 'bg-whatsapp-teal-green' 
              : 'hover:bg-whatsapp-teal-green'
          }`}
        >
          <BarChart size={24} />
          {!collapsed && (
            <span className="text-xs mt-1 block">Analytics</span>
          )}
        </Link>
      </div>
    </div>
  );
};

export default NavSidebar;
