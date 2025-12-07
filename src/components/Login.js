import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { ref, get, set, push } from "firebase/database";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // MULTI DEVICE SYNC HANDLER
  useEffect(() => {
    const handle = (e) => {
      if (e.key === "force_logout") {
        auth.signOut();
        window.location.reload();
      }
    };

    window.addEventListener("storage", handle);
    return () => window.removeEventListener("storage", handle);
  }, []);

  // AUTO LOGIN → SKIP LOGIN PAGE
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await get(ref(db, "users/" + user.uid));
        if (snap.exists()) {
          const userData = snap.val();
          localStorage.setItem("dbPath_" + user.uid, userData.dbPath);
        }

        localStorage.setItem("login_sync", Date.now());
        navigate("/users", { replace: true });
      }
    });

    return () => unsub();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      const snap = await get(ref(db, "users/" + user.uid));
      if (snap.exists()) {
        localStorage.setItem("dbPath_" + user.uid, snap.val().dbPath);
      }

      // CREATE ACTIVE SESSION
      const sid = push(ref(db, "active_sessions"));
      await set(sid, {
        userId: user.uid,
        email: user.email,
        device: navigator.userAgent,
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      });

      localStorage.setItem("login_sync", Date.now());
      navigate("/users");
    } catch (err) {
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
