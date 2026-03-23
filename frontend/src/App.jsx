import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Project from './pages/Project';
import Upload from './pages/Upload';
import VideoStatus from './pages/VideoStatus';

export default function App() {
  return (
    <div className="min-h-screen bg-surface text-slate-200">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/project/:id" element={<Project />} />
        <Route path="/project/:id/upload" element={<Upload />} />
        <Route path="/video/:id" element={<VideoStatus />} />
      </Routes>
    </div>
  );
}
