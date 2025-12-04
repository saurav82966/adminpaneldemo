import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { ref, set, onDisconnect, onValue } from "firebase/database";
import { db } from "./firebase";

import DevicesPage from './components/DevicesPage';
import SMSPage from './components/SMSPage';
import DeviceDetails from './components/DeviceDetails';
import OnlineAdmins from "./components/OnlineAdmins";

import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';

// ================================
// NAVBAR
// ================================
function Navbar() {
  const location = useLocation();
  const [onlineCount, setOnlineCount] = useState(0);

  // Login & Register page par navbar hide
  if (location.pathname === "/login" || location.pathname === "/register") {
    return null;
  }

  // ⭐ LIVE online admin count
  useEffect(() => {
    const onlineRef = ref(db, "onlineAdmins");

    return onValue(onlineRef, (snap) => {
      const data = snap.val() || {};
      setOnlineCount(Object.keys(data).length);
    });
  }, []);

  return (
    <nav className="navbar">
      <div className="nav-container">
        <h1>SMS Admin Panel</h1>

        <div className="nav-links">
          <Link to="/devices" className="nav-link">Devices</Link>
          <Link to="/sms" className="nav-link">All SMS</Link>

          {/* ⭐ SHOW LIVE COUNT */}
          <Link 
            to="/online-admins"
            className="nav-link"
            style={{ 
              background: "#4caf50", 
              color: "white", 
              padding: "6px 12px", 
              borderRadius: "6px" 
            }}
          >
            👁 Online {onlineCount}
          </Link>

          {/* LOGOUT */}
          <button
            onClick={() => auth.signOut()}
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

// ================================
// APP MAIN COMPONENT
// ================================
function App() {

  const [authLoading, setAuthLoading] = useState(true);

  // ⭐ Firebase auth state check + online admin tracker
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {

      if (user) {
        // ⭐ Mark admin online
        const onlineRef = ref(db, "onlineAdmins/" + user.uid);

        const adminInfo = {
          email: user.email,
          browser: navigator.userAgent,
          platform: navigator.platform,
          lastActive: Date.now()
        };

        set(onlineRef, adminInfo);

        // ⭐ Auto remove when tab closed
        onDisconnect(onlineRef).remove();
      }

      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  // ⭐ Loader while auth loads
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

          {/* ⭐ FULL PAGE ONLINE ADMINS PAGE */}
          <Route 
            path="/online-admins" 
            element={
              <ProtectedRoute>
                <OnlineAdmins />
              </ProtectedRoute>
            } 
          />

        </Routes>
      </main>
    </Router>
  );
}

export default App;
