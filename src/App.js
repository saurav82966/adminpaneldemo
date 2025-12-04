// App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";

import { ref, set, onDisconnect, remove } from "firebase/database";
import { db } from "./firebase";

import Navbar from "./components/Navbar";
import DevicesPage from "./components/DevicesPage";
import SMSPage from "./components/SMSPage";
import DeviceDetails from "./components/DeviceDetails";
import OnlineAdmins from "./components/OnlineAdmins";
import Login from "./components/Login";
import Register from "./components/Register";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const dbPath = localStorage.getItem("dbPath_" + user.uid);

        // Device-based stable session ID
        let sessionId = localStorage.getItem("DEVICE_SESSION_ID");
        if (!sessionId) {
          sessionId = "sess_" + Math.random().toString(36).substring(2);
          localStorage.setItem("DEVICE_SESSION_ID", sessionId);
        }

        if (dbPath) {
          const sessionRef = ref(db, `onlineAdmins/${dbPath}/${sessionId}`);

          const info = {
            email: user.email,
            uid: user.uid,
            sessionId,
            browser: navigator.userAgent,
            platform: navigator.platform,
            loginTime: Date.now(),
            lastActive: Date.now()
          };

          // Create session
          set(sessionRef, info);

          // Auto cleanup on tab close
          onDisconnect(sessionRef).remove();
        }
      }
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  if (authLoading) return <div>Checking Session...</div>;

  return (
    <Router>
      <Navbar />

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/" element={<ProtectedRoute><DevicesPage/></ProtectedRoute>} />
        <Route path="/devices" element={<ProtectedRoute><DevicesPage/></ProtectedRoute>} />
        <Route path="/sms" element={<ProtectedRoute><SMSPage/></ProtectedRoute>} />
        <Route path="/device/:deviceId" element={<ProtectedRoute><DeviceDetails/></ProtectedRoute>} />

        <Route path="/online-admins" element={<ProtectedRoute><OnlineAdmins/></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
