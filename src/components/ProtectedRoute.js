import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";
import { ref, remove } from "firebase/database";
import { db } from "../firebase";

const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
      
      if (user) {
        // Check if user is force logged out
        const forceLogoutKey = `force_logout_${user.uid}`;
        const forceLogoutTime = localStorage.getItem(forceLogoutKey);
        
        if (forceLogoutTime) {
          const logoutTime = parseInt(forceLogoutTime);
          const currentTime = Date.now();
          
          if (currentTime - logoutTime < 5 * 60 * 1000) {
            // Clean up session
            const sessionId = localStorage.getItem("current_session_id");
            if (sessionId) {
              remove(ref(db, `active_sessions/${sessionId}`));
            }
            
            // Sign out
            auth.signOut();
            localStorage.removeItem(forceLogoutKey);
            localStorage.removeItem(`dbPath_${user.uid}`);
            localStorage.removeItem("current_session_id");
            
            // Redirect
            window.location.href = "/login";
          } else {
            localStorage.removeItem(forceLogoutKey);
          }
        }
      }
    });

    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith('force_logout_')) {
        const userId = e.key.replace('force_logout_', '');
        const currentUser = auth.currentUser;
        
        if (currentUser && currentUser.uid === userId) {
          // Clean up session
          const sessionId = localStorage.getItem("current_session_id");
          if (sessionId) {
            remove(ref(db, `active_sessions/${sessionId}`));
          }
          
          auth.signOut();
          localStorage.removeItem(`dbPath_${userId}`);
          localStorage.removeItem("current_session_id");
          
          window.location.href = "/login";
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      unsub();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: "center", paddingTop: "40px" }}>Loading...</div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;