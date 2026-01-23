// src/App.jsx
import React, { useEffect } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import POSScreen from "@/pages/POSScreen";
import CustomerDisplay from "@/pages/CustomerDisplay";
import Login from "@/components/Login";
import { POSProvider } from "@/contexts/POSContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LicenseGate from "@/components/LicenseGate";

function ProtectedRoute({ children }) {
  const { state } = useAuth();
  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  useEffect(() => {
    document.title = "FerrePOS - Sistema POS para Ferretería";
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <LicenseGate>
          <POSProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <POSScreen />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer-display"
                  element={
                    <ProtectedRoute>
                      <CustomerDisplay />
                    </ProtectedRoute>
                  }
                />
                {/* Fallback para cualquier ruta desconocida */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <Toaster />
            </Router>
          </POSProvider>
        </LicenseGate>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
