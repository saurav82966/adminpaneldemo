import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db, auth } from "../firebase";

export default function OnlineAdmins() {
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    const dbPath = localStorage.getItem("dbPath_" + auth.currentUser.uid);
    const onlineRef = ref(db, "onlineAdmins/" + dbPath);

    return onValue(onlineRef, (snap) => {
      const data = snap.val() || {};

      const list = Object.entries(data).map(([sid, info]) => ({
        sessionId: sid,
        ...info
      }));

      setAdmins(list);
    });
  }, []);

  return (
    <div className="card" style={{ margin: 20 }}>
      <h1>🟢 Online Admin Sessions</h1>

      {admins.length === 0 ? (
        <div>No admins online.</div>
      ) : (
        admins.map(a => (
          <div key={a.sessionId} className="admin-card">
            <h3>{a.email}</h3>
            <div><strong>Browser:</strong> {a.browser}</div>
            <div><strong>Device:</strong> {a.platform}</div>
            <div><strong>Session ID:</strong> {a.sessionId}</div>
            <div><strong>Last Active:</strong> {new Date(a.lastActive).toLocaleString()}</div>
          </div>
        ))
      )}
    </div>
  );
}
