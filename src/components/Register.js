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
  const [loading, setLoading] = useState(false);

  // ⭐ Already logged-in user → register page na dikhaye
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) navigate("/devices", { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  const handleRegister = async (e) => {
    e.preventDefault();

    // Basic validations
    if (password.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    }

    if (dbPath.trim() === "") {
      alert("Database Path cannot be empty");
      return;
    }

    setLoading(true);

    try {
      // CREATE AUTH USER
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.toLowerCase(),
        password
      );
      const user = userCredential.user;

      // SAVE USER DATA IN DATABASE
      await set(ref(db, "users/" + user.uid), {
        email: email.toLowerCase(),
        dbPath: dbPath.trim(),
        sessionVersion: 1 // ⭐ MUST for password-change logout logic
      });

      alert("Account Created Successfully!");

      // Clear form
      setEmail("");
      setPassword("");
      setDbPath("");

      navigate("/login");
    } catch (err) {
      console.error("Register Error:", err);

      let msg = "Registration failed";

      if (err.code === "auth/email-already-in-use") msg = "Email already exists";
      if (err.code === "auth/invalid-email") msg = "Invalid email address";
      if (err.code === "auth/weak-password") msg = "Weak password";

      alert(msg);
    }

    setLoading(false);
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
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {/* ⭐ DATABASE PATH */}
        <input
          type="text"
          className="form-input"
          placeholder="Enter Database Path (e.g., devices1)"
          value={dbPath}
          onChange={(e) => setDbPath(e.target.value)}
          required
        />

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Account"}
        </button>
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
