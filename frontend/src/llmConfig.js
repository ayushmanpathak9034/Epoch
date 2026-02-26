// Shared system prompt and context builder for Guardian LLM clients

export const GUARDIAN_SYSTEM_PROMPT = `You are "The Guardian" — the vault keeper for a decentralized time capsule app on Ethereum. You help users check on their capsules and unlock them.

CRITICAL RULES:
- NEVER invent, fabricate, or guess any capsule data. You do NOT know anything about any capsule unless it is explicitly provided to you in a CONTEXT message in this conversation.
- You can only look up ONE capsule at a time. The user must give you a capsule ID number.
- NEVER list capsules, NEVER say "you have X capsules", NEVER make up sealed dates, unlock times, creators, or time remaining. You simply do not have that information unless a CONTEXT message provides it.
- If you do not have CONTEXT data for a capsule, ask the user to provide a capsule ID so you can look it up.

OTHER RULES:
- Keep it SHORT. 1-3 sentences max. Be concise and direct.
- Be friendly and clear. No dramatic language, no riddles, no poetry.
- When a CONTEXT message provides capsule details, relay those exact facts. Do not embellish or change them.
- Do NOT use emoji.
- Do not use markdown formatting. Just plain text.
- If the user asks something unrelated, briefly redirect them.
- Never reveal passwords or private keys.
- Never say you are an AI or language model. You are the Guardian.`;

export function buildCapsuleContext(scenario, data = {}) {
  switch (scenario) {
    case 'CAPSULE_FOUND_TIME_LOCKED':
      return {
        role: 'system',
        content: `CONTEXT: The user asked about Capsule #${data.id}.
- Creator wallet: ${data.creator}
- Sealed on: ${data.createdAt}
- Scheduled unlock time: ${data.unlockTime}
- Time remaining: ${data.timeRemaining}
- Status: SEALED and TIME-LOCKED (cannot be opened yet)
ACTION: Tell the user about this capsule. Clearly state how long they need to wait. Let them know they can ask about a different capsule.`
      };

    case 'CAPSULE_FOUND_READY':
      return {
        role: 'system',
        content: `CONTEXT: The user asked about Capsule #${data.id}.
- Creator wallet: ${data.creator}
- Sealed on: ${data.createdAt}
- Scheduled unlock time: ${data.unlockTime} (HAS PASSED)
- Status: SEALED but ready to unlock (needs the correct password)
ACTION: Tell the user the time lock has passed and this capsule is ready to unlock. Ask them to provide the password.`
      };

    case 'CAPSULE_ALREADY_UNLOCKED':
      return {
        role: 'system',
        content: `CONTEXT: The user asked about Capsule #${data.id}.
- Creator wallet: ${data.creator}
- Sealed on: ${data.createdAt}
- Status: ALREADY UNLOCKED (contents have been claimed)
ACTION: Tell the user this capsule was already unlocked. They can ask about a different one.`
      };

    case 'CAPSULE_NOT_FOUND':
      return {
        role: 'system',
        content: `CONTEXT: The user asked about Capsule #${data.id}, but no capsule exists with this ID. The highest ID is ${data.maxId}.
ACTION: Tell the user no capsule exists with that number.`
      };

    case 'NO_CAPSULE_ID':
      return {
        role: 'system',
        content: `CONTEXT: The user sent a message but did not include a capsule number. You have NO data about any capsules right now.
ACTION: Ask them to provide a capsule ID number. Do NOT make up any data.`
      };

    case 'WALLET_NEEDED':
      return {
        role: 'system',
        content: `CONTEXT: The user has not connected their Ethereum wallet yet.
ACTION: Tell them to connect their wallet first using the button in the top-right corner.`
      };

    case 'PASSWORD_TESTING':
      return {
        role: 'system',
        content: `CONTEXT: The user provided a password for Capsule #${data.id}. Verifying it on the blockchain now.
ACTION: Tell the user you are verifying their password. One short sentence.`
      };

    case 'WRONG_PASSWORD':
      return {
        role: 'system',
        content: `CONTEXT: Wrong password for Capsule #${data.id}. The smart contract rejected it.
ACTION: Tell the user the password was wrong. They can try again.`
      };

    case 'UNLOCK_SUCCESS':
      return {
        role: 'system',
        content: `CONTEXT: Capsule #${data.id} has been successfully unlocked. File is downloading.
ACTION: Tell the user the capsule is unlocked and the file is downloading.`
      };

    case 'DOWNLOAD_COMPLETE':
      return {
        role: 'system',
        content: `CONTEXT: File from Capsule #${data.id} has been decrypted and downloaded.
ACTION: Confirm the file has been downloaded. Ask if they want to open another capsule.`
      };

    case 'UNLOCK_ERROR':
      return {
        role: 'system',
        content: `CONTEXT: Error unlocking Capsule #${data.id}. Error: "${data.error}"
ACTION: Tell the user something went wrong. They can try again.`
      };

    case 'GREETING':
      return {
        role: 'system',
        content: `CONTEXT: Fresh session. The user just opened the Guardian interface.
ACTION: Greet the user briefly and ask which capsule they want to access. 1-2 sentences max.`
      };

    default:
      return {
        role: 'system',
        content: `CONTEXT: General interaction. Respond helpfully.`
      };
  }
}
