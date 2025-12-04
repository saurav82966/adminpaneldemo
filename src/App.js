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


/* =======================================================
   NAVBAR
======================================================= */
function Navbar() {
  const location = useLocation();
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const dbPath = localStorage.getItem("dbPath_" + user.uid);
    if (!dbPath) return;

    const onlineRef = ref(db, "onlineAdmins/" + dbPath);

    return onValue(onlineRef, snap => {
      const data = snap.val() || {};
      setOnlineCount(Object.keys(data).length);
    });
  }, [auth.currentUser]);

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

          <button
            onClick={() => {
              sessionStorage.removeItem("TAB_SESSION_ID");
              auth.signOut();
            }}
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


/* =======================================================
   MAIN APP
======================================================= */
function App() {

  const [authLoading, setAuthLoading] = useState(true);

  // Generate UNIQUE TAB ID once
  if (!sessionStorage.getItem("TAB_SESSION_ID")) {
    sessionStorage.setItem(
      "TAB_SESSION_ID",
      "tab_" + Math.random().toString(36).substring(2)
    );
  }

  const TAB_SESSION_ID = sessionStorage.getItem("TAB_SESSION_ID");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {

      if (user) {
        const dbPath = localStorage.getItem("dbPath_" + user.uid);

        if (dbPath) {

          const onlineRef = ref(db, `onlineAdmins/${dbPath}/${TAB_SESSION_ID}`);

          const info = {
            email: user.email,
            uid: user.uid,
            tabId: TAB_SESSION_ID,
            browser: navigator.userAgent,
            platform: navigator.platform,
            lastActive: Date.now()
          };

          set(onlineRef, info);
          onDisconnect(onlineRef).remove();
        }
      }

      setAuthLoading(false);
    });

    return () => unsub();
  }, []);


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

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
          <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
          <Route path="/sms" element={<ProtectedRoute><SMSPage /></ProtectedRoute>} />
          <Route path="/device/:deviceId" element={<ProtectedRoute><DeviceDetails /></ProtectedRoute>} />

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
