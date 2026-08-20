import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SessionProvider } from './hooks/useSession';
import Layout from './components/common/Layout';
import RoleGuard from './components/common/RoleGuard';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import SalesLogFormPage from './pages/salesperson/SalesLogFormPage';
import SalesLogListPage from './pages/salesperson/SalesLogListPage';
import SalesLogDetailPage from './pages/salesperson/SalesLogDetailPage';
import CustomerKnowhowPage from './pages/salesperson/CustomerKnowhowPage';
import ManagedSalesLogListPage from './pages/manager/ManagedSalesLogListPage';
import SalesLogReviewPage from './pages/manager/SalesLogReviewPage';
import MyCommentHistoryPage from './pages/manager/MyCommentHistoryPage';

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/salesperson" element={<Navigate to="/salesperson/logs" replace />} />
          <Route path="/manager" element={<Navigate to="/manager/logs" replace />} />

          <Route element={<Layout />}>
            <Route element={<RoleGuard role="salesperson" />}>
              <Route path="/salesperson/logs" element={<SalesLogListPage />} />
              <Route path="/salesperson/logs/new" element={<SalesLogFormPage />} />
              <Route path="/salesperson/logs/:id" element={<SalesLogDetailPage />} />
              <Route path="/salesperson/logs/:id/edit" element={<SalesLogFormPage />} />
              <Route path="/salesperson/customers/:id/knowhow" element={<CustomerKnowhowPage />} />
            </Route>

            <Route element={<RoleGuard role="manager" />}>
              <Route path="/manager/logs" element={<ManagedSalesLogListPage />} />
              <Route path="/manager/logs/:id" element={<SalesLogReviewPage />} />
              <Route path="/manager/comments" element={<MyCommentHistoryPage />} />
            </Route>
          </Route>
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
