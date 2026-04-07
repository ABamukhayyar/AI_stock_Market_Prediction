import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoginPage from './Pages/LoginPage';
import Dashboard from './Pages/Dashboard';
import AllStocks from './Pages/AllStocks';
import StockDetail from './Pages/StockDetail';
import SignUp from './Pages/SignUp';
import ForgotPassword from './Pages/ForgotPassword';
import { ThemeProvider } from './components/Layout';
import { LanguageProvider } from './LanguageContext';
import Profile from './Profile';
import Settings from './Settings';
import HelpPage from './Pages/HelpPage';
import SupportPage from './Pages/SupportPage';
import LegalPage from './Pages/LegalPage';
import NotFoundPage from './Pages/NotFoundPage';
import AboutPage from './Pages/AboutPage';
import WatchlistPage from './Pages/WatchlistPage';
import { isAuthenticated } from './utils/auth';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function ProtectedRoute() {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/stocks" element={<AllStocks />} />
              <Route path="/stock/:id" element={<StockDetail />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="/help" element={<HelpPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<LegalPage variant="privacy" />} />
            <Route path="/terms" element={<LegalPage variant="terms" />} />
            <Route path="/SignUp" element={<Navigate to="/signup" replace />} />
            <Route path="/Dashboard" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
