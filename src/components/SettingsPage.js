import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { updatePassword } from 'firebase/auth';
import { ref, get, set } from "firebase/database";

export default function SettingsPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const user = auth.currentUser;

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (!user) {
      setMessage({ type: 'error', text: 'No user logged in' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // UPDATE PASSWORD
      await updatePassword(user, newPassword);

      // UPDATE SESSION VERSION (LOGOUT ALL DEVICES)
      const userRef = ref(db, "users/" + user.uid + "/sessionVersion");
      const snap = await get(userRef);
      const currentVer = snap.exists() ? snap.val() : 1;
      await set(userRef, currentVer + 1);

      setMessage({
        type: 'success',
        text: 'Password updated! All devices logged out.'
      });

      localStorage.clear(); // logout current browser too

      setNewPassword('');
      setConfirmPassword('');

    } catch (error) {
      console.error(error);
      let msg = "Failed to update password.";

      if (error.code === 'auth/requires-recent-login') {
        msg = "Please login again to change password.";
      }

      setMessage({ type: 'error', text: msg });
    }

    setLoading(false);
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Change Password</h2>
        </div>

        {message.text && (
          <div className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="settings-form">

          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="form-input"
              placeholder="Enter new password"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input"
              placeholder="Confirm password"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
