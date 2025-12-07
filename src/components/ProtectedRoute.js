import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth } from "../firebase";
import { ref, get, remove } from "firebase/database";
import { db } from "../firebase";

const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [allow, setAllow] = useState(false);

  useEffect(() => {
    const run = async () => {
      const user = auth.currentUser;

      if (!user) {
        setAllow(false);
        setLoading(false);
        return;
      }

      // Check block
      const blockSnap = await get(ref(db, `blocked_users/${user.uid}`));
      if (blockSnap.exists()) {
        await removeSession(user);
        await auth.signOut();
        setAllow(false);
        setLoading(false);
        return;
      }

      // Check session
      const sessionId = localStorage.getItem("current_session_id");
      if (!sessionId) {
        setAllow(false);
        setLoading(false);
        return;
      }

      setAllow(true);
      setLoading(false);
    };

    const unsub = auth.onAuthStateChanged(() => run());
    return () => unsub();
  }, []);

  const removeSession = async (user) => {
    const sessionId = localStorage.getItem("current_session_id");
    if (sessionId) {
      await remove(ref(db, `active_sessions/${sessionId}`));
    }
    localStorage.clear();
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border"></div>
      </div>
    );
  }

  return allow ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
