// OnlineAdmins.js
import React, { useEffect, useState } from "react";
import { ref, onValue, remove } from "firebase/database";
import { db, auth } from "../firebase";

export default function OnlineAdmins() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const user = auth.currentUser;
    const dbPath = localStorage.getItem("dbPath_" + user.uid);

    const onlineRef = ref(db, "onlineAdmins/" + dbPath);

    return onValue(onlineRef, snap => {
      const data = snap.val() || {};

      const arr = Object.entries(data).map(([id, info]) => ({
        sessionId: id,
        ...info
      }));

      setSessions(arr);
    });
  }, []);

  const forceLogout = async (sessionId) => {
    const user = auth.currentUser;
    const dbPath = localStorage.getItem("dbPath_" + user.uid);

    await remove(ref(db, `onlineAdmins/${dbPath}/${sessionId}`));
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>🔐 Active Login Sessions</h1>

      {sessions.length === 0 ? (
        <p>No active logins</p>
      ) : (
        sessions.map(s => (
          <div key={s.sessionId} style={{
            border: "1px solid #ccc",
            marginBottom: 12,
            padding: 14,
            borderRadius: 8
          }}>
            <h3>{s.email}</h3>
            <div><b>Device:</b> {s.browser}</div>
            <div><b>Platform:</b> {s.platform}</div>
            <div><b>Logged At:</b> {new Date(s.loginTime).toLocaleString()}</div>

            <button 
              onClick={() => forceLogout(s.sessionId)}
              style={{ marginTop: 10, background: "red", color: "white", padding: "5px 10px" }}
            >
              Logout This Device
            </button>
          </div>
        ))
      )}
    </div>
  );
}
