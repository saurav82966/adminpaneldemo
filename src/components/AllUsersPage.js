import React, { useState, useEffect } from "react";
import { ref, onValue, off, set, push, remove } from "firebase/database";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

const AllUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDevices, setUserDevices] = useState([]);
  const [activeSessions, setActiveSessions] = useState({});
  const [dbPath, setDbPath] = useState("");
  const navigate = useNavigate();

  // READ CURRENT USER DB PATH
  useEffect(() => {
    const u = auth.currentUser;
    if (u) setDbPath(localStorage.getItem("dbPath_" + u.uid));
  }, []);

  // ACTIVE SESSIONS LIVE TRACKING
  useEffect(() => {
    const refx = ref(db, "active_sessions");

    const unsub = onValue(refx, (snap) => {
      const obj = {};
      snap.forEach((x) => (obj[x.key] = x.val()));
      setActiveSessions(obj);
    });

    return () => off(refx, "value", unsub);
  }, []);

  // LOAD USERS OF SAME DB
  useEffect(() => {
    if (!dbPath) return;

    const usersRef = ref(db, "users");

    const unsub = onValue(usersRef, (snap) => {
      const arr = [];
      snap.forEach((x) => {
        const u = x.val();
        if (u.dbPath === dbPath)
          arr.push({ id: x.key, email: u.email, dbPath: u.dbPath });
      });
      setUsers(arr);
    });

    return () => off(usersRef, "value", unsub);
  }, [dbPath]);

  const countSessions = (uid) =>
    Object.values(activeSessions).filter((x) => x.userId === uid).length;

  // LOGOUT USER (REMOTE LOGOUT)
  const handleLogoutUser = async (uid) => {
    if (!window.confirm("Logout this user from all devices?")) return;

    // REMOVE ALL SESSIONS FOR THIS USER
    Object.entries(activeSessions).forEach(([sid, ses]) => {
      if (ses.userId === uid) {
        remove(ref(db, "active_sessions/" + sid));
      }
    });

    // FORCE LOGOUT SYNC
    localStorage.setItem("force_logout", Date.now());

    // If logging current user
    if (uid === auth.currentUser?.uid) {
      await signOut(auth);
      navigate("/login");
    }
  };

  return (
    <div className="all-users-container">
      <h2>All Users (DB: {dbPath})</h2>

      <div className="users-grid">
        {users.map((u) => (
          <div className="user-card" key={u.id}>
            <h4>{u.email}</h4>

            <p>Active Sessions: {countSessions(u.id)}</p>

            <button
              className="btn btn-danger"
              onClick={() => handleLogoutUser(u.id)}
            >
              Logout User
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AllUsersPage;
