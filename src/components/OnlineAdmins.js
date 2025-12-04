import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase";

export default function OnlineAdmins() {
  const [admins, setAdmins] = useState([]);

  useEffect(() => {
    const onlineRef = ref(db, "onlineAdmins");

    return onValue(onlineRef, (snap) => {
      const data = snap.val() || {};

      const list = Object.entries(data).map(([uid, info]) => ({
        uid,
        ...info
      }));

      setAdmins(list);
    });
  }, []);

  return (
    <div className="card" style={{ margin: "20px" }}>
      <h1 style={{ marginBottom: "20px" }}>🟢 Online Admins</h1>

      {admins.length === 0 ? (
        <div className="no-data">No admins online.</div>
      ) : (
        admins.map((a) => (
          <div
            key={a.uid}
            className="admin-card"
            style={{
              padding: "15px",
              marginBottom: "15px",
              borderRadius: "10px",
              border: "1px solid #ddd",
              background: "#fafafa"
            }}
          >
            <h3>{a.email}</h3>
            <div><strong>Browser:</strong> {a.browser}</div>
            <div><strong>Device:</strong> {a.platform}</div>
            <div><strong>Last Active:</strong> {new Date(a.lastActive).toLocaleString()}</div>
          </div>
        ))
      )}
    </div>
  );
}
