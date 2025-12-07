import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";
import { ref, get, remove } from "firebase/database";
import { db } from "../firebase";

const ProtectedRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        // Check if user is blocked
        try {
          const blockedRef = ref(db, `blocked_users/${currentUser.uid}`);
          const blockedSnap = await get(blockedRef);
          
          if (blockedSnap.exists()) {
            // User is blocked
            setIsBlocked(true);
            await auth.signOut();
            localStorage.clear();
            setUser(null);
          } else {
            // Check force logout
            const forceLogout = localStorage.getItem(`force_logout_${currentUser.uid}`);
            if (forceLogout) {
              const logoutTime = parseInt(forceLogout);
              if (Date.now() - logoutTime < 5 * 60 * 1000) {
                // Remove session from Firebase
                const sessionId = localStorage.getItem("current_session_id");
                if (sessionId) {
                  await remove(ref(db, `active_sessions/${sessionId}`));
                }
                
                await auth.signOut();
                localStorage.removeItem(`force_logout_${currentUser.uid}`);
                localStorage.removeItem(`dbPath_${currentUser.uid}`);
                localStorage.removeItem("current_session_id");
                setUser(null);
              } else {
                localStorage.removeItem(`force_logout_${currentUser.uid}`);
                setUser(currentUser);
              }
            } else {
              setUser(currentUser);
            }
          }
        } catch (error) {
          console.error("Auth check error:", error);
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

    // Listen for block events
    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith('user_blocked_')) {
        const blockedUserId = e.key.replace('user_blocked_', '');
        if (auth.currentUser?.uid === blockedUserId) {
          window.location.reload();
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
      <div className="text-center mt-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="text-center mt-5">
        <h3 className="text-danger">Account Blocked</h3>
        <p>Your account has been blocked by administrator.</p>
        <button 
          className="btn btn-primary"
          onClick={() => {
            auth.signOut();
            window.location.href = "/login";
          }}
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;