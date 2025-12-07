import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { ref, remove } from "firebase/database";
import { db } from "../firebase";

const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        // Check our custom auth permission
        const authAllowed = localStorage.getItem("auth_allowed_" + currentUser.uid);
        const forceLogoutTime = localStorage.getItem(`force_logout_${currentUser.uid}`);
        
        if (!authAllowed || authAllowed !== "true") {
          // Auth not allowed by our system
          await auth.signOut();
          localStorage.removeItem(`dbPath_${currentUser.uid}`);
          localStorage.removeItem("current_session_id");
          setUser(null);
        } else if (forceLogoutTime) {
          // Force logout active
          const logoutTime = parseInt(forceLogoutTime);
          const currentTime = Date.now();
          
          if (currentTime - logoutTime < 24 * 60 * 60 * 1000) {
            // Logout and cleanup
            const sessionId = localStorage.getItem("current_session_id");
            if (sessionId) {
              await remove(ref(db, `active_sessions/${sessionId}`));
            }
            
            await auth.signOut();
            localStorage.removeItem("auth_allowed_" + currentUser.uid);
            localStorage.removeItem(`dbPath_${currentUser.uid}`);
            localStorage.removeItem("current_session_id");
            setUser(null);
          } else {
            // Clear old logout flag
            localStorage.removeItem(`force_logout_${currentUser.uid}`);
            setUser(currentUser);
          }
        } else {
          setUser(currentUser);
        }
      } else {
        setUser(null);
      }
      
      setLoading(false);
    };

    const unsub = auth.onAuthStateChanged(() => {
      checkAuth();
    });

    // Listen for logout events
    const handleStorageChange = (e) => {
      if (e.key === 'auth_revoked' || 
          (e.key && e.key.startsWith('force_logout_') && 
           e.key.includes(auth.currentUser?.uid))) {
        window.location.reload();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      unsub();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="ms-2">Verifying session...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;