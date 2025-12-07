import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import { ref, remove, set } from "firebase/database";

import DevicesPage from './components/DevicesPage';
import SMSPage from './components/SMSPage';
import DeviceDetails from './components/DeviceDetails';
import SessionsPage from './components/SessionsPage';

import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';

function Navbar() {
  const location = useLocation();

  if (location.pathname === "/login" || location.pathname === "/register") {
    return null;
  }

  const handleLogout = async () => {
    const user = auth.currentUser;
    const sessionId = localStorage.getItem("sessionId");

    if (user) {
      await remove(ref(db, `activeSessions/${user.uid}/${sessionId}`));
      localStorage.removeItem("dbPath_" + user.uid);
    }

    await auth.signOut();
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <h1>SMS Admin Panel</h1>

        <div className="nav-links">
          <Link to="/devices" className="nav-link">Devices</Link>
          <Link to="/sms" className="nav-link">All SMS</Link>
          <Link to="/sessions" className="nav-link">Logged Devices</Link>

          <button
            onClick={handleLogout}
            className="nav-link"
            style={{
              background: "red",
              color: "white",
              padding: "6px 12px",
              borderRadius: "6px"
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

function App() {

  const [authLoading, setAuthLoading] = useState(true);

  // ⭐ AUTH LOAD CHECK
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  // ⭐ HEARTBEAT USEEFFECT → must be before any conditional return
  useEffect(() => {
    const interval = setInterval(() => {
      const user = auth.currentUser;
      const sessionId = localStorage.getItem("sessionId");

      if (!user || !sessionId) return;

      set(ref(db, `activeSessions/${user.uid}/${sessionId}/lastActive`), Date.now());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // ⭐ CONDITIONAL RETURN AFTER Hooks
  if (authLoading) {
    return (
      <div className="loading" style={{
        textAlign: "center",
        marginTop: "80px",
        fontSize: "22px"
      }}>
        Checking session...
      </div>
    );
  }

  return (
    <Router>
      <Navbar />

      <main className="main-content">
        <Routes>

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
          <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
          <Route path="/sessions" element={<ProtectedRoute><SessionsPage /></ProtectedRoute>} />
          <Route path="/sms" element={<ProtectedRoute><SMSPage /></ProtectedRoute>} />
          <Route path="/device/:deviceId" element={<ProtectedRoute><DeviceDetails /></ProtectedRoute>} />

        </Routes>
      </main>
    </Router>
  );
}

export default App;
