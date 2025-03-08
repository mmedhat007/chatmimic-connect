import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const ComingSoon = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <h1 className="text-4xl font-bold text-gray-800">Coming Soon</h1>
        <p className="text-lg text-gray-600">
          We're working hard to bring you Facebook and Instagram integration.
          Stay tuned for updates!
        </p>
        <button
          onClick={() => navigate('/platform-select')}
          className="inline-flex items-center px-4 py-2 text-[#09659c] hover:text-[#074e79] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Platform Selection
        </button>
      </div>
    </div>
  );
};

export default ComingSoon; 