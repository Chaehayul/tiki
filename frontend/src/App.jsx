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

function App() {
  return (
    <Routes>
      <Route path="/create-project" element={<CreateProject />} />
      <Route path="/project-list" element={<ProjectList />} />
      <Route path="/project/:projectId/meetings" element={<ProjectMeetings />} />
      <Route path="/meeting-create" element={<MeetingMinutesCreate />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/upload" element={<FileUploader />} />
      <Route path="/configuration" element={<Configuration />} />
      <Route path="/meeting-detail" element={<MeetingMinutesDetail />} />
      <Route path="/mypage" element={<MyPage />} />
      <Route path="/landing" element={<Landingpage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
