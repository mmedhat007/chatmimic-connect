import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getCurrentUser } from './services/firebase';
import Index from './pages/Index';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import GoogleCallback from './pages/GoogleCallback';
import Contacts from './pages/Contacts';
import PlatformSelect from './pages/PlatformSelect';
import ComingSoon from './pages/ComingSoon';
import BroadcastPage from './pages/BroadcastPage';
import ResetPassword from './pages/ResetPassword';
import AIAgentSetup from './components/AIAgentSetup';
import AgentDashboard from './pages/AgentDashboard';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const userUID = getCurrentUser();
  if (!userUID) {
    return <Navigate to="/login" />;
  }
  return <>{children}</>;
};

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/google-callback" element={<GoogleCallback />} />
        <Route path="/platform-select" element={
          <ProtectedRoute>
            <PlatformSelect />
          </ProtectedRoute>
        } />
        <Route path="/agent-setup" element={
          <ProtectedRoute>
            <AIAgentSetup />
          </ProtectedRoute>
        } />
        <Route path="/agent-dashboard" element={
          <ProtectedRoute>
            <AgentDashboard />
          </ProtectedRoute>
        } />
        <Route path="/" element={
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />
        <Route path="/contacts" element={
          <ProtectedRoute>
            <Contacts />
          </ProtectedRoute>
        } />
        <Route path="/broadcast" element={
          <ProtectedRoute>
            <BroadcastPage />
          </ProtectedRoute>
        } />
        <Route path="/coming-soon" element={<ComingSoon />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
};

export default App;
