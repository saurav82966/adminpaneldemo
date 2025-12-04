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



/* ====================================================
   NAVBAR (ALWAYS AT TOP LEVEL)
==================================================== */
function Navbar() {
  const location = useLocation();
  const [onlineCount, setOnlineCount] = useState(0);

  // Live count of admins inside SAME dbPath
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const dbPath = localStorage.getItem("dbPath_" + uid);
    if (!dbPath) return;

    // Listen to only this user's workspace admins
    const onlineRef = ref(db, "onlineAdmins/" + dbPath);

    return onValue(onlineRef, snap => {
      const data = snap.val() || {};
      setOnlineCount(Object.keys(data).length);
    });
  }, []);

  // Hide on login/register
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

          {/* ONLINE COUNT BUTTON */}
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



/* ====================================================
   MAIN APP
==================================================== */
function App() {

  const [authLoading, setAuthLoading] = useState(true);

  // Track online admin sessions
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {

      if (user) {
        const dbPath = localStorage.getItem("dbPath_" + user.uid);

        if (dbPath) {

          // UNIQUE session ID (browser tab)
          const sessionId = `${user.uid}_${Date.now()}`;

          const onlineRef = ref(db, `onlineAdmins/${dbPath}/${sessionId}`);

          const info = {
            email: user.email,
            sessionId,
            browser: navigator.userAgent,
            platform: navigator.platform,
            lastActive: Date.now()
          };

          // Save active session
          set(onlineRef, info);

          // Auto remove on tab close
          onDisconnect(onlineRef).remove();
        }
      }

      setAuthLoading(false);
    });

    return () => unsub();
  }, []);



  // Loader while checking Firebase login state
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

          {/* PUBLIC */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* PROTECTED */}
          <Route path="/" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
          <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
          <Route path="/sms" element={<ProtectedRoute><SMSPage /></ProtectedRoute>} />
          <Route path="/device/:deviceId" element={<ProtectedRoute><DeviceDetails /></ProtectedRoute>} />

          {/* FULL PAGE ONLINE ADMIN LIST */}
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
