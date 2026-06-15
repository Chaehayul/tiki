import { Navigate, Route, Routes } from 'react-router-dom'
import FileUploader from './pages/FileUploader'
import MeetingMinutesDetail from './pages/MeetingMinutesDetail'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/upload" replace />} />
      <Route path="/upload" element={<FileUploader />} />
      <Route path="/meeting-detail" element={<MeetingMinutesDetail />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="*" element={<Navigate to="/upload" replace />} />
    </Routes>
  );
};

export default App;
