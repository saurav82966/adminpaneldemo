import React, { useEffect, useState } from "react";
import { ref, onValue, remove } from "firebase/database";
import { db, auth } from "../firebase";

export default function OnlineAdmins() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const dbPath = localStorage.getItem("dbPath_" + auth.currentUser.uid);

    const onlineRef = ref(db, "onlineAdmins/" + dbPath);

    return onValue(onlineRef, (snap) => {
      const data = snap.val() || {};

      const arr = Object.entries(data).map(([key, info]) => ({
        sessionId: key,
        ...info,
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
    <div style={{ padding:20 }}>
      <h1>Active Admin Sessions</h1>

      {sessions.length === 0 ? (
        <div>No active sessions</div>
      ) : (
        sessions.map((s) => (
          <div key={s.sessionId} style={{
            padding: 12,
            marginBottom: 10,
            border: "1px solid #ccc",
            borderRadius: 6
          }}>
            <h3>{s.email}</h3>
            <div><b>Browser:</b> {s.browser}</div>
            <div><b>Device:</b> {s.platform}</div>
            <div><b>Logged In:</b> {new Date(s.loginTime).toLocaleString()}</div>

            <button 
              onClick={() => forceLogout(s.sessionId)}
              style={{ marginTop: 10, padding: "5px 10px", background:"red", color:"white" }}>
              Logout This Device
            </button>
          </div>
        ))
      )}
    </div>
  );
}
