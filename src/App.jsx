import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Cover from './pages/Cover';
import Home from './pages/Home';
import Camera from './pages/Camera';
import Gallery from './pages/Gallery';
import PhotoDetail from './pages/PhotoDetail';
import Missions from './pages/Missions';
import Leaderboard from './pages/Leaderboard';
import Slideshow from './pages/Slideshow';
import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminPhotos from './pages/admin/Photos';
import AdminMissions from './pages/admin/Missions';
import ProtectedRoute from './pages/admin/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                   element={<Cover />} />
        <Route path="/home"               element={<Home />} />
        <Route path="/camera"             element={<Camera />} />
        <Route path="/gallery"            element={<Gallery />} />
        <Route path="/gallery/:photoId"   element={<PhotoDetail />} />
        <Route path="/missions"           element={<Missions />} />
        <Route path="/leaderboard"        element={<Leaderboard />} />
        <Route path="/slideshow"          element={<Slideshow />} />
        <Route path="/admin"              element={<AdminLogin />} />
        <Route path="/admin/dashboard"    element={<AdminDashboard />} />
        <Route path="/admin/photos"        element={<ProtectedRoute><AdminPhotos /></ProtectedRoute>} />
        <Route path="/admin/missions"      element={<ProtectedRoute><AdminMissions /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
