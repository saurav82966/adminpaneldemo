import React, { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth } from "../firebase";
import { ref, get, set, push, remove, update } from "firebase/database";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const sessionIdRef = useRef(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // CUSTOM AUTH CHECK - Firebase ke auto-login ko override karega
  useEffect(() => {
    const checkAuthStatus = async () => {
      const user = auth.currentUser;
      
      if (user) {
        // Check if user is force logged out in our system
        const forceLogoutKey = `force_logout_${user.uid}`;
        const forceLogoutTime = localStorage.getItem(forceLogoutKey);
        
        if (forceLogoutTime) {
          const logoutTime = parseInt(forceLogoutTime);
          const currentTime = Date.now();
          
          // If logout was triggered in last 24 hours
          if (currentTime - logoutTime < 24 * 60 * 60 * 1000) {
            console.log("User force logged out by admin, signing out...");
            
            // Clean up sessions
            const sessionId = localStorage.getItem("current_session_id");
            if (sessionId) {
              await remove(ref(db, `active_sessions/${sessionId}`));
            }
            
            // Force sign out from Firebase
            await auth.signOut();
            
            // Clear local storage
            localStorage.removeItem(forceLogoutKey);
            localStorage.removeItem(`dbPath_${user.uid}`);
            localStorage.removeItem("current_session_id");
            localStorage.removeItem("auth_allowed_" + user.uid);
            
            setIsCheckingAuth(false);
            return;
          } else {
            // Clear old logout flag (24 hours se purana)
            localStorage.removeItem(forceLogoutKey);
          }
        }
        
        // Check our custom auth permission
        const authAllowed = localStorage.getItem("auth_allowed_" + user.uid);
        if (!authAllowed || authAllowed !== "true") {
          console.log("Auth not allowed by system, signing out...");
          await auth.signOut();
          localStorage.removeItem(`dbPath_${user.uid}`);
          localStorage.removeItem("current_session_id");
        } else {
          // Auth allowed, proceed with session creation
          await createOrUpdateSession(user);
          navigate("/devices", { replace: true });
        }
      }
      
      setIsCheckingAuth(false);
    };

    checkAuthStatus();
  }, [navigate]);

  // MULTI DEVICE SYNC HANDLER
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith('force_logout_')) {
        const userId = e.key.replace('force_logout_', '');
        const currentUser = auth.currentUser;
        
        if (currentUser && currentUser.uid === userId) {
          handleForceLogout(currentUser);
        }
      }
      
      if (e.key === 'auth_revoked') {
        const currentUser = auth.currentUser;
        if (currentUser) {
          handleForceLogout(currentUser);
        }
      }
    };

    const handleForceLogout = async (user) => {
      // Clean up current session
      const sessionId = localStorage.getItem("current_session_id");
      if (sessionId) {
        await remove(ref(db, `active_sessions/${sessionId}`));
      }
      
      // Revoke auth permission
      localStorage.removeItem("auth_allowed_" + user.uid);
      
      // Sign out from Firebase
      await auth.signOut();
      
      // Clear all local data
      localStorage.removeItem(`dbPath_${user.uid}`);
      localStorage.removeItem("current_session_id");
      
      // Redirect to login
      navigate("/login", { replace: true });
      window.location.reload();
    };

    window.addEventListener("storage", handleStorageChange);

    return () => window.removeEventListener("storage", handleStorageChange);
  }, [navigate]);

  // Create or update session function
  const createOrUpdateSession = async (user) => {
    try {
      // Get user data from database
      const userSnap = await get(ref(db, "users/" + user.uid));
      if (userSnap.exists()) {
        const userData = userSnap.val();
        localStorage.setItem("dbPath_" + user.uid, userData.dbPath);
      }

      // Create new session
      const newSessionRef = push(ref(db, "active_sessions"));
      const sessionData = {
        sessionId: newSessionRef.key,
        userId: user.uid,
        email: user.email,
        device: navigator.userAgent,
        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
        deviceName: getDeviceName(navigator.userAgent),
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        ipAddress: await getIPAddress(),
        status: "active"
      };
      
      await set(newSessionRef, sessionData);
      
      // Store session ID locally
      sessionIdRef.current = newSessionRef.key;
      localStorage.setItem("current_session_id", newSessionRef.key);
      
      // Mark auth as allowed in our system
      localStorage.setItem("auth_allowed_" + user.uid, "true");
      
      // Clear any force logout flags
      localStorage.removeItem(`force_logout_${user.uid}`);
      
      // Update lastActive periodically
      startActivityTracker(newSessionRef.key, user.uid);
      
      return newSessionRef.key;
    } catch (error) {
      console.error("Session creation error:", error);
    }
  };

  // Get device name from user agent
  const getDeviceName = (userAgent) => {
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Linux')) return 'Linux PC';
    if (userAgent.includes('Android')) {
      if (userAgent.includes('OnePlus')) return 'OnePlus Phone';
      if (userAgent.includes('Samsung')) return 'Samsung Phone';
      return 'Android Phone';
    }
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    return 'Unknown Device';
  };

  // Get IP address (simplified)
  const getIPAddress = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return "Unknown";
    }
  };

  // Track user activity
  const startActivityTracker = (sessionId, userId) => {
    // Update lastActive every minute
    const activityInterval = setInterval(() => {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        update(ref(db, `active_sessions/${sessionId}`), {
          lastActive: new Date().toISOString()
        });
      } else {
        clearInterval(activityInterval);
      }
    }, 60000);

    // Also update on visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && auth.currentUser && auth.currentUser.uid === userId) {
        update(ref(db, `active_sessions/${sessionId}`), {
          lastActive: new Date().toISOString()
        });
      }
    });

    // Store interval ID for cleanup
    window.activityTracker = activityInterval;
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      // FIRST: Check if user is force logged out
      const forceLogoutKey = `force_logout_${user.uid}`;
      const forceLogoutTime = localStorage.getItem(forceLogoutKey);
      
      if (forceLogoutTime) {
        const logoutTime = parseInt(forceLogoutTime);
        const currentTime = Date.now();
        
        // If logout was in last 24 hours, block login
        if (currentTime - logoutTime < 24 * 60 * 60 * 1000) {
          await auth.signOut();
          localStorage.removeItem(forceLogoutKey);
          alert("Your account has been logged out by admin. Please contact administrator.");
          return;
        } else {
          localStorage.removeItem(forceLogoutKey);
        }
      }

      // Create session and allow auth
      await createOrUpdateSession(user);
      
      // Navigate to devices page
      navigate("/devices");
      
    } catch (err) {
      console.error("Login error:", err);
      alert("Invalid Email or Password");
    }
  };

  if (isCheckingAuth) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Checking authentication...</span>
        </div>
        <p>Checking authentication status...</p>
      </div>
    );
  }

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
          onChange={(e) => setPassword(e.value)}
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