import React, { useEffect, useState } from "react";
import { ref, onValue, remove } from "firebase/database";
import { db, auth } from "../firebase";

export default function OnlineAdmins() {
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    const dbPath = localStorage.getItem("dbPath_" + auth.currentUser.uid);
    const onlineRef = ref(db, "onlineAdmins/" + dbPath);

    return onValue(onlineRef, (snap) => {
      const data = snap.val() || {};

      const list = Object.entries(data).map(([key, info]) => ({
        key,
        ...info
      }));

      setAdmins(list);
    });
  }, []);

  // ❌ Logout Device (Remote)
  const logoutDevice = async (key) => {
    const dbPath = localStorage.getItem("dbPath_" + auth.currentUser.uid);
    await remove(ref(db, `onlineAdmins/${dbPath}/${key}`));
  };

  return (
    <div className="card" style={{ margin: 20 }}>
      <h1>🟢 Active Devices Using This Panel</h1>

      {admins.length === 0 ? (
        <div>No devices online.</div>
      ) : (
        admins.map(a => (
          <div key={a.key} className="admin-card" style={{
            padding: 15,
            marginBottom: 15,
            border: "1px solid #ddd",
            borderRadius: 10
          }}>
            <h3>{a.email}</h3>

            <div><strong>Device:</strong> {a.device}</div>
            <div><strong>Platform:</strong> {a.platform}</div>
            <div><strong>Login:</strong> {new Date(a.loginTime).toLocaleString()}</div>
            <div><strong>Last Active:</strong> {new Date(a.lastActive).toLocaleString()}</div>

            <button 
              onClick={() => logoutDevice(a.key)}
              style={{
                marginTop: 10,
                background: "red",
                color: "white",
                padding: "6px 10px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer"
              }}
            >
              ❌ Logout this device
            </button>
          </div>
        ))
      )}
    </div>
  );
}
