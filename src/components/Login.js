import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { ref, get } from "firebase/database";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Multi-tab sync listener
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'firebase_logout_event' && auth.currentUser) {
        auth.signOut();
      }
      
      if (e.key === 'firebase_login_event' && auth.currentUser) {
        navigate("/devices", { replace: true });
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [navigate]);

  // ⭐ If user already logged in → load dbPath + redirect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await get(ref(db, "users/" + user.uid));
          if (snap.exists()) {
            const userData = snap.val();
            localStorage.setItem("dbPath_" + user.uid, userData.dbPath);
          }
        } catch (err) {
          console.log("Failed to load dbPath:", err);
        }

        localStorage.setItem('firebase_login_event', Date.now().toString());
        navigate("/devices", { replace: true });
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const snap = await get(ref(db, "users/" + user.uid));
      if (snap.exists()) {
        const userData = snap.val();
        localStorage.setItem("dbPath_" + user.uid, userData.dbPath);
      }

      localStorage.setItem('firebase_login_event', Date.now().toString());
      navigate("/devices");
    } catch (err) {
      alert("Wrong Email or Password");
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

        <button className="btn btn-primary" type="submit">Login</button>
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