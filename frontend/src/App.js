import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Subscriptions from "./pages/Subscriptions";
import Invoices from "./pages/Invoices";
import Expenses from "./pages/Expenses";
import RateManagement from "./pages/RateManagement";
import Reports from "./pages/Reports";
import Receivables from "./pages/Receivables";
import UsageTracking from "./pages/UsageTracking";
import InvoiceManagement from "./pages/InvoiceManagement";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const sessionId = params.get("session_id");

    if (!sessionId) {
      navigate("/login");
      return;
    }

    fetch(`${API}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ session_id: sessionId })
    })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          navigate("/dashboard", { state: { user: data.user }, replace: true });
        } else {
          navigate("/login");
        }
      })
      .catch(() => navigate("/login"));
  }, [location.hash, navigate]);

  return <div className="flex items-center justify-center min-h-screen">Processing authentication...</div>;
}

function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.user) {
      setIsAuthenticated(true);
      setUser(location.state.user);
      return;
    }

    const checkAuth = async () => {
      try {
        const response = await fetch(`${API}/auth/me`, {
          credentials: "include"
        });
        if (!response.ok) throw new Error("Not authenticated");
        const userData = await response.json();
        setIsAuthenticated(true);
        setUser(userData);
      } catch (error) {
        setIsAuthenticated(false);
        navigate("/login");
      }
    };

    checkAuth();
  }, [navigate, location.state]);

  if (isAuthenticated === null) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return React.cloneElement(children, { user });
}

function AppRouter() {
  const location = useLocation();

  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/subscriptions" element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/receivables" element={<ProtectedRoute><Receivables /></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/rate-management" element={<ProtectedRoute><RateManagement /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;
