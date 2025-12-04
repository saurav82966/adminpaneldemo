import React from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { db } from "../firebase";
import { ref, remove } from "firebase/database";

export default function Navbar() {
  const location = useLocation();
  if (location.pathname === "/login" || location.pathname === "/register") return null;

  const logoutUser = async () => {
    const user = auth.currentUser;
    const sessionId = localStorage.getItem("SESSION_ID");

    if (user && sessionId) {
      const dbPath = localStorage.getItem("dbPath_" + user.uid);

      await remove(ref(db, `onlineAdmins/${dbPath}/${sessionId}`));
      localStorage.removeItem("SESSION_ID");
    }

    signOut(auth);
  };

  return (
    <nav className="navbar">
      <Link to="/devices">Devices</Link>
      <Link to="/sms">All SMS</Link>
      <Link to="/online-admins">Online Admins</Link>
      <button onClick={logoutUser} style={{ background:"red", color:"white" }}>Logout</button>
    </nav>
  );
}
