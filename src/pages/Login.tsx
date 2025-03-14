import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/firebase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await loginUser(email, password);
      navigate('/platform-select');
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[#09659c] px-6 py-8 text-center">
          <h2 className="text-3xl font-bold text-white">Welcome Back</h2>
          <p className="mt-2 text-gray-100">
            Sign in to your account to continue
          </p>
        </div>

        {/* Form */}
        <div className="p-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#09659c] focus:border-[#09659c] transition-colors"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#09659c] focus:border-[#09659c] transition-colors"
                  placeholder="Enter your password"
                />
                <div className="mt-1 text-right">
                  <button
                    type="button"
                    onClick={() => navigate('/reset-password')}
                    className="text-sm text-[#09659c] hover:text-[#074e79]"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#09659c] text-white py-2 px-4 rounded-lg hover:bg-[#074e79] transition-colors focus:outline-none focus:ring-2 focus:ring-[#09659c] focus:ring-offset-2"
            >
              Sign In
            </button>
          </form>

          {/* Sign up link */}
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/signup')}
                className="font-medium text-[#09659c] hover:text-[#074e79]"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* DenoteAI Branding */}
      <div className="mt-8 text-center">
        <p className="text-gray-500 text-sm">
          Powered by{' '}
          <span className="font-semibold text-whatsapp-teal-green">DenoteAI</span>
        </p>
      </div>
    </div>
  );
};

export default Login; 