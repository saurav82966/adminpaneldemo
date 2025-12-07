import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { ref, get, set, push, remove, update } from "firebase/database";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(true);

  /* ---------------------- CHECK IF USER ALREADY LOGGED IN ---------------------- */
  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setChecking(false);
        return;
      }

      // Check block
      const blockSnap = await get(ref(db, `blocked_users/${user.uid}`));
      if (blockSnap.exists()) {
        await forceLogout(user.uid);
        alert("Your account is blocked by admin.");
        setChecking(false);
        return;
      }

      // Recreate session
      await createSession(user);

      navigate("/devices", { replace: true });
      setChecking(false);
    });
  }, []);

  /* --------------------------- FORCE LOGOUT HANDLER ---------------------------- */
  const forceLogout = async (uid) => {
    const sessionId = localStorage.getItem("current_session_id");
    if (sessionId) {
      await remove(ref(db, `active_sessions/${sessionId}`));
    }
    await auth.signOut();
    localStorage.clear();
  };

  /* --------------------------- CREATE NEW SESSION ------------------------------ */
  const createSession = async (user) => {
    const userSnap = await get(ref(db, `users/${user.uid}`));
    if (userSnap.exists()) {
      localStorage.setItem(`dbPath_${user.uid}`, userSnap.val().dbPath);
    }

    const newRef = push(ref(db, "active_sessions"));
    const data = {
      sessionId: newRef.key,
      userId: user.uid,
      email: user.email,
      device: navigator.userAgent,
      deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent)
        ? "Mobile"
        : "Desktop",
      loginTime: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };

    await set(newRef, data);
    localStorage.setItem("current_session_id", newRef.key);

    // Auto-update lastActive every 30 sec
    setInterval(() => {
      update(ref(db, `active_sessions/${newRef.key}`), {
        lastActive: new Date().toISOString(),
      });
    }, 30000);
  };

  /* ----------------------------- HANDLE LOGIN --------------------------------- */
  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      // Check if blocked
      const blockSnap = await get(ref(db, `blocked_users/${user.uid}`));
      if (blockSnap.exists()) {
        await forceLogout(user.uid);
        alert("Your account is blocked.");
        return;
      }

      await createSession(user);
      navigate("/devices");
    } catch (error) {
      alert("Invalid Email or Password");
    }
  };

  if (checking) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border"></div>
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

        <button className="btn btn-primary w-100" type="submit">
          Login
        </button>
      </form>
      <p className="mt-3">
        Don't have an account?{" "}
        <span style={{ color: "blue", cursor: "pointer" }} onClick={() => navigate("/register")}>
          Register
        </span>
      </p>
    </div>
  );
}
