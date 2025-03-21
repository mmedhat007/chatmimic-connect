import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getCurrentUser } from './services/firebase';
import { Toaster } from 'react-hot-toast';
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
import AgentSetupPage from './pages/AgentSetupPage';
import AutomationsPage from './pages/AutomationsPage';
import WhatsAppSetup from './pages/WhatsAppSetup';
import GoogleSheetsPage from './pages/GoogleSheetsPage';
import LifecycleTaggingPage from './pages/LifecycleTaggingPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const user = getCurrentUser();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const App = () => {
  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/platform-select"
          element={
            <ProtectedRoute>
              <PlatformSelect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/coming-soon"
          element={
            <ProtectedRoute>
              <ComingSoon />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts"
          element={
            <ProtectedRoute>
              <Contacts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent-setup"
          element={
            <ProtectedRoute>
              <AgentSetupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/whatsapp-setup"
          element={
            <ProtectedRoute>
              <WhatsAppSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/automations"
          element={
            <ProtectedRoute>
              <AutomationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/broadcast"
          element={
            <ProtectedRoute>
              <BroadcastPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/google-sheets"
          element={
            <ProtectedRoute>
              <GoogleSheetsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lifecycle-tagging"
          element={
            <ProtectedRoute>
              <LifecycleTaggingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/google-callback"
          element={
            <ProtectedRoute>
              <GoogleCallback />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
};

export default App;
