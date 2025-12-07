import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { ref, get, set, push, remove } from "firebase/database";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isChecking, setIsChecking] = useState(true);

  // CHECK IF USER IS BLOCKED
  const checkIfBlocked = async (userId) => {
    try {
      const blockedRef = ref(db, `blocked_users/${userId}`);
      const snapshot = await get(blockedRef);
      return snapshot.exists();
    } catch (error) {
      console.error("Block check error:", error);
      return false;
    }
  };

  // CHECK EXISTING SESSION ON MOUNT
  useEffect(() => {
    const checkExistingAuth = async () => {
      const user = auth.currentUser;
      
      if (user) {
        // Check if user is blocked
        const isBlocked = await checkIfBlocked(user.uid);
        
        if (isBlocked) {
          // User is blocked, force logout
          await auth.signOut();
          localStorage.clear();
          alert("Your account has been blocked by admin.");
          setIsChecking(false);
          return;
        }
        
        // Check local storage flag
        const forceLogout = localStorage.getItem(`force_logout_${user.uid}`);
        if (forceLogout) {
          const logoutTime = parseInt(forceLogout);
          if (Date.now() - logoutTime < 5 * 60 * 1000) {
            // Recently force logged out
            await auth.signOut();
            localStorage.removeItem(`force_logout_${user.uid}`);
            alert("You were logged out by admin. Please login again.");
            setIsChecking(false);
            return;
          }
        }
        
        // Create session if not exists
        const sessionsRef = ref(db, "active_sessions");
        const sessionsSnap = await get(sessionsRef);
        let sessionExists = false;
        
        if (sessionsSnap.exists()) {
          sessionsSnap.forEach((sessionSnap) => {
            const session = sessionSnap.val();
            if (session.userId === user.uid && 
                session.device === navigator.userAgent) {
              sessionExists = true;
            }
          });
        }
        
        if (!sessionExists) {
          const newSessionRef = push(ref(db, "active_sessions"));
          await set(newSessionRef, {
            sessionId: newSessionRef.key,
            userId: user.uid,
            email: user.email,
            device: navigator.userAgent,
            deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
            loginTime: new Date().toISOString(),
            lastActive: new Date().toISOString()
          });
        }
        
        // Get user's dbPath
        const userSnap = await get(ref(db, `users/${user.uid}`));
        if (userSnap.exists()) {
          localStorage.setItem(`dbPath_${user.uid}`, userSnap.val().dbPath);
        }
        
        navigate("/devices", { replace: true });
      }
      
      setIsChecking(false);
    };

    checkExistingAuth();
  }, [navigate]);

  // HANDLE LOGIN
  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      
      // CHECK IF BLOCKED
      const isBlocked = await checkIfBlocked(user.uid);
      if (isBlocked) {
        await auth.signOut();
        alert("Your account has been blocked by administrator.");
        return;
      }
      
      // CHECK FORCE LOGOUT
      const forceLogout = localStorage.getItem(`force_logout_${user.uid}`);
      if (forceLogout) {
        const logoutTime = parseInt(forceLogout);
        if (Date.now() - logoutTime < 5 * 60 * 1000) {
          await auth.signOut();
          localStorage.removeItem(`force_logout_${user.uid}`);
          alert("You were logged out by admin. Please login again.");
          return;
        } else {
          localStorage.removeItem(`force_logout_${user.uid}`);
        }
      }
      
      // GET USER DATA
      const userSnap = await get(ref(db, `users/${user.uid}`));
      if (userSnap.exists()) {
        localStorage.setItem(`dbPath_${user.uid}`, userSnap.val().dbPath);
      }
      
      // CREATE SESSION
      const sessionRef = push(ref(db, "active_sessions"));
      await set(sessionRef, {
        sessionId: sessionRef.key,
        userId: user.uid,
        email: user.email,
        device: navigator.userAgent,
        deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
        deviceName: getDeviceName(navigator.userAgent),
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        ip: await getIP()
      });
      
      // STORE SESSION ID
      localStorage.setItem("current_session_id", sessionRef.key);
      
      // NAVIGATE
      navigate("/devices");
      
    } catch (err) {
      console.error("Login error:", err);
      alert("Invalid email or password");
    }
  };

  // HELPER FUNCTIONS
  const getDeviceName = (ua) => {
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'Mac';
    if (ua.includes('Android')) {
      if (ua.includes('OnePlus')) return 'OnePlus Phone';
      if (ua.includes('Samsung')) return 'Samsung Phone';
      return 'Android Phone';
    }
    if (ua.includes('iPhone')) return 'iPhone';
    return 'Other Device';
  };

  const getIP = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      return data.ip;
    } catch {
      return 'Unknown';
    }
  };

  if (isChecking) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: "400px", margin: "50px auto" }}>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          className="form-control mb-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="form-control mb-3"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn btn-primary w-100" type="submit">
          Login
        </button>
      </form>
      <p className="mt-3 text-center">
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