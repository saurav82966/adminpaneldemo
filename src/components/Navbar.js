// Navbar.js
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { db } from "../firebase";
import { ref, remove } from "firebase/database";

export default function Navbar() {
  const location = useLocation();
  if (location.pathname === "/login" || location.pathname === "/register") return null;

  const logoutDevice = async () => {
    const user = auth.currentUser;
    const sessionId = localStorage.getItem("DEVICE_SESSION_ID");

    if (user && sessionId) {
      const dbPath = localStorage.getItem("dbPath_" + user.uid);

      await remove(ref(db, `onlineAdmins/${dbPath}/${sessionId}`));
      localStorage.removeItem("DEVICE_SESSION_ID");
    }

    auth.signOut();
  };

  return (
    <nav className="navbar">
      <Link to="/devices">Devices</Link>
      <Link to="/sms">All SMS</Link>
      <Link to="/online-admins">Active Sessions</Link>

      <button onClick={logoutDevice} style={{ background: "red", color: "white" }}>
        Logout
      </button>
    </nav>
  );
}
