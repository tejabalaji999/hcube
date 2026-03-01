import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/Layout/AppLayout';
import Login from './pages/Login/Login';
import Connections from './pages/Connections/Connections';
import Destinations from './pages/Destinations/Destinations';
import Syncs from './pages/Syncs/Syncs';
import SyncDetail from './pages/Syncs/SyncDetail';

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/connections" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/connections" replace />} />
        <Route path="connections" element={<Connections />} />
        <Route path="destinations" element={<Destinations />} />
        <Route path="syncs" element={<Syncs />} />
        <Route path="syncs/:id" element={<SyncDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/connections" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
    >
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}
