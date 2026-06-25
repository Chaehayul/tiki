import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom'
import FileUploader from './pages/FileUploader'
import Dashboard from './pages/Dashboard'
import Configuration from './pages/Configuration'
import MeetingMinutesDetail from './pages/MeetingMinutesDetail'
import LoginPage from './pages/Login';
import SignUpPage from './pages/SignUp';
import CreateProject from './pages/CreateProject';
import ProjectList from './pages/ProjectList';
import ProjectMeetings from './pages/ProjectMeetings';
import MeetingMinutesCreate from './pages/MeetingMinutesCreate';
import MyPage from './pages/Mypage';
import Landingpage from './pages/Landingpage';
import OnboardingPage from './pages/Onboarding';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(localStorage.getItem('tiki_access_token')));

  useEffect(() => {
    const syncAuthSession = () => {
      setIsAuthenticated(Boolean(localStorage.getItem('tiki_access_token')));
    };

    window.addEventListener('storage', syncAuthSession);
    window.addEventListener('tiki-auth-changed', syncAuthSession);

    return () => {
      window.removeEventListener('storage', syncAuthSession);
      window.removeEventListener('tiki-auth-changed', syncAuthSession);
    };
  }, []);

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? '/upload' : '/onboarding'} replace />}
      />
      <Route path="/create-project" element={<CreateProject />} />
      <Route path="/project-list" element={<ProjectList />} />
      <Route path="/project/:projectId/meetings" element={<ProjectMeetings />} />
      <Route path="/meeting-create" element={<MeetingMinutesCreate />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route
        path="/upload"
        element={
          isAuthenticated ? (
            <FileUploader />
          ) : (
            <Navigate to="/onboarding" replace state={{ from: '/upload' }} />
          )
        }
      />
      <Route path="/configuration" element={<Configuration />} />
      <Route path="/meeting-detail" element={<MeetingMinutesDetail />} />
      <Route
        path="/mypage"
        element={
          isAuthenticated ? (
            <MyPage />
          ) : (
            <Navigate to="/onboarding" replace state={{ from: '/mypage' }} />
          )
        }
      />
      <Route path="/landing" element={<Landingpage />} />
      <Route
        path="/onboarding"
        element={
          isAuthenticated ? (
            <Navigate to="/upload" replace />
          ) : (
            <OnboardingPage />
          )
        }
      />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/upload" replace /> : <LoginPage />}
      />
      <Route
        path="/signup"
        element={isAuthenticated ? <Navigate to="/upload" replace /> : <SignUpPage />}
      />
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/upload' : '/onboarding'} replace />}
      />
    </Routes>
  );
};

export default App;
