// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ChronoVault
 * @dev Decentralized Time Capsule using IPFS for storage and keccak256 for password hashing.
 */
contract ChronoVault {
    struct Capsule {
        address creator;
        string ipfsCID;
        uint256 unlockTime;
        uint256 createdAt;
        bytes32 passwordHash;
        bool unlocked;
    }

    mapping(uint256 => Capsule) public capsules;
    uint256 public nextCapsuleId;

    /**
     * @dev Seals a new time capsule.
     * @param ipfsCID The IPFS Content Identifier where the encrypted file is stored.
     * @param unlockTime The Unix timestamp when the capsule can be unlocked.
     * @param passwordHash The keccak256 hash of the decryption password.
     */
    function seal(string calldata ipfsCID, uint256 unlockTime, bytes32 passwordHash) external returns (uint256 id) {
        id = nextCapsuleId++;
        capsules[id] = Capsule({
            creator: msg.sender,
            ipfsCID: ipfsCID,
            unlockTime: unlockTime,
            createdAt: block.timestamp,
            passwordHash: passwordHash,
            unlocked: false
        });
    }

    /**
     * @dev Unlocks a sealed time capsule if conditions are met.
     * @param id The ID of the capsule to unlock.
     * @param password The plaintext password to verify against the stored hash.
     */
    function unlock(uint256 id, string calldata password) external returns (string memory ipfsCID) {
        Capsule storage capsule = capsules[id];

        if (block.timestamp < capsule.unlockTime) require(false, "Too early");
        if (capsule.unlocked) require(false, "Unlocked");
        if (keccak256(abi.encodePacked(password)) != capsule.passwordHash) require(false, "Bad Pass");

        capsule.unlocked = true;
        
        return capsule.ipfsCID;
    }

    /**
     * @dev Returns the visual rarity tier based on the age of the capsule.
     */
    function getRarity(uint256 id) external view returns (uint8 tier, string memory title) {
        Capsule memory capsule = capsules[id];
        uint256 age = block.timestamp - capsule.createdAt;

        // Fresh (<30d), Vintage (<1y), Ancient (<3y), Timeless (>10y)
        if (age < 30 days) {
            return (1, "Fresh");
        } else if (age < 365 days) {
            return (2, "Vintage");
        } else if (age < 1095 days) {
            return (3, "Ancient");
        } else if (age >= 3650 days) {
            return (5, "Timeless");
        } else {
            return (4, "Legendary"); // Fallback for 3-10 years
        }
    }
}
