import React, { useState } from 'react';
import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';
import Guardian from './Guardian.jsx';
import './index.css';

// ==========================================
// PINATA IPFS SETUP
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
// ==========================================

const CONTRACT_ADDRESS = "0xfD148BEA5D8F41aDFe9c22e7A32392395C66A4a6";
const CONTRACT_ABI = [
  "function seal(string ipfsCID, uint256 unlockTime, bytes32 passwordHash) external returns (uint256)",
  "function unlock(uint256 id, string password) external returns (string)",
  "function getRarity(uint256 id) external view returns (uint8 tier, string title)",
  "function capsules(uint256) external view returns (address, string, uint256, uint256, bytes32, bool)",
  "function nextCapsuleId() external view returns (uint256)"
];

export default function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState('');

  // UI State
  const [activeModal, setActiveModal] = useState(null); // 'seal' | 'unlock' | null

  // Seal State
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const getTomorrowString = () => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    tmrw.setMinutes(tmrw.getMinutes() - tmrw.getTimezoneOffset());
    return tmrw.toISOString().slice(0, 16);
  };
  const [unlockTime, setUnlockTime] = useState(getTomorrowString());
  const [isSealing, setIsSealing] = useState(false);

  // Unlock State
  const [capsuleId, setCapsuleId] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const _provider = new ethers.BrowserProvider(window.ethereum, "any");
        await _provider.send("eth_requestAccounts", []);
        const _signer = await _provider.getSigner();
        const _contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, _signer);

        const network = await _provider.getNetwork();
        if (network.chainId !== 11155111n) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0xaa36a7' }],
            });
          } catch (switchError) {
            if (switchError.code === 4902) {
              alert("Please add the Sepolia network to your MetaMask.");
              return;
            }
            throw switchError;
          }
        }

        setProvider(_provider);
        setSigner(_signer);
        setContract(_contract);
        const address = await _signer.getAddress();
        setAccount(address);
      } catch (err) {
        console.error("Wallet connection failed:", err);
      }
    } else {
      alert("Please install MetaMask to interact with Epoch.");
    }
  };

  const handleSeal = async (e) => {
    e.preventDefault();
    if (!file || !password || !unlockTime) return alert("Please fill all fields.");
    if (!contract || !signer) return alert("Connect wallet first.");

    setIsSealing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const fileData = event.target.result;
        const encryptedFile = CryptoJS.AES.encrypt(fileData, password).toString();

        if (!PINATA_JWT) {
          throw new Error("Missing Pinata JWT in .env");
        }

        const formData = new FormData();
        const blob = new Blob([encryptedFile], { type: 'text/plain' });
        formData.append('file', blob, 'capsule.enc');

        const ipfsRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
          method: "POST",
          headers: { Authorization: `Bearer ${PINATA_JWT}` },
          body: formData
        });

        if (!ipfsRes.ok) throw new Error("Pinata upload failed");
        const ipfsData = await ipfsRes.json();
        const ipfsCID = ipfsData.IpfsHash;

        const passwordHash = ethers.keccak256(ethers.toUtf8Bytes(password));
        const unixUnlockTime = Math.floor(new Date(unlockTime).getTime() / 1000);

        const currentNextId = await contract.nextCapsuleId();
        const predictedId = Number(currentNextId);

        const tx = await contract.seal(ipfsCID, unixUnlockTime, passwordHash);
        await tx.wait();

        alert(`✅ Epoch Sealed.\nIMPORTANT: Your Unique ID is [ ${predictedId} ]\nSave this ID to retrieve your data in the future.`);
        setActiveModal(null);
      } catch (err) {
        console.error(err);
        alert("Error during encryption/sealing phase.");
      } finally {
        setIsSealing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!capsuleId || !unlockPassword) return alert("Fill all fields.");
    if (!contract || !signer) return alert("Connect wallet first.");

    setIsUnlocking(true);
    try {
      const tx = await contract.unlock(capsuleId, unlockPassword);
      await tx.wait();

      const capsule = await contract.capsules(capsuleId);
      const ipfsCID = capsule[1];

      const ipfsRes = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsCID}`);
      if (!ipfsRes.ok) throw new Error("Failed to fetch file from IPFS Gateway");
      const encryptedFile = await ipfsRes.text();

      const decryptedBytes = CryptoJS.AES.decrypt(encryptedFile, unlockPassword);
      const decryptedDataUrl = decryptedBytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedDataUrl) throw new Error("Decryption Corrupted (bad password or data).");

      const a = document.createElement("a");
      a.href = decryptedDataUrl;
      a.download = `Epoch_${capsuleId}_unlocked`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      alert("Capsule Unlocked successfully. File downloaded.");
      setActiveModal(null);
    } catch (err) {
      console.error(err);
      alert("Unlock Error: " + (err.reason || err.message));
    } finally {
      setIsUnlocking(false);
    }
  };

  const closeModal = () => {
    if (!isSealing && !isUnlocking) setActiveModal(null);
  };

  return (
    <div className="hero-container">
      {/* 3D Centerpiece: Cryo Time Capsule */}
      <div className="center-display">
        <div className="cryo-scene">
          {/* Orbital Rings representing Time/Blockchain */}
          <div className="orbital-ring ring-1"></div>
          <div className="orbital-ring ring-2"></div>
          <div className="orbital-ring ring-3"></div>

          {/* Core Time Capsule Cylinder */}
          <div className="cryo-cylinder">
            <div className="cylinder-top"></div>
            <div className="cylinder-bottom"></div>
            <div className="cylinder-body">
              {/* Glowing encrypted data representations */}
              <div className="data-stream stream-1"></div>
              <div className="data-stream stream-2"></div>
              <div className="data-stream stream-3"></div>
            </div>
            {/* The protected payload core */}
            <div className="payload-core"></div>
          </div>
        </div>
      </div>

      <div className="hero-overlay">

        {/* Top Header Section */}
        <div className="top-row">
          <div className="brand-title">
            Epoch<span className="brand-symbol">®</span>
          </div>
          <div className="button-group">
            {!account ? (
              <button onClick={connectWallet} className="pill-btn">
                Connect Wallet <span className="pill-btn-icon">↗</span>
              </button>
            ) : (
              <button className="pill-btn">
                {account.substring(0, 6)}...{account.substring(account.length - 4)}
              </button>
            )}
          </div>
        </div>

        {/* Bottom Footer Section */}
        <div className="bottom-row">
          <div className="manifesto">
            Secure Web3 Data—<br />Immutable Preservation
          </div>

          <div className="menu-options">
            <button onClick={() => setActiveModal('seal')} className="pill-btn dark">
              Encrypt Payload
            </button>
            <button onClick={() => setActiveModal('unlock')} className="pill-btn dark">
              <span className="pill-btn-icon">☰</span> Access Vault
            </button>
          </div>

          <div className="small-print">
            Secure, decentralized time capsules on the blockchain.<br />
            Data encrypted via client-side AES.
          </div>
        </div>
      </div>

      {/* Seal Modal */}
      <div className={`modal-overlay ${activeModal === 'seal' ? 'active' : ''}`} onClick={closeModal}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-btn" onClick={closeModal}>×</button>
          <h2 className="modal-title">New Capsule</h2>
          <form onSubmit={handleSeal}>
            <div className="form-group">
              <label className="form-label">Digital Asset</label>
              <input type="file" onChange={(e) => setFile(e.target.files[0])} required className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Key Vault Password</label>
              <input type="password" placeholder="AES secure key" value={password} onChange={(e) => setPassword(e.target.value)} required className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Oppen Condition</label>
              <input type="datetime-local" value={unlockTime} onChange={(e) => setUnlockTime(e.target.value)} required className="form-input" />
            </div>
            <button type="submit" className="action-btn" disabled={isSealing}>
              {isSealing ? (
                <><span className="loader"></span> Committing...</>
              ) : "Seal Forever"}
            </button>
          </form>
        </div>
      </div>

      {/* Guardian Chat Modal */}
      <div className={`modal-overlay ${activeModal === 'unlock' ? 'active' : ''}`} onClick={closeModal}>
        <Guardian
          contract={contract}
          provider={provider}
          signer={signer}
          onClose={closeModal}
          isActive={activeModal === 'unlock'}
        />
      </div>

    </div>
  );
}
