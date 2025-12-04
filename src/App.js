import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import { ref, set, onDisconnect, onValue, remove } from "firebase/database";
import { db } from "./firebase";

import DevicesPage from './components/DevicesPage';
import SMSPage from './components/SMSPage';
import DeviceDetails from './components/DeviceDetails';
import OnlineAdmins from "./components/OnlineAdmins";

import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';
let GLOBAL_AUTH_LISTENER_RAN = false;

/* =======================================================
   NAVBAR
======================================================= */
function Navbar() {
  const location = useLocation();
  const [onlineCount, setOnlineCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setOnlineCount(0);
      return;
    }

    const dbPath = localStorage.getItem("dbPath_" + currentUser.uid);
    if (!dbPath) return;

    const onlineRef = ref(db, "onlineAdmins/" + dbPath);

    return onValue(onlineRef, snap => {
      const data = snap.val() || {};
      setOnlineCount(Object.keys(data).length);
    });
  }, [currentUser]);

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
  const sessionInitializedRef = useRef(false);
  const cleanupDoneRef = useRef(false);

  // Generate UNIQUE TAB ID once
  useEffect(() => {
    if (!sessionStorage.getItem("TAB_SESSION_ID")) {
      sessionStorage.setItem(
        "TAB_SESSION_ID",
        "tab_" + Math.random().toString(36).substring(2) + "_" + Date.now()
      );
    }
  }, []);

useEffect(() => {
  // STOP RE-RUN ON ROUTE CHANGE
  if (GLOBAL_AUTH_LISTENER_RAN) {
    setAuthLoading(false);
    return;
  }
  GLOBAL_AUTH_LISTENER_RAN = true;

  const TAB_SESSION_ID = sessionStorage.getItem("TAB_SESSION_ID");

  const unsub = onAuthStateChanged(auth, (user) => {
    if (!user) {
      sessionInitializedRef.current = false;
      setAuthLoading(false);
      return;
    }

    const dbPath = localStorage.getItem("dbPath_" + user.uid);
    if (!dbPath) {
      setAuthLoading(false);
      return;
    }

    const onlineRef = ref(db, `onlineAdmins/${dbPath}/${TAB_SESSION_ID}`);

    // FULL FIX → NO DUPLICATES
    if (!sessionInitializedRef.current) {
      sessionInitializedRef.current = true;

      const info = {
        email: user.email,
        uid: user.uid,
        tabId: TAB_SESSION_ID,
        browser: navigator.userAgent.substring(0, 50),
        platform: navigator.platform,
        lastActive: Date.now()
      };

      set(onlineRef, info);
      onDisconnect(onlineRef).remove();
    }

    setAuthLoading(false);
  });

  return () => unsub();
}, []);


  // Update lastActive periodically for active tab
  useEffect(() => {
    if (!auth.currentUser) return;

    const interval = setInterval(() => {
      const user = auth.currentUser;
      if (!user) return;

      const dbPath = localStorage.getItem("dbPath_" + user.uid);
      const TAB_SESSION_ID = sessionStorage.getItem("TAB_SESSION_ID");
      
      if (dbPath && TAB_SESSION_ID && sessionInitializedRef.current) {
        const onlineRef = ref(db, `onlineAdmins/${dbPath}/${TAB_SESSION_ID}`);
        set(onlineRef, {
          email: user.email,
          uid: user.uid,
          tabId: TAB_SESSION_ID,
          browser: navigator.userAgent.substring(0, 50),
          platform: navigator.platform,
          lastActive: Date.now(),
          lastUpdated: new Date().toISOString()
        }).catch(console.error);
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
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