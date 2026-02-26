import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';
import { chatWithGuardian, buildCapsuleContext } from './groqClient.js';

function extractCapsuleId(text) {
    const cleaned = text.trim();
    const patterns = [
        /(?:capsule|vault|id|epoch|#)\s*#?(\d+)/i,
        /^(\d+)$/
    ];
    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) return parseInt(match[1], 10);
    }
    return null;
}

function formatDate(unixTimestamp) {
    return new Date(Number(unixTimestamp) * 1000).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function formatTimeRemaining(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    let parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (mins > 0 && days === 0) parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);
    return parts.join(', ') || 'moments';
}

export default function Guardian({ contract, provider, signer, onClose, isActive }) {
    const [messages, setMessages] = useState([]);
    const [llmHistory, setLlmHistory] = useState([]);
    const [input, setInput] = useState('');
    const [guardianState, setGuardianState] = useState('GREETING');
    const [currentCapsuleId, setCurrentCapsuleId] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const hasGreeted = useRef(false);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isActive) setTimeout(() => inputRef.current?.focus(), 400);
    }, [isActive]);

    useEffect(() => {
        if (isActive && !hasGreeted.current) {
            hasGreeted.current = true;
            generateGreeting();
        }
    }, [isActive]);

    useEffect(() => {
        if (!isActive) {
            setMessages([]);
            setLlmHistory([]);
            setGuardianState('GREETING');
            setCurrentCapsuleId(null);
            setInput('');
            setIsProcessing(false);
            hasGreeted.current = false;
        }
    }, [isActive]);

    function addGuardianMessage(text) {
        setMessages(prev => [...prev, { role: 'guardian', text }]);
    }
    function addUserMessage(text) {
        setMessages(prev => [...prev, { role: 'user', text }]);
    }
    function addThinkingMessage() {
        setMessages(prev => [...prev, { role: 'thinking', text: '' }]);
    }
    function removeThinkingMessage() {
        setMessages(prev => prev.filter(m => m.role !== 'thinking'));
    }

    async function askGuardian(userText, contextScenario, contextData = {}) {
        const contextMsg = buildCapsuleContext(contextScenario, contextData);
        const newHistory = [...llmHistory];
        if (userText) newHistory.push({ role: 'user', content: userText });
        const messagesForLLM = [...newHistory, contextMsg];
        // LOG: Local LLM usage
        console.log('[Guardian] Using local LLM for chatWithGuardian:', {
            contextScenario,
            contextData,
            messagesForLLM
        });
        const response = await chatWithGuardian(messagesForLLM);
        console.log('[Guardian] Local LLM response:', response);
        newHistory.push({ role: 'assistant', content: response });
        setLlmHistory(newHistory);
        return response;
    }

    async function generateGreeting() {
        setIsProcessing(true);
        addThinkingMessage();
        const response = await askGuardian(null, 'GREETING');
        removeThinkingMessage();
        addGuardianMessage(response);
        setGuardianState('AWAITING_ID');
        setIsProcessing(false);
    }

    async function processMessage(text) {
        addUserMessage(text);
        setInput('');
        setIsProcessing(true);
        addThinkingMessage();

        try {
            switch (guardianState) {
                case 'AWAITING_ID':
                    await handleAwaitingId(text);
                    break;
                case 'AWAITING_PASSWORD':
                    await handleAwaitingPassword(text);
                    break;
                default:
                    await handleAwaitingId(text);
            }
        } catch (err) {
            console.error('Guardian error:', err);
            removeThinkingMessage();
            const response = await askGuardian(text, 'UNLOCK_ERROR', {
                id: currentCapsuleId || '?',
                error: err.reason || err.message || 'Unknown error'
            });
            addGuardianMessage(response);
            setGuardianState('AWAITING_ID');
        } finally {
            setIsProcessing(false);
        }
    }

    async function handleAwaitingId(text) {
        if (!contract || !provider) {
            removeThinkingMessage();
            const response = await askGuardian(text, 'WALLET_NEEDED');
            addGuardianMessage(response);
            return;
        }

        const capsuleId = extractCapsuleId(text);
        if (capsuleId === null) {
            removeThinkingMessage();
            const response = await askGuardian(text, 'NO_CAPSULE_ID');
            addGuardianMessage(response);
            return;
        }

        const nextId = await contract.nextCapsuleId();
        if (capsuleId >= Number(nextId)) {
            removeThinkingMessage();
            const response = await askGuardian(text, 'CAPSULE_NOT_FOUND', {
                id: capsuleId, maxId: Number(nextId) - 1
            });
            addGuardianMessage(response);
            return;
        }

        const capsule = await contract.capsules(capsuleId);
        const creator = capsule[0];
        const unlockTime = Number(capsule[2]);
        const createdAt = Number(capsule[3]);
        const unlocked = capsule[5];
        const shortCreator = `${creator.substring(0, 6)}...${creator.substring(creator.length - 4)}`;
        const createdAtStr = formatDate(createdAt);
        const unlockTimeStr = formatDate(unlockTime);

        if (unlocked) {
            removeThinkingMessage();
            const response = await askGuardian(text, 'CAPSULE_ALREADY_UNLOCKED', {
                id: capsuleId, creator: shortCreator, createdAt: createdAtStr
            });
            addGuardianMessage(response);
            setGuardianState('AWAITING_ID');
            return;
        }

        const block = await provider.getBlock('latest');
        const currentTime = Number(block.timestamp);
        const timeRemaining = unlockTime - currentTime;

        if (timeRemaining > 0) {
            removeThinkingMessage();
            const response = await askGuardian(text, 'CAPSULE_FOUND_TIME_LOCKED', {
                id: capsuleId, creator: shortCreator, createdAt: createdAtStr,
                unlockTime: unlockTimeStr, timeRemaining: formatTimeRemaining(timeRemaining)
            });
            addGuardianMessage(response);
            setGuardianState('AWAITING_ID');
            return;
        }

        removeThinkingMessage();
        setCurrentCapsuleId(capsuleId);
        const response = await askGuardian(text, 'CAPSULE_FOUND_READY', {
            id: capsuleId, creator: shortCreator, createdAt: createdAtStr, unlockTime: unlockTimeStr
        });
        addGuardianMessage(response);
        setGuardianState('AWAITING_PASSWORD');
    }

    async function handleAwaitingPassword(text) {
        const password = text.trim();
        if (!password) {
            removeThinkingMessage();
            const response = await askGuardian(text, 'CAPSULE_FOUND_READY', { id: currentCapsuleId });
            addGuardianMessage(response);
            return;
        }

        const maybeNewId = extractCapsuleId(text);
        if (maybeNewId !== null && (text.toLowerCase().includes('capsule') || text.toLowerCase().includes('vault'))) {
            removeThinkingMessage();
            setGuardianState('AWAITING_ID');
            addThinkingMessage();
            await handleAwaitingId(text);
            return;
        }

        removeThinkingMessage();
        const testingResponse = await askGuardian(password, 'PASSWORD_TESTING', { id: currentCapsuleId });
        addGuardianMessage(testingResponse);
        await new Promise(r => setTimeout(r, 300));
        addThinkingMessage();

        try {
            const tx = await contract.unlock(currentCapsuleId, password);
            await tx.wait();
            removeThinkingMessage();

            const capsule = await contract.capsules(currentCapsuleId);
            const ipfsCID = capsule[1];
            const ipfsRes = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsCID}`);
            if (!ipfsRes.ok) throw new Error('Failed to retrieve payload from IPFS.');
            const encryptedFile = await ipfsRes.text();
            const decryptedBytes = CryptoJS.AES.decrypt(encryptedFile, password);
            const decryptedDataUrl = decryptedBytes.toString(CryptoJS.enc.Utf8);
            if (!decryptedDataUrl) throw new Error('Decryption produced empty output.');

            const a = document.createElement('a');
            a.href = decryptedDataUrl;
            a.download = `Epoch_${currentCapsuleId}_unlocked`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            const successResponse = await askGuardian('', 'DOWNLOAD_COMPLETE', { id: currentCapsuleId });
            addGuardianMessage(successResponse);
            setCurrentCapsuleId(null);
            setGuardianState('AWAITING_ID');
        } catch (err) {
            removeThinkingMessage();
            console.error('Unlock error:', err);
            const reason = err.reason || err.message || '';

            if (reason.includes('Bad Pass') || reason.includes('password') || reason.includes('revert')) {
                const response = await askGuardian('', 'WRONG_PASSWORD', { id: currentCapsuleId });
                addGuardianMessage(response);
            } else if (reason.includes('Too early')) {
                const response = await askGuardian('', 'CAPSULE_FOUND_TIME_LOCKED', { id: currentCapsuleId, timeRemaining: 'unknown' });
                addGuardianMessage(response);
                setGuardianState('AWAITING_ID');
            } else if (reason.includes('Unlocked')) {
                const response = await askGuardian('', 'CAPSULE_ALREADY_UNLOCKED', { id: currentCapsuleId });
                addGuardianMessage(response);
                setGuardianState('AWAITING_ID');
            } else {
                const response = await askGuardian('', 'UNLOCK_ERROR', { id: currentCapsuleId, error: reason });
                addGuardianMessage(response);
                setGuardianState('AWAITING_ID');
            }
        }
    }

    function handleSend(e) {
        e?.preventDefault();
        const text = input.trim();
        if (!text || isProcessing) return;
        processMessage(text);
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    return (
        <div className="guardian-modal" onClick={(e) => e.stopPropagation()}>
            <div className="guardian-header">
                <div className="guardian-identity">
                    <div className="guardian-avatar">
                        <div className="guardian-avatar-glow"></div>
                        <svg className="guardian-avatar-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L3 7V12C3 17.25 6.75 22.08 12 23C17.25 22.08 21 17.25 21 12V7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="rgba(108, 92, 231, 0.15)" />
                            <path d="M12 8V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <circle cx="12" cy="16" r="0.75" fill="currentColor" />
                        </svg>
                    </div>
                    <div className="guardian-info">
                        <span className="guardian-name">The Guardian</span>
                        <span className="guardian-status">
                            <span className="status-dot"></span>
                            Watching the vaults
                        </span>
                    </div>
                </div>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>

            <div className="chat-messages">
                {messages.map((msg, i) => {
                    if (msg.role === 'thinking') {
                        return (
                            <div key={`thinking-${i}`} className="chat-message guardian thinking">
                                <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div key={i} className={`chat-message ${msg.role === 'guardian' ? 'guardian' : 'user'}`}>
                            {msg.text.split('\n').map((line, j) => (
                                <span key={j}>
                                    {line}
                                    {j < msg.text.split('\n').length - 1 && <br />}
                                </span>
                            ))}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-area" onSubmit={handleSend}>
                <input
                    ref={inputRef}
                    type="text"
                    className="chat-input"
                    placeholder={guardianState === 'AWAITING_PASSWORD' ? 'Enter the decryption password...' : 'Speak to the Guardian...'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isProcessing}
                    autoComplete="off"
                />
                <button type="submit" className="chat-send-btn" disabled={isProcessing || !input.trim()}>
                    ➤
                </button>
            </form>
        </div>
    );
}
