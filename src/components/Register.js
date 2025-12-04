import React, { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { ref, set } from "firebase/database";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dbPath, setDbPath] = useState("");

  // ⭐ Already logged-in user register page mat dekhe
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/devices", { replace: true });
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // ⭐ Save user dbPath in Firebase
      await set(ref(db, "users/" + user.uid), {
        email: email,
        dbPath: dbPath
      });

      alert("Account Created Successfully!");
      navigate("/login");
    } catch (err) {
      alert("Registration failed");
    }
  };

  return (
    <div className="card" style={{ maxWidth: "400px", margin: "50px auto" }}>
      <h2>Register</h2>

      <form onSubmit={handleRegister}>
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

        {/* ⭐ Database Path */}
        <input
          type="text"
          className="form-input"
          placeholder="Enter Database Path (e.g., devices1)"
          value={dbPath}
          onChange={(e) => setDbPath(e.target.value)}
          required
        />

        <button className="btn btn-primary" type="submit">Create Account</button>
      </form>

      <p style={{ marginTop: "10px" }}>
        Already have an account?{" "}
        <span
          style={{ color: "blue", cursor: "pointer" }}
          onClick={() => navigate("/login")}
        >
          Login
        </span>
      </p>
    </div>
  );
}
