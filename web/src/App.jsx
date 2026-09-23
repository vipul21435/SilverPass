import { Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { ApplicationPage } from './pages/ApplicationPage.jsx';
import { BookAppointmentPage } from './pages/BookAppointmentPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { NewApplicationPage } from './pages/NewApplicationPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { ServicesPage } from './pages/ServicesPage.jsx';
import { SignInPage } from './pages/SignInPage.jsx';
import { TrackPage } from './pages/TrackPage.jsx';

const guarded = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={guarded(<DashboardPage />)} />
        <Route path="/applications/new" element={guarded(<NewApplicationPage />)} />
        <Route path="/applications/:id" element={guarded(<ApplicationPage />)} />
        <Route path="/applications/:id/book" element={guarded(<BookAppointmentPage />)} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
