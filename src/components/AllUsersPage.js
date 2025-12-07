import React, { useState, useEffect } from "react";
import { ref, onValue, off, remove, query, equalTo, get } from "firebase/database";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

const AllUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [activeSessions, setActiveSessions] = useState({});
  const [dbPath, setDbPath] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const navigate = useNavigate();

  // Get current user info
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

  // ACTIVE SESSIONS LIVE TRACKING - improved
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

  // LOAD USERS OF SAME DB PATH
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

  // Count active sessions for a specific user
  const countSessions = (userId) => {
    return Object.values(activeSessions).filter(session => 
      session.userId === userId
    ).length;
  };

  // Get active sessions for a specific user
  const getUserSessions = (userId) => {
    return Object.entries(activeSessions)
      .filter(([_, session]) => session.userId === userId)
      .map(([sessionId, session]) => ({ sessionId, ...session }));
  };

  // LOGOUT USER FROM ALL DEVICES
  const handleLogoutUser = async (userId) => {
    const userSessions = getUserSessions(userId);
    
    if (userSessions.length === 0) {
      alert("User is not logged in on any device");
      return;
    }

    if (!window.confirm(`Logout this user from ${userSessions.length} device(s)?`)) {
      return;
    }

    try {
      // Remove all sessions for this user
      const deletePromises = userSessions.map(session => 
        remove(ref(db, `active_sessions/${session.sessionId}`))
      );
      
      await Promise.all(deletePromises);
      
      // If logging out current user
      if (userId === currentUserId) {
        // Clear local session
        localStorage.removeItem("dbPath_" + userId);
        
        // Sign out from Firebase Auth
        await signOut(auth);
        
        // Broadcast logout to other tabs
        localStorage.setItem("force_logout_" + userId, Date.now().toString());
        
        navigate("/login");
        return;
      }
      
      // For other users, broadcast logout to their devices
      localStorage.setItem("force_logout_" + userId, Date.now().toString());
      
      alert(`User logged out from ${userSessions.length} device(s)`);
    } catch (error) {
      console.error("Error logging out user:", error);
      alert("Failed to logout user");
    }
  };

  // LOGOUT FROM SPECIFIC DEVICE
  const handleLogoutDevice = async (sessionId, userId) => {
    if (!window.confirm("Logout from this specific device?")) return;
    
    try {
      await remove(ref(db, `active_sessions/${sessionId}`));
      
      // Broadcast to specific user's devices
      localStorage.setItem("force_logout_" + userId, Date.now().toString());
      
      // If this is current user's session, check if we need to logout locally
      if (userId === currentUserId) {
        const currentSessionId = localStorage.getItem("current_session_id");
        if (currentSessionId === sessionId) {
          await signOut(auth);
          localStorage.removeItem("dbPath_" + userId);
          localStorage.removeItem("current_session_id");
          navigate("/login");
        }
      }
    } catch (error) {
      console.error("Error logging out device:", error);
    }
  };

  return (
    <div className="all-users-container">
      <h2>All Users (Database: {dbPath || "Not set"})</h2>
      
      <div className="users-grid">
        {users.length === 0 ? (
          <p>No users found in this database</p>
        ) : (
          users.map((user) => {
            const sessionCount = countSessions(user.id);
            const userSessions = getUserSessions(user.id);
            
            return (
              <div className="user-card" key={user.id}>
                <div className="user-header">
                  <h4>{user.email}</h4>
                  <span className={`session-badge ${sessionCount > 0 ? 'active' : 'inactive'}`}>
                    {sessionCount} active session(s)
                  </span>
                </div>
                
                <div className="user-sessions">
                  <h5>Active Devices:</h5>
                  {userSessions.length > 0 ? (
                    <ul className="sessions-list">
                      {userSessions.map((session) => (
                        <li key={session.sessionId} className="session-item">
                          <div>
                            <strong>Device:</strong> {session.device ? 
                              (session.device.includes('Mobile') ? 'Mobile' : 
                               session.device.includes('Android') ? 'Android' : 
                               session.device.includes('iPhone') ? 'iPhone' : 
                               session.device) : 'Unknown device'}
                          </div>
                          <div>
                            <small>Logged in: {new Date(session.loginTime).toLocaleString()}</small>
                          </div>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleLogoutDevice(session.sessionId, user.id)}
                            title="Logout from this device only"
                          >
                            Logout Device
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">No active sessions</p>
                  )}
                </div>
                
                <div className="user-actions">
                  <button
                    className="btn btn-danger"
                    onClick={() => handleLogoutUser(user.id)}
                    disabled={sessionCount === 0}
                    title={sessionCount === 0 ? "User is not logged in" : "Logout from all devices"}
                  >
                    Logout All Devices
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