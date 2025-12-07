import React, { useState, useEffect } from "react";
import { ref, onValue, off, remove, set } from "firebase/database";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

const AllUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [activeSessions, setActiveSessions] = useState({});
  const [dbPath, setDbPath] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentUserId(user.uid);
      const savedPath = localStorage.getItem("dbPath_" + user.uid);
      if (savedPath) {
        setDbPath(savedPath);
      }
    }
  }, []);

  // Track active sessions
  useEffect(() => {
    const sessionsRef = ref(db, "active_sessions");
    
    const unsub = onValue(sessionsRef, (snapshot) => {
      if (snapshot.exists()) {
        const sessions = {};
        snapshot.forEach((childSnapshot) => {
          sessions[childSnapshot.key] = childSnapshot.val();
        });
        setActiveSessions(sessions);
      } else {
        setActiveSessions({});
      }
    });

    return () => {
      off(sessionsRef, "value", unsub);
    };
  }, []);

  // Load users
  useEffect(() => {
    if (!dbPath) return;

    const usersRef = ref(db, "users");
    
    const unsub = onValue(usersRef, (snapshot) => {
      const usersList = [];
      snapshot.forEach((childSnapshot) => {
        const user = childSnapshot.val();
        if (user.dbPath === dbPath) {
          usersList.push({
            id: childSnapshot.key,
            email: user.email,
            dbPath: user.dbPath
          });
        }
      });
      setUsers(usersList);
    });

    return () => {
      off(usersRef, "value", unsub);
    };
  }, [dbPath]);

  // Get user sessions
  const getUserSessions = (userId) => {
    return Object.entries(activeSessions)
      .filter(([_, session]) => session.userId === userId)
      .map(([sessionId, session]) => ({ sessionId, ...session }));
  };

  // STRONG LOGOUT FUNCTION - Complete user blocking
  const handleLogoutUser = async (userId) => {
    const userSessions = getUserSessions(userId);
    
    if (userSessions.length === 0) {
      alert("User is not logged in on any device");
      return;
    }

    if (!window.confirm(`Logout ${userSessions.length} device(s) for this user? They will need to login again.`)) {
      return;
    }

    try {
      // 1. Remove all Firebase sessions
      const deletePromises = userSessions.map(session => 
        remove(ref(db, `active_sessions/${session.sessionId}`))
      );
      
      await Promise.all(deletePromises);
      
      // 2. Set force logout flag (24 hours validity)
      localStorage.setItem(`force_logout_${userId}`, Date.now().toString());
      
      // 3. Revoke auth permission in ALL devices
      localStorage.setItem("auth_revoked", Date.now().toString());
      
      // 4. Create a logout record in database
      const logoutRecordRef = push(ref(db, "logout_records"));
      await set(logoutRecordRef, {
        userId: userId,
        adminId: currentUserId,
        timestamp: new Date().toISOString(),
        sessionsRemoved: userSessions.length,
        reason: "Admin forced logout"
      });
      
      // 5. If logging out current user
      if (userId === currentUserId) {
        // Remove auth permission locally
        localStorage.removeItem("auth_allowed_" + userId);
        
        // Sign out from Firebase
        await signOut(auth);
        
        // Clear local data
        localStorage.removeItem(`dbPath_${userId}`);
        localStorage.removeItem("current_session_id");
        
        // Redirect to login
        navigate("/login");
        window.location.reload();
      } else {
        // For other users, broadcast logout
        localStorage.setItem(`force_logout_${userId}`, Date.now().toString());
        
        alert(`✅ User logged out from ${userSessions.length} device(s)\nThey will need to login again.`);
      }
    } catch (error) {
      console.error("Logout error:", error);
      alert("Failed to logout user");
    }
  };

  // Logout specific device
  const handleLogoutDevice = async (sessionId, userId) => {
    if (!window.confirm("Logout from this specific device?")) return;
    
    try {
      // Remove session from Firebase
      await remove(ref(db, `active_sessions/${sessionId}`));
      
      // If this device belongs to current user, check locally
      if (userId === currentUserId) {
        const currentSessionId = localStorage.getItem("current_session_id");
        if (currentSessionId === sessionId) {
          // This is current device, logout completely
          localStorage.removeItem("auth_allowed_" + userId);
          await signOut(auth);
          localStorage.removeItem(`dbPath_${userId}`);
          localStorage.removeItem("current_session_id");
          navigate("/login");
        }
      }
      
      alert("Device logged out successfully");
    } catch (error) {
      console.error("Device logout error:", error);
    }
  };

  return (
    <div className="all-users-container">
      <h2>👥 All Users (Database: {dbPath || "Not set"})</h2>
      <p className="text-muted">You can see all active sessions and logout users/devices</p>
      
      <div className="users-grid">
        {users.length === 0 ? (
          <p className="text-center">No users found in this database</p>
        ) : (
          users.map((user) => {
            const userSessions = getUserSessions(user.id);
            const sessionCount = userSessions.length;
            
            return (
              <div className="user-card" key={user.id}>
                <div className="user-header">
                  <div>
                    <h4>{user.email}</h4>
                    <small className="text-muted">User ID: {user.id.substring(0, 8)}...</small>
                  </div>
                  <span className={`badge ${sessionCount > 0 ? 'bg-success' : 'bg-secondary'}`}>
                    {sessionCount} active device(s)
                  </span>
                </div>
                
                <div className="user-sessions mt-3">
                  <h6>📱 Active Devices:</h6>
                  {sessionCount > 0 ? (
                    <div className="sessions-list">
                      {userSessions.map((session) => (
                        <div key={session.sessionId} className="session-item card mb-2">
                          <div className="card-body p-2">
                            <div className="d-flex justify-content-between">
                              <div>
                                <strong>{session.deviceName || "Unknown Device"}</strong>
                                <div className="text-muted small">
                                  {new Date(session.loginTime).toLocaleString()}
                                </div>
                              </div>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleLogoutDevice(session.sessionId, user.id)}
                                title="Logout this device only"
                              >
                                🚪 Logout
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted small">No active sessions</p>
                  )}
                </div>
                
                <div className="user-actions mt-3">
                  <button
                    className="btn btn-danger w-100"
                    onClick={() => handleLogoutUser(user.id)}
                    disabled={sessionCount === 0}
                    title={sessionCount === 0 ? "User is not logged in" : "Logout from ALL devices"}
                  >
                    🚫 Logout All Devices ({sessionCount})
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AllUsersPage;