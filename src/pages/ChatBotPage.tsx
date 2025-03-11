import NavSidebar from '../components/NavSidebar';
import ChatBot from '../components/ChatBot';

const ChatBotPage = () => {
  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex-1 ml-20">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">WhatsApp AI Assistant Setup</h1>
            <p className="text-lg text-gray-600">
              Design your perfect WhatsApp AI assistant that understands your business needs. Create custom responses, set up automated workflows, and deliver exceptional customer service - all through natural conversation.
            </p>
          </div>
          <div className="h-[600px] bg-white rounded-lg shadow-lg overflow-hidden">
            <ChatBot />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBotPage; 