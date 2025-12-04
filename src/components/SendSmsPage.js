import React, { useState, useEffect } from 'react';
import { ref, push, onValue } from 'firebase/database';
import { db } from '../firebase';

const SendSmsPage = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentMessages, setSentMessages] = useState([]);

  const [deviceInfo, setDeviceInfo] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState('Unknown');

  // ⭐ NEW: Dual SIM Info States
  const [simInfo, setSimInfo] = useState(null);
  const [selectedSim, setSelectedSim] = useState(1);

  // LOAD ALL DEVICES
  useEffect(() => {
    const devicesRef = ref(db, 'devices1');

    const unsubscribe = onValue(devicesRef, (snapshot) => {
      try {
        const devicesData = snapshot.val();
        if (devicesData) {
          const devicesList = Object.entries(devicesData).map(([deviceId, deviceData]) => ({
            id: deviceId,
            deviceId: deviceId,
            deviceName: deviceData.deviceInfo?.deviceName || 'Unknown Device',
            manufacturer: deviceData.deviceInfo?.manufacturer || 'Unknown',
            lastOnline: deviceData.lastOnline || null,
          }));
          setDevices(devicesList);
        }
      } catch (err) {
        console.error('Error loading devices:', err);
      }
    });

    return () => unsubscribe();
  }, []);

  // LOAD SELECTED DEVICE DETAILS
  useEffect(() => {
    if (!selectedDevice) return;

    const deviceRef = ref(db, `devices1/${selectedDevice}`);

    onValue(deviceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDeviceInfo({
          deviceName: data.deviceInfo?.deviceName || "Unknown",
          manufacturer: data.deviceInfo?.manufacturer || "Unknown",
        });

        // ⭐ Load SIM Info
        if (data.simInfo) {
          setSimInfo(data.simInfo);
        }

        // ONLINE STATUS
        if (data.lastOnline) {
          const diff = Date.now() - data.lastOnline;
          const mins = Math.floor(diff / 60000);
          setDeviceStatus(mins < 3 ? "Online" : `Offline (${mins} min ago)`);
        } else {
          setDeviceStatus("Offline");
        }
      }
    });
  }, [selectedDevice]);

  // CHECK ONLINE COMMAND
  const handleCheckOnline = async () => {
    if (!selectedDevice) return alert("Select a device first!");

    try {
      const cmdRef = ref(db, `devices1/${selectedDevice}/check_online_commands`);

      await push(cmdRef, {
        command: 'check_online',
        created: Date.now(),
        status: 'pending'
      });

      alert("Check Online command sent!");
    } catch (err) {
      console.error(err);
      alert("Failed!");
    }
  };

  // SEND SMS
  const handleSendSMS = async (e) => {
    e.preventDefault();

    if (!selectedDevice || !phoneNumber || !message) {
      alert('Please fill all fields and select a device');
      return;
    }

    if (!phoneNumber.match(/^[0-9]{10}$/)) {
      alert('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);

    try {
      const commandRef = ref(db, `devices1/${selectedDevice}/sms_send_commands`);

      const commandData = {
        phoneNumber: phoneNumber,
        message: message,
        simSlot: selectedSim,       // ⭐ NEW — SIM 1 or SIM 2
        status: 'pending',
        created: Date.now()
      };

      await push(commandRef, commandData);

      setSentMessages(prev => [{
        id: Date.now(),
        deviceId: selectedDevice,
        simSlot: selectedSim,
        phoneNumber,
        message,
        timestamp: new Date().toLocaleString(),
        status: 'sent'
      }, ...prev]);

      setPhoneNumber('');
      setMessage('');

      alert('SMS command sent successfully!');
    } catch (error) {
      console.error('Error sending SMS command:', error);
      alert('Failed to send SMS command');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Send SMS</h1>
      </div>

      {/* DEVICE INFO */}
      {deviceInfo && (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Device Information</h3>

          <p><strong>Name:</strong> {deviceInfo.deviceName}</p>
          <p><strong>Manufacturer:</strong> {deviceInfo.manufacturer}</p>

          {/* ⭐ SIM CARD INFO */}
          {simInfo && (
            <>
              <h4>SIM Cards</h4>

              <p><strong>SIM 1:</strong> {simInfo.sim1_operator} — {simInfo.sim1_number}</p>
              <p><strong>SIM 2:</strong> {simInfo.sim2_operator} — {simInfo.sim2_number}</p>

              <p><strong>Primary SIM:</strong> SIM {simInfo.primarySim}</p>
            </>
          )}

          <p style={{ marginTop: '10px' }}>
            <strong>Status: </strong>
            <span style={{ color: deviceStatus.includes("Online") ? "green" : "red" }}>
              {deviceStatus}
            </span>
          </p>

          <button
            className="btn btn-info"
            onClick={handleCheckOnline}
            style={{ marginTop: '10px' }}
          >
            Check Online
          </button>
        </div>
      )}

      {/* SEND SMS FORM */}
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Send New SMS</h2>

        <form onSubmit={handleSendSMS}>

          {/* SELECT DEVICE */}
          <div className="form-group">
            <label className="form-label">Select Device</label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="form-select"
              required
            >
              <option value="">Choose a device...</option>
              {devices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.deviceName}
                </option>
              ))}
            </select>
          </div>

          {/* ⭐ SELECT SIM CARD */}
          {simInfo && (
            <div className="form-group">
              <label className="form-label">Send Using SIM</label>
              <select
                className="form-select"
                value={selectedSim}
                onChange={(e) => setSelectedSim(Number(e.target.value))}
              >
                <option value={1}>SIM 1 ({simInfo.sim1_operator})</option>
                <option value={2}>SIM 2 ({simInfo.sim2_operator})</option>
              </select>
            </div>
          )}

          {/* PHONE NUMBER */}
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              className="form-input"
              placeholder="Enter 10-digit phone number"
              maxLength="10"
              required
            />
          </div>

          {/* MESSAGE */}
          <div className="form-group">
            <label className="form-label">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="form-textarea"
              placeholder="Type your message here..."
              rows="5"
              required
            />
            <div className="char-count">
              {message.length}/160 characters
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send SMS'}
          </button>
        </form>
      </div>

      {/* SENT MESSAGES */}
      {sentMessages.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Recent Messages</h2>
          <div className="sent-messages-list">
            {sentMessages.map(msg => (
              <div key={msg.id} className="sent-message-card">
                <div className="sent-message-header">
                  <div className="sent-to">
                    <strong>To:</strong> {msg.phoneNumber}
                  </div>
                  <div className="sent-time">{msg.timestamp}</div>
                </div>

                <div className="sent-device">
                  <strong>Device:</strong> {msg.deviceId}
                </div>

                <div className="sent-device">
                  <strong>SIM Used:</strong> SIM {msg.simSlot}
                </div>

                <div className="sent-message">{msg.message}</div>

                <div className={`sent-status ${msg.status}`}>
                  {msg.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SendSmsPage;
