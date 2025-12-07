import React, { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { ref, get, set, push, remove } from "firebase/database";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const sessionIdRef = useRef(null);

  // MULTI DEVICE SYNC HANDLER - Improved
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith('force_logout_')) {
        const userId = e.key.replace('force_logout_', '');
        const currentUser = auth.currentUser;
        
        if (currentUser && currentUser.uid === userId) {
          // Clean up current session from Firebase
          if (sessionIdRef.current) {
            remove(ref(db, `active_sessions/${sessionIdRef.current}`));
          }
          
          // Sign out locally
          auth.signOut();
          localStorage.removeItem(`dbPath_${userId}`);
          localStorage.removeItem('current_session_id');
          
          // Redirect to login
          navigate("/login", { replace: true });
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Check if we're already force logged out
    const currentUser = auth.currentUser;
    if (currentUser) {
      const forceLogoutKey = `force_logout_${currentUser.uid}`;
      const forceLogoutTime = localStorage.getItem(forceLogoutKey);
      if (forceLogoutTime) {
        const logoutTime = parseInt(forceLogoutTime);
        const currentTime = Date.now();
        
        // If logout was triggered in the last 5 minutes, enforce it
        if (currentTime - logoutTime < 5 * 60 * 1000) {
          auth.signOut();
          localStorage.removeItem(forceLogoutKey);
          navigate("/login", { replace: true });
        } else {
          // Clear old logout flags
          localStorage.removeItem(forceLogoutKey);
        }
      }
    }

    return () => window.removeEventListener("storage", handleStorageChange);
  }, [navigate]);

  // AUTO LOGIN handler
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Get user data from database
          const userSnap = await get(ref(db, "users/" + user.uid));
          if (userSnap.exists()) {
            const userData = userSnap.val();
            localStorage.setItem("dbPath_" + user.uid, userData.dbPath);
          }

          // Check if user is force logged out
          const forceLogoutKey = `force_logout_${user.uid}`;
          const forceLogoutTime = localStorage.getItem(forceLogoutKey);
          
          if (forceLogoutTime) {
            const logoutTime = parseInt(forceLogoutTime);
            const currentTime = Date.now();
            
            // If logout was recent (within 5 minutes), enforce it
            if (currentTime - logoutTime < 5 * 60 * 1000) {
              await auth.signOut();
              localStorage.removeItem(forceLogoutKey);
              return;
            } else {
              // Clear old logout flag
              localStorage.removeItem(forceLogoutKey);
            }
          }

          // Create or update active session
          const newSessionRef = push(ref(db, "active_sessions"));
          const sessionData = {
            sessionId: newSessionRef.key,
            userId: user.uid,
            email: user.email,
            device: navigator.userAgent,
            deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
            loginTime: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            ipAddress: "Unknown" // You can implement IP detection if needed
          };
          
          await set(newSessionRef, sessionData);
          
          // Store session ID locally
          sessionIdRef.current = newSessionRef.key;
          localStorage.setItem("current_session_id", newSessionRef.key);
          
          // Clear any logout flags for this user
          localStorage.removeItem(forceLogoutKey);
          
          // Broadcast login to other tabs
          localStorage.setItem("firebase_login_event", Date.now().toString());
          
          navigate("/devices", { replace: true });
        } catch (error) {
          console.error("Auto-login error:", error);
        }
      }
    });

    return () => unsub();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      // Get user data
      const userSnap = await get(ref(db, "users/" + user.uid));
      if (userSnap.exists()) {
        const userData = userSnap.val();
        localStorage.setItem("dbPath_" + user.uid, userData.dbPath);
      }

      // Check if user is force logged out
      const forceLogoutKey = `force_logout_${user.uid}`;
      const forceLogoutTime = localStorage.getItem(forceLogoutKey);
      
      if (forceLogoutTime) {
        const logoutTime = parseInt(forceLogoutTime);
        const currentTime = Date.now();
        
        if (currentTime - logoutTime < 5 * 60 * 1000) {
          await auth.signOut();
          localStorage.removeItem(forceLogoutKey);
          alert("Your account has been logged out by admin. Please login again.");
          return;
        } else {
          localStorage.removeItem(forceLogoutKey);
        }
      }

      // CREATE ACTIVE SESSION
      const newSessionRef = push(ref(db, "active_sessions"));
      const sessionData = {
        sessionId: newSessionRef.key,
        userId: user.uid,
        email: user.email,
        device: navigator.userAgent,
        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        ipAddress: "Unknown"
      };
      
      await set(newSessionRef, sessionData);
      
      // Store session ID locally
      sessionIdRef.current = newSessionRef.key;
      localStorage.setItem("current_session_id", newSessionRef.key);
      
      // Clear any logout flags
      localStorage.removeItem(forceLogoutKey);
      
      // Broadcast login
      localStorage.setItem("firebase_login_event", Date.now().toString());
      
      navigate("/devices");
    } catch (err) {
      console.error("Login error:", err);
      alert("Invalid Email or Password");
    }
  };

  return (
    <div className="card" style={{ maxWidth: "400px", margin: "50px auto" }}>
      <h2>Login</h2>

      <form onSubmit={handleLogin}>
        <input
          type="email"
          className="form-input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          className="form-input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="btn btn-primary" type="submit">
          Login
        </button>
      </form>

      <p style={{ marginTop: "10px" }}>
        Don't have an account?{" "}
        <span
          style={{ color: "blue", cursor: "pointer" }}
          onClick={() => navigate("/register")}
        >
          Register
        </span>
      </p>
    </div>
  );
}