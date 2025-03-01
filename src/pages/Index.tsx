
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import NavSidebar from '../components/NavSidebar';
import { Contact } from '../types';
import { useIsMobile } from '../hooks/use-mobile';

const Index = () => {
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [showChat, setShowChat] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) {
      setShowChat(false);
    }
  }, [isMobile]);

  const handleSelectContact = (contact: Contact) => {
    setActiveContact(contact);
    if (isMobile) {
      setShowChat(true);
    }
  };

  const handleBack = () => {
    setShowChat(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl h-[calc(100vh-2rem)] bg-white shadow-xl rounded-lg overflow-hidden flex">
        {/* NavSidebar - only show on desktop */}
        {!isMobile && <NavSidebar />}
        
        {/* Sidebar - show on desktop or when chat is not shown on mobile */}
        {(!isMobile || !showChat) && (
          <div className={`${isMobile ? 'w-full' : 'w-1/3'} h-full`}>
            <Sidebar
              activeContact={activeContact}
              onSelectContact={handleSelectContact}
            />
          </div>
        )}
        
        {/* Chat Area - show on desktop or when chat is shown on mobile */}
        {(!isMobile || showChat) && (
          <div className={`${isMobile ? 'w-full' : 'w-2/3'} h-full chat-transition`}>
            <ChatArea
              contact={activeContact}
              onBack={handleBack}
              isMobile={isMobile}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
