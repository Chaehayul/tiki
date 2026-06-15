import { Navigate, Route, Routes } from 'react-router-dom'
import FileUploader from './pages/FileUploader'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/upload" replace />} />
      <Route path="/upload" element={<FileUploader />} />
      <Route path="*" element={<Navigate to="/upload" replace />} />
    </Routes>
  )
}

export default App
