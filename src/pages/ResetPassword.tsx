import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resetPassword } from '../services/firebase';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (error: any) {
      setError(error.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[#09659c] px-6 py-8 text-center">
          <h2 className="text-3xl font-bold text-white">Reset Password</h2>
          <p className="mt-2 text-gray-100">
            Enter your email to receive a password reset link
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

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm">
                Password reset email sent! Please check your inbox.
              </div>
            )}

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

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-[#09659c] text-white py-2 px-4 rounded-lg hover:bg-[#074e79] transition-colors focus:outline-none focus:ring-2 focus:ring-[#09659c] focus:ring-offset-2 ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          {/* Back to login link */}
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <button
                onClick={() => navigate('/login')}
                className="font-medium text-[#09659c] hover:text-[#074e79]"
              >
                Sign in
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

export default ResetPassword; 