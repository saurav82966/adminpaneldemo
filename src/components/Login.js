import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const sessionId = localStorage.getItem("sessionId");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await registerSession(user);
        navigate("/devices", { replace: true });
      }
    });

    return () => unsub();
  }, []);

  const registerSession = async (user) => {
    const deviceName = navigator.userAgent;

    await set(ref(db, `activeSessions/${user.uid}/${sessionId}`), {
      deviceName: deviceName,
      lastActive: Date.now()
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      await registerSession(userCred.user);
      navigate("/devices");
    } catch (err) {
      alert("Wrong Email or Password");
    }
  };

  return (
    <div className="card" style={{ maxWidth: "400px", margin: "50px auto" }}>
      <h2>Login</h2>

      <form onSubmit={handleLogin}>
        <input type="email" className="form-input" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />

        <input type="password" className="form-input" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} required />

        <button className="btn btn-primary" type="submit">Login</button>
      </form>

      <p style={{ marginTop: "10px" }}>
        Don't have an account?
        <span style={{ color: "blue", cursor: "pointer" }}
          onClick={() => navigate("/register")}> Register </span>
      </p>
    </div>
  );
}
