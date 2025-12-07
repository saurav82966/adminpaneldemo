import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { ref, onValue } from "firebase/database";

const ProtectedRoute = ({ children }) => {
  const [valid, setValid] = useState(true);
  const user = auth.currentUser;
  const sessionId = localStorage.getItem("sessionId");

  useEffect(() => {
    if (!user) return;

    const sessionRef = ref(db, `activeSessions/${user.uid}/${sessionId}`);

    return onValue(sessionRef, (snap) => {
      if (!snap.exists()) {
        auth.signOut();
        setValid(false);
      }
    });
  }, []);

  if (!user || !valid) return <Navigate to="/login" replace />;

  return children;
};

export default ProtectedRoute;
