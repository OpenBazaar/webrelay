const { hmac, keys } = require('libp2p-crypto'),
    PeerId = require('peer-id'),
    Base64 = require("base64-js"),
    long = require("long"),
    multihash = require('multihashes'),
    naclUtil = require("tweetnacl-util");


/*
 * Returns a Uint8Array(64) hash of the given text.
 */
exports.generateHMAC = async (text, options = {}) => {
    const opts = {
        hash: 'SHA256',
        hmacSeed: 'ob-hash',
        ...options
    };

    return new Promise((resolve, reject) => {
        hmac.create(opts.hash, naclUtil.decodeUTF8(opts.hmacSeed), (err, hmac) => {
            if (!err) {
                hmac.digest(naclUtil.decodeUTF8(text), (err, sig) => {
                    if (!err) {
                        resolve(sig);
                        return;
                    }
                    reject(err);
                });
                return;
            }
            reject(err);
        });
    });
};

exports.identityFromKey = (privKey) => {
    return new Promise((resolve, reject) => {
        keys.unmarshalPrivateKey(privKey, (err, base58PrivKey) => {
            if (!err) {
                PeerId.createFromPubKey(base58PrivKey.public.bytes, (err, peerID) => {
                    if (!err) {
                        resolve({
                            base58PrivKey: Base64.fromByteArray(base58PrivKey.bytes),
                            peerID: peerID._idB58String
                        });
                        return;
                    }

                    reject(err);
                });
                return;
            }

            reject(err);
        });
    });
};


exports.identityKeyFromSeed = (seed, bits = 4096) => {
    return new Promise((resolve, reject) => {
        this.generateHMAC(seed, {
            hmacSeed: 'ob-identity'
        }).then(
            sig => {
                keys.generateKeyPairFromSeed('ed25519', sig, bits, (err, privKey) => {
                    if (!err) {
                        resolve(privKey);
                    } else {
                        reject(err);
                    }
                });
            },
            e => reject(e)
        );
    });
};

exports.generateSubscriptionKey = async (peerID) => {
    // Convert the PeerID string to a Multihash object
    const peerIDMultihash = multihash.fromB58String(peerID),

        // Decode the Multihash to extract the digest
        decoded = multihash.decode(peerIDMultihash),
        digest = decoded.digest,

        // Grab the first 8 bytes of the digest byte array
        prefix = digest.slice(0, 8),

        // Convert Uint8Array to Uint64 Big-Endian
        prefix64 = new long.fromBytesBE(prefix, true),

        // Bit shift prefix 48 bits to the right
        shiftedPrefix64 = prefix64.shiftRightUnsigned(48),

        // Convert prefix to buffer
        shiftedPrefix64Buffer = Buffer.from(shiftedPrefix64.toBytesBE()),

        // Create a SHA-256 hash of the prefix to generate the checksum
        hashBuffer = await crypto.subtle.digest('SHA-256', shiftedPrefix64Buffer),

        // Re-encode as a multihash to get your SubscriptionKey
        subscriptionKey = multihash.toB58String(multihash.encode(Buffer.from(hashBuffer), "sha2-256"));

        return subscriptionKey;
};
