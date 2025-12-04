import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import DevicesPage from './components/DevicesPage';
import SMSPage from './components/SMSPage';
import DeviceDetails from './components/DeviceDetails';

import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';

function Navbar() {
  const location = useLocation();

  // Login & Register page par navbar hide
  if (location.pathname === "/login" || location.pathname === "/register") {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="nav-container">
        <h1>SMS Admin Panel</h1>

        <div className="nav-links">
          <Link to="/devices" className="nav-link">Devices</Link>
          <Link to="/sms" className="nav-link">All SMS</Link>

          {/* LOGOUT BUTTON */}
          <button
            onClick={() => auth.signOut()}
            className="nav-link"
            style={{ background: "red", color: "white", padding: "6px 12px", borderRadius: "6px" }}
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

  // ⭐ Pehle check karo Firebase user ready hua ya nahi
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => {
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  // ⭐ Jab tak auth state load ho rahi ho → blank screen or loader
  if (authLoading) {
    return (
      <div className="loading" style={{ textAlign: "center", marginTop: "80px", fontSize: "22px" }}>
        Checking session...
      </div>
    );
  }

  return (
    <Router>
      <Navbar />

      <main className="main-content">
        <Routes>

          {/* PUBLIC ROUTES */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* PROTECTED ROUTES */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DevicesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/devices"
            element={
              <ProtectedRoute>
                <DevicesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/sms"
            element={
              <ProtectedRoute>
                <SMSPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/device/:deviceId"
            element={
              <ProtectedRoute>
                <DeviceDetails />
              </ProtectedRoute>
            }
          />

        </Routes>
      </main>
    </Router>
  );
}

export default App;
