import React, { useEffect, useState, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { ref, set, onDisconnect, onValue, remove } from "firebase/database";
import { db } from "./firebase";

import DevicesPage from "./components/DevicesPage";
import SMSPage from "./components/SMSPage";
import DeviceDetails from "./components/DeviceDetails";
import OnlineAdmins from "./components/OnlineAdmins";

import Login from "./components/Login";
import Register from "./components/Register";
import ProtectedRoute from "./components/ProtectedRoute";

import "./App.css";

let GLOBAL_LISTENER_ADDED = false;

/* =======================================================
   NAVBAR
======================================================= */
function Navbar() {
  const location = useLocation();
  const [onlineCount, setOnlineCount] = useState(0);
  const [user, setUser] = useState(null);

  // Get current user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  // Count online admins
  useEffect(() => {
    if (!user) return;

    const dbPath = localStorage.getItem("dbPath_" + user.uid);
    if (!dbPath) return;

    const onlineRef = ref(db, "onlineAdmins/" + dbPath);

    return onValue(onlineRef, snap => {
      const data = snap.val() || {};
      setOnlineCount(Object.keys(data).length);
    });
  }, [user]);

  // Hide navbar on login/register
  if (["/login", "/register"].includes(location.pathname)) return null;

  return (
    <nav className="navbar">
      <div className="nav-container">
        <h1>SMS Admin Panel</h1>

        <div className="nav-links">
          <Link className="nav-link" to="/devices">Devices</Link>
          <Link className="nav-link" to="/sms">All SMS</Link>

          <Link
            to="/online-admins"
            className="nav-link"
            style={{ background:"#4caf50", color:"white", padding:"6px 12px", borderRadius:"6px" }}
          >
            👁 Online {onlineCount}
          </Link>

          {/* LOGOUT */}
          <button
            onClick={() => {
              const user = auth.currentUser;
              if (user) {
                const dbPath = localStorage.getItem("dbPath_" + user.uid);
                const TAB_ID = sessionStorage.getItem("TAB_SESSION_ID");

                if (dbPath && TAB_ID) {
                  remove(ref(db, `onlineAdmins/${dbPath}/${TAB_ID}`));
                }
              }
              sessionStorage.removeItem("TAB_SESSION_ID");
              auth.signOut();
            }}
            className="nav-link"
            style={{ background:"red", color:"white", padding:"6px 12px", borderRadius:"6px" }}
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
  const sessionInit = useRef(false);

  // Generate tab ID once
  useEffect(() => {
    if (!sessionStorage.getItem("TAB_SESSION_ID")) {
      sessionStorage.setItem(
        "TAB_SESSION_ID",
        "tab_" + Math.random().toString(36).substring(2) + "_" + Date.now()
      );
    }
  }, []);

  // Global single listener
  useEffect(() => {
    if (GLOBAL_LISTENER_ADDED) {
      setAuthLoading(false);
      return;
    }
    GLOBAL_LISTENER_ADDED = true;

    const TAB_ID = sessionStorage.getItem("TAB_SESSION_ID");

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        sessionInit.current = false;
        setAuthLoading(false);
        return;
      }

      const dbPath = localStorage.getItem("dbPath_" + user.uid);
      if (!dbPath) {
        setAuthLoading(false);
        return;
      }

      const onlineRef = ref(db, `onlineAdmins/${dbPath}/${TAB_ID}`);

      // Create entry only ONCE
      if (!sessionInit.current) {
        sessionInit.current = true;

        const info = {
          email: user.email,
          uid: user.uid,
          tabId: TAB_ID,
          device: navigator.userAgent,
          platform: navigator.platform,
          loginTime: Date.now(),
          lastActive: Date.now()
        };

        set(onlineRef, info);
        onDisconnect(onlineRef).remove();
      }

      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  // Update activity every 20 sec
  useEffect(() => {
    const interval = setInterval(() => {
      const user = auth.currentUser;
      if (!user || !sessionInit.current) return;

      const dbPath = localStorage.getItem("dbPath_" + user.uid);
      const TAB_ID = sessionStorage.getItem("TAB_SESSION_ID");

      if (!dbPath || !TAB_ID) return;

      const onlineRef = ref(db, `onlineAdmins/${dbPath}/${TAB_ID}`);
      set(onlineRef, {
        email: user.email,
        uid: user.uid,
        tabId: TAB_ID,
        device: navigator.userAgent,
        platform: navigator.platform,
        loginTime: Date.now(),
        lastActive: Date.now()
      });
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  if (authLoading) {
    return <div className="loading" style={{ marginTop: 80 }}>Checking session...</div>;
  }

  return (
    <Router>
      <Navbar />

      <main className="main-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/" element={<ProtectedRoute><DevicesPage/></ProtectedRoute>} />
          <Route path="/devices" element={<ProtectedRoute><DevicesPage/></ProtectedRoute>} />
          <Route path="/sms" element={<ProtectedRoute><SMSPage/></ProtectedRoute>} />
          <Route path="/device/:deviceId" element={<ProtectedRoute><DeviceDetails/></ProtectedRoute>} />

          <Route path="/online-admins" element={<ProtectedRoute><OnlineAdmins/></ProtectedRoute>} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
