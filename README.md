# Epoch

Decentralized time capsules on Ethereum. Seal files with a future unlock date and password — retrieve them when the time comes.

## How It Works

1. **Seal** — Pick a file, set a password and unlock date. The file is AES-encrypted client-side, uploaded to IPFS via Pinata, and the metadata is stored on-chain.
2. **Wait** — The capsule remains locked until the unlock date passes.
3. **Unlock** — Chat with the Guardian (AI vault keeper) to verify your capsule and provide the password. The file is fetched from IPFS, decrypted, and downloaded.

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Solidity (Sepolia Testnet) |
| Frontend | React + Vite |
| Wallet | MetaMask via ethers.js v6 |
| Encryption | CryptoJS (AES, client-side) |
| Storage | IPFS via Pinata |
| AI | Groq (LLaMA 3.3 70B) / Ollama (local) |

## Project Structure

```
contracts/
  Epoch.sol              # ChronoVault smart contract
frontend/
  src/
    App.jsx              # Main app — seal flow + wallet connection
    Guardian.jsx         # AI chatbot for unlocking capsules
    groqClient.js        # Groq cloud LLM client
    localClient.js       # Ollama local LLM client
    llmConfig.js         # Shared system prompt + context builder
    index.css            # Styles
```

## Setup

### Prerequisites

- Node.js 20.19+ or 22.12+
- MetaMask browser extension
- Sepolia testnet ETH ([faucet](https://sepoliafaucet.com))

### Install & Run

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Create `frontend/.env`:

```
VITE_PINATA_JWT=your_pinata_jwt_token
VITE_GROQ_API_KEY=your_groq_api_key
```

- **Pinata JWT** — Get from [pinata.cloud](https://pinata.cloud)
- **Groq API Key** — Get from [console.groq.com](https://console.groq.com)

### Switching LLM Provider

In `Guardian.jsx`, change the import:

```javascript
// Groq (cloud — fast, requires API key)
import { chatWithGuardian, buildCapsuleContext } from './groqClient.js';

// Ollama (local — no API key, requires ollama serve)
import { chatWithGuardian, buildCapsuleContext } from './localClient.js';
```

For Ollama, install and pull the model:

```bash
ollama pull llama3.2:3b
ollama serve
```

## Smart Contract

**ChronoVault** is deployed on Sepolia at `0xfD148BEA5D8F41aDFe9c22e7A32392395C66A4a6`.

| Function | Description |
|---|---|
| `seal(ipfsCID, unlockTime, passwordHash)` | Create a new time capsule |
| `unlock(id, password)` | Unlock a capsule (checks time + password) |
| `getRarity(id)` | Returns rarity tier based on capsule age |

### Rarity Tiers

| Tier | Age | Title |
|---|---|---|
| 1 | < 30 days | Fresh |
| 2 | < 1 year | Vintage |
| 3 | < 3 years | Ancient |
| 4 | 3–10 years | Legendary |
| 5 | > 10 years | Timeless |

## License

MIT
