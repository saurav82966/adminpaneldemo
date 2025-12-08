import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { ref, onValue, remove } from "firebase/database";
import { FiMonitor, FiSmartphone, FiTablet, FiWifi, FiWifiOff, FiUser, FiClock, FiActivity, FiRadio } from "react-icons/fi";
import { RiComputerLine, RiSmartphoneLine, RiTabletLine } from "react-icons/ri";

export default function SessionsPage() {
  const [sessions, setSessions] = useState({});
  const [liveCount, setLiveCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const sessionId = localStorage.getItem("sessionId");
  const user = auth.currentUser;

  // ⭐ REAL-TIME CLOCK UPDATE (EVERY 500ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;

    const sessionRef = ref(db, `activeSessions/${user.uid}`);
    
    const unsubscribe = onValue(sessionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setSessions(data);
        
        // Count live sessions
        const live = Object.values(data).filter(
          session => now - session.lastActive < 3000
        ).length;
        setLiveCount(live);
      } else {
        setSessions({});
        setLiveCount(0);
      }
    });

    return () => unsubscribe();
  }, [user, now]);

  const logoutDevice = async (id) => {
    if (!user) return;
    
    try {
      await remove(ref(db, `activeSessions/${user.uid}/${id}`));

      if (id === sessionId) {
        localStorage.removeItem("sessionId");
        await auth.signOut();
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Device type detection with icons
  const getDeviceInfo = (deviceName) => {
    if (!deviceName) return { type: "Unknown", icon: <FiUser />, color: "#9E9E9E" };
    
    if (/mobile|android|iphone/i.test(deviceName)) {
      return { type: "Mobile", icon: <RiSmartphoneLine />, color: "#4CAF50" };
    } else if (/tablet|ipad/i.test(deviceName)) {
      return { type: "Tablet", icon: <RiTabletLine />, color: "#2196F3" };
    } else {
      return { type: "Desktop", icon: <RiComputerLine />, color: "#FF9800" };
    }
  };

  // Calculate time difference
  const getTimeDifference = (lastActive) => {
    const diff = now - lastActive;
    
    if (diff < 3000) return "Just now";
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  // Sort sessions - live first, then by recency
  const sortedSessions = Object.entries(sessions)
    .sort(([idA, sessionA], [idB, sessionB]) => {
      const isALive = now - sessionA.lastActive < 3000;
      const isBLive = now - sessionB.lastActive < 3000;
      
      if (isALive && !isBLive) return -1;
      if (!isALive && isBLive) return 1;
      
      return sessionB.lastActive - sessionA.lastActive;
    });

  return (
    <div style={{ maxWidth: "1000px", margin: "20px auto" }}>
      {/* 🔴 HEADER WITH STATS */}
      <div style={{ 
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        borderRadius: "16px",
        padding: "25px 30px",
        color: "white",
        marginBottom: "30px",
        boxShadow: "0 8px 32px rgba(102, 126, 234, 0.3)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "28px", display: "flex", alignItems: "center", gap: "12px" }}>
              <FiActivity style={{ fontSize: "32px" }} />
              Live Devices Monitor
            </h1>
            <p style={{ margin: "8px 0 0 0", opacity: 0.9, fontSize: "15px" }}>
              Real-time tracking of all connected devices
            </p>
          </div>
          
          <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "36px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
                <FiWifi style={{ color: "#4CAF50" }} />
                {liveCount}
              </div>
              <div style={{ fontSize: "14px", opacity: 0.9 }}>Live Now</div>
            </div>
            
            <div style={{ width: "2px", background: "rgba(255,255,255,0.2)" }}></div>
            
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "36px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>
                <FiMonitor />
                {Object.keys(sessions).length}
              </div>
              <div style={{ fontSize: "14px", opacity: 0.9 }}>Total Connected</div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔴 DEVICES GRID */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", 
        gap: "20px",
        marginBottom: "30px"
      }}>
        {sortedSessions.length === 0 ? (
          <div style={{ 
            gridColumn: "1/-1", 
            textAlign: "center", 
            padding: "60px 20px",
            background: "#f8f9fa",
            borderRadius: "16px",
            border: "2px dashed #dee2e6"
          }}>
            <FiWifiOff style={{ fontSize: "64px", color: "#adb5bd", marginBottom: "20px" }} />
            <h3 style={{ color: "#6c757d", marginBottom: "10px" }}>No Active Devices</h3>
            <p style={{ color: "#adb5bd" }}>Waiting for devices to connect...</p>
          </div>
        ) : (
          sortedSessions.map(([id, session]) => {
            const isCurrentDevice = id === sessionId;
            const isLive = now - session.lastActive < 3000;
            const deviceInfo = getDeviceInfo(session.deviceName);
            const timeAgo = getTimeDifference(session.lastActive);
            
            return (
              <div 
                key={id}
                style={{ 
                  background: "white",
                  borderRadius: "16px",
                  padding: "20px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                  border: isCurrentDevice ? "2px solid #667eea" : "1px solid #e9ecef",
                  position: "relative",
                  overflow: "hidden",
                  transition: "all 0.3s ease",
                  opacity: isLive ? 1 : 0.85,
                  transform: isLive ? "translateY(-2px)" : "none"
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-4px)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = isLive ? "translateY(-2px)" : "none"}
              >
                {/* Live indicator ribbon */}
                {isLive && (
                  <div style={{
                    position: "absolute",
                    top: "15px",
                    right: "-30px",
                    background: "#4CAF50",
                    color: "white",
                    padding: "4px 40px",
                    transform: "rotate(45deg)",
                    fontSize: "12px",
                    fontWeight: "bold",
                    boxShadow: "0 2px 4px rgba(76, 175, 80, 0.3)"
                  }}>
                    LIVE
                  </div>
                )}
                
                {/* Current device badge */}
                {isCurrentDevice && (
                  <div style={{
                    position: "absolute",
                    top: "3px",
                    left: "3px",
                    background: "#667eea",
                    color: "white",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: "5px"
                  }}>
                    <FiUser size={12} />
                    This Device
                  </div>
                )}

                {/* Device header */}
                <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
                  <div style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "12px",
                    background: `linear-gradient(135deg, ${deviceInfo.color}20, ${deviceInfo.color}40)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                    color: deviceInfo.color
                  }}>
                    {deviceInfo.icon}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 5px 0", fontSize: "18px", color: "#212529" }}>
                      {deviceInfo.type} Device
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <FiClock size={14} color="#6c757d" />
                      <span style={{ color: "#6c757d", fontSize: "14px" }}>
                        {timeAgo}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status indicator */}
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "10px", 
                  marginBottom: "20px",
                  padding: "12px",
                  background: isLive ? "#e8f5e9" : "#f8f9fa",
                  borderRadius: "10px"
                }}>
                  <div style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: isLive ? "#4CAF50" : "#6c757d",
                    animation: isLive ? "pulse 1.5s infinite" : "none"
                  }}></div>
                  <span style={{ 
                    color: isLive ? "#2e7d32" : "#6c757d", 
                    fontWeight: "bold",
                    fontSize: "14px"
                  }}>
                    {isLive ? "Active Now" : "Inactive"}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: "13px", color: "#6c757d" }}>
                    {new Date(session.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Session info */}
                <div style={{ 
                  background: "#f8f9fa", 
                  padding: "12px", 
                  borderRadius: "10px",
                  marginBottom: "20px"
                }}>
                  <div style={{ fontSize: "12px", color: "#6c757d", marginBottom: "5px" }}>
                    Session ID
                  </div>
                  <div style={{ 
                    fontFamily: "monospace", 
                    fontSize: "11px", 
                    color: "#495057",
                    wordBreak: "break-all"
                  }}>
                    {id.substring(0, 24)}...
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={() => logoutDevice(id)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: isCurrentDevice 
                      ? "linear-gradient(135deg, #ff4444, #cc0000)" 
                      : "linear-gradient(135deg, #f5f5f5, #e0e0e0)",
                    color: isCurrentDevice ? "white" : "#495057",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 0.3s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (isCurrentDevice) {
                      e.currentTarget.style.background = "linear-gradient(135deg, #ff3333, #b30000)";
                    } else {
                      e.currentTarget.style.background = "linear-gradient(135deg, #e0e0e0, #d0d0d0)";
                      e.currentTarget.style.color = "#212529";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isCurrentDevice) {
                      e.currentTarget.style.background = "linear-gradient(135deg, #ff4444, #cc0000)";
                    } else {
                      e.currentTarget.style.background = "linear-gradient(135deg, #f5f5f5, #e0e0e0)";
                      e.currentTarget.style.color = "#495057";
                    }
                  }}
                >
                  {isCurrentDevice ? (
                    <>
                      <FiRadio size={16} />
                      Logout This Device
                    </>
                  ) : (
                    "Remove Device"
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 🔴 LEGEND / INFO SECTION */}
      <div style={{ 
        background: "#f8f9fa", 
        borderRadius: "16px", 
        padding: "20px",
        marginTop: "30px"
      }}>
        <h4 style={{ margin: "0 0 15px 0", color: "#495057", display: "flex", alignItems: "center", gap: "10px" }}>
          <FiActivity />
          Device Status Legend
        </h4>
        
        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#4CAF50", animation: "pulse 1.5s infinite" }}></div>
            <span style={{ fontSize: "14px", color: "#495057" }}>Live (Active within 3 seconds)</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#6c757d" }}></div>
            <span style={{ fontSize: "14px", color: "#495057" }}>Inactive (No recent activity)</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#667eea" }}></div>
            <span style={{ fontSize: "14px", color: "#495057" }}>Current Device (You are here)</span>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.05); }
            100% { opacity: 1; transform: scale(1); }
          }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .device-card {
            animation: fadeIn 0.5s ease forwards;
          }
        `}
      </style>
    </div>
  );
}