import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { ref, onValue, remove } from "firebase/database";

export default function SessionsPage() {
  const [sessions, setSessions] = useState({});
  const [liveSessions, setLiveSessions] = useState([]);
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
        
        // 🔴 LIVE SESSIONS FILTER (last 3 seconds)
        const liveDevices = Object.entries(data)
          .filter(([_, session]) => now - session.lastActive < 3000)
          .map(([id, session]) => ({ id, ...session }));
        
        setLiveSessions(liveDevices);
      } else {
        setSessions({});
        setLiveSessions([]);
      }
    });

    return () => unsubscribe();
  }, [user, now]);

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
    <div style={{ maxWidth: "900px", margin: "20px auto", padding: "0 20px" }}>
      {/* 🔴 PAGE HEADER WITH LIVE COUNTER */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div>
          <h2 style={{ margin: 0 }}>Live Devices</h2>
          <p style={{ margin: '5px 0 0 0', color: '#666' }}>
            Real-time monitoring of active devices
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{
            background: '#e8f5e9',
            padding: '10px 20px',
            borderRadius: '10px',
            textAlign: 'center',
            minWidth: '120px'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4CAF50' }}>
              {liveSessions.length}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              Live Now
            </div>
          </div>
          
          <div style={{
            background: '#f5f5f5',
            padding: '10px 20px',
            borderRadius: '10px',
            textAlign: 'center',
            minWidth: '120px'
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
              {Object.keys(sessions).length}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              Total Devices
            </div>
          </div>
        </div>
      </div>

      {/* 🔴 LIVE DEVICES SECTION */}
      {liveSessions.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            color: '#4CAF50',
            marginBottom: '15px'
          }}>
            <span style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              backgroundColor: '#4CAF50',
              borderRadius: '50%',
              animation: 'pulse 1s infinite'
            }}></span>
            Currently Active ({liveSessions.length})
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {liveSessions.map(({ id, ...session }) => {
              const isCurrentDevice = id === sessionId;
              
              return (
                <div 
                  key={id}
                  style={{ 
                    padding: '15px',
                    border: `2px solid ${isCurrentDevice ? '#4CAF50' : '#4CAF50'}`,
                    borderRadius: '10px',
                    backgroundColor: '#f0fff4',
                    boxShadow: '0 2px 8px rgba(76, 175, 80, 0.2)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>
                        {getDeviceDisplayName(session.deviceName)}
                        {isCurrentDevice && (
                          <span style={{ 
                            marginLeft: '8px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px'
                          }}>
                            This Device
                          </span>
                        )}
                      </p>
                      
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        marginBottom: '8px'
                      }}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#4CAF50',
                          borderRadius: '50%',
                          animation: 'pulse 1s infinite'
                        }}></span>
                        <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '14px' }}>
                          LIVE
                        </span>
                      </div>
                      
                      <p style={{ margin: '0', color: '#555', fontSize: '13px' }}>
                        Last update: {getTimeDifference(session.lastActive)}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => logoutDevice(id)}
                      style={{
                        background: isCurrentDevice ? '#ff4444' : '#ff9800',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isCurrentDevice ? 'Logout' : 'Remove'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🔴 ALL DEVICES SECTION */}
      <div>
        <h3 style={{ marginBottom: '15px', color: '#666' }}>
          All Connected Devices
        </h3>
        
        {Object.keys(sessions).length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            backgroundColor: '#f9f9f9',
            borderRadius: '10px',
            color: '#999'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>📱</div>
            <p>No devices connected yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {Object.entries(sessions).map(([id, d]) => {
              const isCurrentDevice = id === sessionId;
              const isLive = now - d.lastActive < 3000; // 3 seconds for LIVE
              
              return (
                <div 
                  key={id}
                  style={{ 
                    padding: '15px',
                    border: `2px solid ${isCurrentDevice ? '#2196F3' : '#ddd'}`,
                    borderRadius: '10px',
                    backgroundColor: isCurrentDevice ? '#f0f8ff' : 'white',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                    opacity: isLive ? 1 : 0.8
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                          {getDeviceDisplayName(d.deviceName)}
                        </p>
                        
                        {isLive && (
                          <span style={{
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span style={{
                              display: 'inline-block',
                              width: '6px',
                              height: '6px',
                              backgroundColor: 'white',
                              borderRadius: '50%'
                            }}></span>
                            LIVE
                          </span>
                        )}
                        
                        {isCurrentDevice && (
                          <span style={{ 
                            backgroundColor: '#2196F3',
                            color: 'white',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '11px'
                          }}>
                            This Device
                          </span>
                        )}
                      </div>
                      
                      <p style={{ margin: '5px 0', color: '#555', fontSize: '14px' }}>
                        <strong>Last Active:</strong> {getTimeDifference(d.lastActive)} 
                      </p>
                      
                      <p style={{ margin: '5px 0', color: '#777', fontSize: '12px', wordBreak: 'break-all' }}>
                        Session: {id.substring(0, 15)}...
                      </p>
                    </div>
                    
                    <button
                      onClick={() => logoutDevice(id)}
                      style={{
                        background: isCurrentDevice ? '#ff4444' : '#ff9800',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        minWidth: '120px'
                      }}
                    >
                      {isCurrentDevice ? 'Logout This Device' : 'Remove Device'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}