import React, { useState, useEffect } from 'react';
import { ref, onValue, off, set, push } from 'firebase/database';
import { db, auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';

const AllUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDevices, setUserDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserDbPath, setCurrentUserDbPath] = useState('');
  const [activeSessions, setActiveSessions] = useState({});
  const navigate = useNavigate();

  // ⭐ Track active sessions
  useEffect(() => {
    const sessionsRef = ref(db, 'active_sessions');
    
    const unsubscribe = onValue(sessionsRef, (snapshot) => {
      const sessionsData = {};
      snapshot.forEach((childSnapshot) => {
        const session = childSnapshot.val();
        sessionsData[childSnapshot.key] = session;
      });
      setActiveSessions(sessionsData);
    });

    return () => off(sessionsRef, 'value', unsubscribe);
  }, []);

  // ⭐ Add current session when component mounts
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const sessionId = `${currentUser.uid}_${Date.now()}`;
      const sessionRef = ref(db, `active_sessions/${sessionId}`);
      
      set(sessionRef, {
        userId: currentUser.uid,
        email: currentUser.email,
        dbPath: localStorage.getItem(`dbPath_${currentUser.uid}`) || '',
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString()
      });

      // Cleanup on unmount
      return () => {
        set(sessionRef, null);
      };
    }
  }, []);

  useEffect(() => {
    // Get current user's database path
    const currentUser = auth.currentUser;
    if (currentUser) {
      const dbPath = localStorage.getItem(`dbPath_${currentUser.uid}`);
      setCurrentUserDbPath(dbPath || '');
    }
  }, []);

  useEffect(() => {
    const usersRef = ref(db, 'users');
    
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const usersData = [];
      snapshot.forEach((childSnapshot) => {
        const user = childSnapshot.val();
        usersData.push({
          id: childSnapshot.key,
          email: user.email,
          dbPath: user.dbPath,
          createdAt: user.createdAt || new Date().toISOString()
        });
      });
      
      // ⭐ FILTER: Sirf same database wale users
      const filteredUsers = usersData.filter(user => 
        user.dbPath === currentUserDbPath
      );
      
      setUsers(filteredUsers);
      setLoading(false);
    });

    return () => off(usersRef, 'value', unsubscribe);
  }, [currentUserDbPath]);

  // ⭐ Get active sessions count for each user
  const getActiveSessionsCount = (userId) => {
    let count = 0;
    Object.values(activeSessions).forEach(session => {
      if (session.userId === userId) {
        count++;
      }
    });
    return count;
  };

  useEffect(() => {
    if (!selectedUser || !selectedUser.dbPath) return;

    setUserDevices([]);
    const devicesRef = ref(db, `${selectedUser.dbPath}/devices`);
    
    const unsubscribe = onValue(devicesRef, (snapshot) => {
      const devicesData = [];
      snapshot.forEach((childSnapshot) => {
        const device = childSnapshot.val();
        devicesData.push({
          id: childSnapshot.key,
          name: device.name || 'No Name',
          phone: device.phone || 'No Phone',
          lastSeen: device.lastSeen || 'Never',
          status: device.status || 'offline'
        });
      });
      setUserDevices(devicesData);
    });

    return () => off(devicesRef, 'value', unsubscribe);
  }, [selectedUser]);

  const handleUserSelect = (user) => {
    setSelectedUser(user);
  };

  const handleLogoutUser = async (userId) => {
    const currentUser = auth.currentUser;
    const isCurrentUser = userId === currentUser?.uid;
    
    if (window.confirm(`Are you sure you want to logout ${isCurrentUser ? 'yourself' : 'this user'}?`)) {
      try {
        // ⭐ Remove all active sessions for this user
        Object.entries(activeSessions).forEach(([sessionId, session]) => {
          if (session.userId === userId) {
            const sessionRef = ref(db, `active_sessions/${sessionId}`);
            set(sessionRef, null);
          }
        });

        // ⭐ Add logout record
        const logoutRef = push(ref(db, 'user_logouts'));
        await set(logoutRef, {
          userId: userId,
          email: users.find(u => u.id === userId)?.email || '',
          logoutTime: new Date().toISOString(),
          loggedOutBy: currentUser?.uid
        });

        // ⭐ If logging out current user
        if (isCurrentUser) {
          localStorage.setItem('firebase_logout_event', Date.now().toString());
          await signOut(auth);
          navigate('/login');
        } else {
          alert(`User logged out from all devices/sessions`);
        }
      } catch (error) {
        console.error('Error logging out user:', error);
        alert('Failed to logout user');
      }
    }
  };

  const handleBackToUsers = () => {
    setSelectedUser(null);
  };

  // ⭐ Check if user is current user
  const isCurrentUser = (userId) => {
    return userId === auth.currentUser?.uid;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="all-users-container">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px' 
      }}>
        <h2>
          {selectedUser ? `${selectedUser.email}'s Devices` : 'All Users'}
          {currentUserDbPath && (
            <span style={{ 
              fontSize: '14px', 
              color: '#666', 
              marginLeft: '10px',
              background: '#f0f0f0',
              padding: '4px 8px',
              borderRadius: '4px'
            }}>
              Database: {currentUserDbPath}
            </span>
          )}
        </h2>
        
        {!selectedUser && (
          <div style={{ 
            background: '#4CAF50', 
            color: 'white', 
            padding: '8px 16px', 
            borderRadius: '4px',
            fontWeight: 'bold'
          }}>
            Active Sessions: {Object.keys(activeSessions).length}
          </div>
        )}
      </div>

      {!selectedUser ? (
        <div>
          {users.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px', 
              background: 'white', 
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#666', marginBottom: '10px' }}>
                No users found in your database
              </h3>
              <p style={{ color: '#999' }}>
                Database: <strong>{currentUserDbPath}</strong>
              </p>
            </div>
          ) : (
            <div className="users-grid">
              {users.map((user) => {
                const activeSessionCount = getActiveSessionsCount(user.id);
                const isCurrent = isCurrentUser(user.id);
                
                return (
                  <div key={user.id} className="user-card">
                    <div className="user-info">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4>
                          {user.email}
                          {isCurrent && (
                            <span style={{ 
                              fontSize: '12px', 
                              color: '#4CAF50', 
                              marginLeft: '8px',
                              background: '#e8f5e9',
                              padding: '2px 8px',
                              borderRadius: '12px'
                            }}>
                              You
                            </span>
                          )}
                        </h4>
                        <div style={{ 
                          background: activeSessionCount > 0 ? '#4CAF50' : '#f44336', 
                          color: 'white', 
                          padding: '4px 8px', 
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {activeSessionCount} active session{activeSessionCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <p><strong>Database:</strong> {user.dbPath}</p>
                      <p><strong>User ID:</strong> {user.id}</p>
                      <p><strong>Created:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                    
                    <div className="user-actions">
                      <button 
                        onClick={() => handleUserSelect(user)}
                        className="btn btn-primary"
                        style={{ marginBottom: '8px' }}
                      >
                        View Devices
                      </button>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleLogoutUser(user.id)}
                          className="btn btn-danger"
                          style={{ flex: 1 }}
                        >
                          {isCurrent ? 'Logout Me' : 'Logout User'}
                        </button>
                        
                        {activeSessionCount > 0 && (
                          <button 
                            onClick={() => handleLogoutUser(user.id)}
                            className="btn btn-warning"
                            style={{ 
                              background: '#ff9800',
                              color: 'white',
                              flex: 1
                            }}
                            title="Logout from all devices"
                          >
                            Logout All
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="devices-view">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              onClick={handleBackToUsers}
              className="btn btn-secondary"
              style={{ marginBottom: '20px' }}
            >
              ← Back to All Users
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#666' }}>
                Database: <strong>{selectedUser.dbPath}</strong>
              </span>
              <div style={{ 
                background: '#4CAF50', 
                color: 'white', 
                padding: '4px 8px', 
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                Active: {getActiveSessionsCount(selectedUser.id)} session{getActiveSessionsCount(selectedUser.id) !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="devices-list">
            {userDevices.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                background: 'white', 
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ color: '#666', marginBottom: '10px' }}>
                  No devices found for this user
                </h3>
                <p style={{ color: '#999' }}>
                  This user hasn't added any devices yet
                </p>
              </div>
            ) : (
              userDevices.map((device) => (
                <div key={device.id} className="device-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4>{device.name}</h4>
                    <span className={`status-badge ${device.status}`}>
                      {device.status}
                    </span>
                  </div>
                  <p><strong>Phone:</strong> {device.phone}</p>
                  <p><strong>Last Seen:</strong> {device.lastSeen}</p>
                  <p><strong>Device ID:</strong> {device.id}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AllUsersPage;