import NavSidebar from '../components/NavSidebar';
import ChatBot from '../components/ChatBot';

const ChatBotPage = () => {
  return (
    <div className="flex h-screen">
      <NavSidebar />
      <div className="flex-1 ml-20">
        <div className="h-full max-w-3xl mx-auto">
          <ChatBot />
        </div>
      </div>
    </div>
  );
};

export default ChatBotPage; 