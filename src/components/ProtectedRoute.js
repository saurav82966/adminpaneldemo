import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { ref, onValue } from "firebase/database";

const ProtectedRoute = ({ children }) => {
  const [valid, setValid] = useState(true);
  const [checking, setChecking] = useState(true);

  const user = auth.currentUser;

  useEffect(() => {
    const sessionId = localStorage.getItem("sessionId");

    if (!user || !sessionId) {
      setValid(false);
      setChecking(false);
      return;
    }

    const uid = user.uid;

    // ACTIVE SESSION CHECK
    const sessionRef = ref(db, `activeSessions/${uid}/${sessionId}`);
    const unsub1 = onValue(sessionRef, (snap) => {
      if (!snap.exists()) {
        auth.signOut();
        localStorage.clear();
        setValid(false);
      }
      setChecking(false);
    });

    // SESSION VERSION CHECK
    const versionRef = ref(db, `users/${uid}/sessionVersion`);
    const unsub2 = onValue(versionRef, (snap) => {
      const serverVer = snap.val();
      const localVer = Number(localStorage.getItem("sessionVersion_" + uid));

      if (!localVer || serverVer !== localVer) {
        auth.signOut();
        localStorage.clear();
        setValid(false);
      }
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  if (checking) return null;
  if (!valid) return <Navigate to="/login" replace />;

  return children;
};

export default ProtectedRoute;
