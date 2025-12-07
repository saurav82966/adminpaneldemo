import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { ref, onValue, remove } from "firebase/database";

export default function SessionsPage() {
  const [sessions, setSessions] = useState({});
  const sessionId = localStorage.getItem("sessionId");
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    const sessionRef = ref(db, `activeSessions/${user.uid}`);
    return onValue(sessionRef, (snap) => {
      if (snap.exists()) setSessions(snap.val());
      else setSessions({});
    });
  }, []);

  const logoutDevice = async (id) => {
    await remove(ref(db, `activeSessions/${user.uid}/${id}`));

    if (id === sessionId) {
      auth.signOut();
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "20px auto" }}>
      <h2>Logged Devices</h2>

      {Object.keys(sessions).length === 0 && <p>No active devices.</p>}

      {Object.entries(sessions).map(([id, d]) => (
        <div key={id}
          style={{ padding: "10px", border: "1px solid #ddd", marginTop: "10px" }}>

          <p><b>Device:</b> {d.deviceName}</p>
          <p><b>Last Active:</b> {new Date(d.lastActive).toLocaleString()}</p>

          <button
            onClick={() => logoutDevice(id)}
            style={{
              background: id === sessionId ? "red" : "orange",
              color: "white",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none"
            }}>
            {id === sessionId ? "Logout This Device" : "Logout Remote Device"}
          </button>
        </div>
      ))}
    </div>
  );
}
