import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { ref, onValue, remove } from "firebase/database";

export default function SessionsPage() {
  const [sessions, setSessions] = useState({});
  const [now, setNow] = useState(Date.now()); // Real-time clock update
  const sessionId = localStorage.getItem("sessionId");
  const user = auth.currentUser;

  // ⭐ REAL-TIME CLOCK UPDATE (EVERY 500ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500); // 0.5 second par update
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;

    const sessionRef = ref(db, `activeSessions/${user.uid}`);
    
    const unsubscribe = onValue(sessionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        
        // Sort sessions - sabse recent wala pehle
        const sortedSessions = Object.entries(data)
          .sort(([, a], [, b]) => b.lastActive - a.lastActive)
          .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {});
        
        setSessions(sortedSessions);
      } else {
        setSessions({});
      }
    });

    return () => unsubscribe();
  }, [user]);

  const logoutDevice = async (id) => {
    if (!user) return;
    
    try {
      await remove(ref(db, `activeSessions/${user.uid}/${id}`));

      if (id === sessionId) {
        // Agar current device logout ho raha hai
        localStorage.removeItem("sessionId");
        await auth.signOut();
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Device name ko shorten karein (better display)
  const getDeviceDisplayName = (deviceName) => {
    if (!deviceName) return "Unknown Device";
    
    // Mobile/Desktop detect karein
    if (/mobile|android|iphone/i.test(deviceName)) {
      return "📱 Mobile Device";
    } else if (/tablet|ipad/i.test(deviceName)) {
      return "📱 Tablet";
    } else {
      return "💻 Desktop/Laptop";
    }
  };

  // Calculate time difference for better display
  const getTimeDifference = (lastActive) => {
    const diff = now - lastActive;
    
    if (diff < 2000) return "Just now";
    if (diff < 60000) return `${Math.floor(diff / 1000)} seconds ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    
    return `${Math.floor(diff / 86400000)} days ago`;
  };

  return (
    <div style={{ maxWidth: "800px", margin: "20px auto", padding: "0 20px" }}>
      <h2>Active Devices</h2>
      
      <div style={{ 
        marginBottom: "20px", 
        padding: "10px",
        backgroundColor: "#f0f8ff",
        borderRadius: "8px",
        fontSize: "14px"
      }}>
        <p>
          <strong>🔄 Live Update:</strong> Page automatically updates every 0.5 seconds<br/>
          <strong>🟢 LIVE NOW:</strong> Device active within last 3 seconds
        </p>
      </div>

      {Object.keys(sessions).length === 0 ? (
        <p style={{ textAlign: "center", color: "#666" }}>No active devices found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {Object.entries(sessions).map(([id, d]) => {
            const isCurrentDevice = id === sessionId;
            const isLive = now - d.lastActive < 3000; // ⭐ 3 seconds for INSTANT detection
            
            return (
              <div 
                key={id}
                style={{ 
                  padding: "15px",
                  border: `2px solid ${isCurrentDevice ? "#4CAF50" : "#ddd"}`,
                  borderRadius: "10px",
                  backgroundColor: isCurrentDevice ? "#f0fff0" : "white",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ margin: "5px 0", fontSize: "16px" }}>
                      <strong>{getDeviceDisplayName(d.deviceName)}</strong>
                      {isCurrentDevice && (
                        <span style={{ 
                          marginLeft: "10px",
                          backgroundColor: "#4CAF50",
                          color: "white",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "12px"
                        }}>
                          This Device
                        </span>
                      )}
                    </p>
                    
                    <p style={{ margin: "5px 0", color: "#555", fontSize: "14px" }}>
                      <strong>Last Active:</strong> {getTimeDifference(d.lastActive)} 
                      ({new Date(d.lastActive).toLocaleTimeString()})
                    </p>
                    
                    <p style={{ margin: "5px 0", color: "#777", fontSize: "12px", wordBreak: "break-all" }}>
                      Session ID: {id.substring(0, 20)}...
                    </p>
                  </div>
                  
                  <div style={{ textAlign: "right" }}>
                    {isLive && (
                      <div style={{
                        backgroundColor: "#00c853",
                        color: "white",
                        padding: "6px 12px",
                        borderRadius: "20px",
                        fontSize: "14px",
                        fontWeight: "bold",
                        marginBottom: "10px",
                        animation: "pulse 1s infinite"
                      }}>
                        🟢 LIVE NOW
                      </div>
                    )}
                    
                    <button
                      onClick={() => logoutDevice(id)}
                      style={{
                        background: isCurrentDevice ? "#ff4444" : "#ff9800",
                        color: "white",
                        padding: "8px 16px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "bold"
                      }}
                    >
                      {isCurrentDevice ? "Logout This Device" : "Remove Device"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}