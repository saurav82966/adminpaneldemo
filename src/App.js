import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import { ref, remove, set, onValue } from "firebase/database";

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
    await auth.signOut();
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <h1>SMS Admin Panel</h1>

        <div className="nav-links">
          <Link to="/devices" className="nav-link">Devices</Link>
          <Link to="/sms" className="nav-link">All SMS</Link>
          
          {/* 🔴 LIVE DEVICES LINK WITH COUNTER */}
          <Link to="/sessions" className="nav-link" style={{ position: 'relative' }}>
            Live
            {liveCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                background: '#ff4444',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                animation: 'pulse 1.5s infinite'
              }}>
                {liveCount}
              </span>
            )}
          </Link>

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
  const [sessionId] = useState(() => {
    // Session ID ko initialize karein (agar nahi hai to banayein)
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
        // User logged in hai, to session create karein
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

      const updates = {
        lastActive: Date.now(),
        deviceName: navigator.userAgent
      };

      // Update only lastActive field (optimized)
      set(ref(db, `activeSessions/${user.uid}/${sessionId}/lastActive`), Date.now());
    };

    // Pehla heartbeat turant
    updateHeartbeat();
    
    // Fir har 1 second par
    const interval = setInterval(updateHeartbeat, 1000);

    return () => clearInterval(interval);
  }, [sessionId]);

  // ⭐ REMOVE SESSION ONLY WHEN TAB IS CLOSED
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // BEFOREUNLOAD: Tab close hone par
      const user = auth.currentUser;
      if (user && sessionId) {
        // Sync call karein kyunki async nahi chalega beforeunload mein
        navigator.sendBeacon || remove(ref(db, `activeSessions/${user.uid}/${sessionId}`));
      }
    };

    // Handle visibility change (tab switch)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab switch ya minimize hone par bhi update karein
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