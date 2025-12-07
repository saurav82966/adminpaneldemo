import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import DevicesPage from './components/DevicesPage';
import SMSPage from './components/SMSPage';
import DeviceDetails from './components/DeviceDetails';
import AllUsersPage from './components/AllUsersPage';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';

// Navbar component ko App ke andar rakhna hoga
function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === "/login" || location.pathname === "/register") {
    return null;
  }

  const handleLogout = () => {
    localStorage.setItem('firebase_logout_event', Date.now().toString());
    auth.signOut();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <h1>Mahesh Dalle Panel</h1>

        <div className="nav-links">
          <Link to="/devices" className="nav-link">My Devices</Link>
          <Link to="/all-users" className="nav-link">All Users</Link>
          <Link to="/sms" className="nav-link">All SMS</Link>

          <button
            onClick={handleLogout}
            className="nav-link logout-btn"
          >
            Logout ({auth.currentUser?.email || 'User'})
          </button>
        </div>
      </div>
    </nav>
  );
}

// Main App component - Router ke bahar
function AppContent() {
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'firebase_logout_event') {
        auth.signOut();
        navigate("/login", { replace: true });
      }
      
      if (e.key === 'firebase_login_event') {
        window.location.reload();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthLoading(false);
      
      if (user) {
        localStorage.setItem('firebase_login_event', Date.now().toString());
      }
    });

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      unsubscribe();
    };
  }, [navigate]);

  if (authLoading) {
    return (
      <div className="loading" style={{ textAlign: "center", marginTop: "80px", fontSize: "22px" }}>
        Loading session...
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
          <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
          <Route path="/all-users" element={<ProtectedRoute><AllUsersPage /></ProtectedRoute>} />
          <Route path="/sms" element={<ProtectedRoute><SMSPage /></ProtectedRoute>} />
          <Route path="/device/:deviceId" element={<ProtectedRoute><DeviceDetails /></ProtectedRoute>} />
        </Routes>
      </main>
    </>
  );
}

// Main App wrapper jo Router provide karega
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;