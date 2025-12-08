import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth, db } from "./firebase";
import { ref, remove, set, onValue } from "firebase/database";

import DevicesPage from './components/DevicesPage';
import SMSPage from './components/SMSPage';
import DeviceDetails from './components/DeviceDetails';
import SessionsPage from './components/SessionsPage';
import SettingsPage from './components/SettingsPage'; // New Settings Page

import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';

import './App.css';

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [liveCount, setLiveCount] = useState(0);
  const user = auth.currentUser;

  // 🔴 LIVE DEVICES COUNT TRACKING
  useEffect(() => {
    if (!user || location.pathname === "/login" || location.pathname === "/register") return;

    const sessionRef = ref(db, `activeSessions/${user.uid}`);
    
    const unsubscribe = onValue(sessionRef, (snap) => {
      if (snap.exists()) {
        const sessions = snap.val();
        const now = Date.now();
        
        // Count only LIVE sessions (within last 3 seconds)
        const liveSessions = Object.values(sessions).filter(
          session => now - session.lastActive < 3000
        ).length;
        
        setLiveCount(liveSessions);
      } else {
        setLiveCount(0);
      }
    });

    return () => unsubscribe();
  }, [user, location.pathname]);

  if (location.pathname === "/login" || location.pathname === "/register") {
    return null;
  }

  const handleLogout = async () => {
    const user = auth.currentUser;
    const sessionId = localStorage.getItem("sessionId");

    if (user && sessionId) {
      await remove(ref(db, `activeSessions/${user.uid}/${sessionId}`));
    }

    localStorage.removeItem("dbPath_" + user.uid);
    await signOut(auth);
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-brand">
          <h1>SMS Admin Panel</h1>
        </div>

        <div className="nav-links">
          <Link 
            to="/devices" 
            className={`nav-link ${location.pathname === '/devices' || location.pathname === '/' ? 'active' : ''}`}
          >
            Devices
          </Link>
          <Link 
            to="/sms" 
            className={`nav-link ${location.pathname === '/sms' ? 'active' : ''}`}
          >
            All SMS
          </Link>
          <Link 
            to="/sessions" 
            className={`nav-link ${location.pathname === '/sessions' ? 'active' : ''}`}
          >
            Live
            {liveCount > 0 && (
              <span className="nav-badge">{liveCount}</span>
            )}
          </Link>
          <Link 
            to="/settings" 
            className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`}
          >
            Settings
          </Link>
        </div>

        <button
          onClick={handleLogout}
          className="logout-btn"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionId] = useState(() => {
    const existingId = localStorage.getItem("sessionId");
    if (!existingId) {
      const newId = 'session_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("sessionId", newId);
      return newId;
    }
    return existingId;
  });

  // ⭐ WAIT FOR AUTH READY
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const deviceName = navigator.userAgent;
        set(ref(db, `activeSessions/${user.uid}/${sessionId}`), {
          deviceName,
          lastActive: Date.now(),
          createdAt: Date.now()
        });
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [sessionId]);

  // ⭐ FAST HEARTBEAT (EVERY 1 SECOND FOR INSTANT UPDATE)
  useEffect(() => {
    const updateHeartbeat = () => {
      const user = auth.currentUser;
      if (!user || !sessionId) return;

      set(ref(db, `activeSessions/${user.uid}/${sessionId}/lastActive`), Date.now());
    };

    updateHeartbeat();
    const interval = setInterval(updateHeartbeat, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // ⭐ REMOVE SESSION ONLY WHEN TAB IS CLOSED
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const user = auth.currentUser;
      if (user && sessionId) {
        navigator.sendBeacon || remove(ref(db, `activeSessions/${user.uid}/${sessionId}`));
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const user = auth.currentUser;
        if (user && sessionId) {
          set(ref(db, `activeSessions/${user.uid}/${sessionId}/lastActive`), Date.now());
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId]);

  // ⭐ AUTH LOADING SCREEN
  if (authLoading) {
    return (
      <div className="loading">
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
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;