const { hmac, keys } = require('libp2p-crypto'),
    PeerId = require('peer-id'),
    Base64 = require("base64-js"),
    long = require("long"),
    crypto2 = require('libp2p-crypto'),
    multihash = require('multihashes'),
    bs58 = require('bs58'),
    bip39 = require('bip39'),
    sha256 = require('js-sha256'),
    bitArray = require('node-bitarray'),
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

// Return SHA256 Uint8Array of given data
exports.generateHash = async (data) => {
    if (typeof(data) == "string") {
        data = new TextEncoder("utf-8").encode(data);
    }

    return new Promise((resolve, reject) => {
        crypto.subtle.digest('SHA-256', data).then((hash) => {
            const dataArray = new Uint8Array(hash);
            resolve(dataArray)
        }).catch((err) => {
            reject(err);
        })
    })
}

exports.identityFromKey = (privKey) => {
    return new Promise((resolve, reject) => {
            var peerid = PeerId.createFromPubKey(keys.marshalPublicKey(privKey.public), (err, key) => {
                if (err) {
                    reject(err);
                }
                console.log("Peer ID:", key._idB58String);
                my_peer_id = key._idB58String;
                resolve({
                    "peerID": key._idB58String
                });
            });
    });
};


exports.identityKeyFromSeed = (mnemonic, bits = 4096) => {
    return new Promise((resolve, reject) => {
            const seed = bip39.mnemonicToSeed(mnemonic, 'Secret Passphrase'),
                hmac = sha256.hmac.create("OpenBazaar seed");
            hmac.update(seed);
            const inputSeed = new Uint8Array(hmac.array());
            keys.generateKeyPairFromSeed('ed25519', inputSeed, (err, privKey) => {
                if (!err) {
                    resolve(privKey);
                } else {
                    reject(err);
                }
            });
        },
        e => reject(e)
    );
};

exports.generateSubscriptionKey = async (peerID) => {
    console.log("PEERID: ", peerID)
    const peerIDMultihash = multihash.fromB58String(peerID),
        decoded = multihash.decode(peerIDMultihash),
        digest = decoded.digest,
        prefix = new Buffer(new Uint8Array(digest.slice(0, 8)));


    let bits = bitArray.fromBuffer(prefix);
    bits = bits.slice(0, 14);
    bits = new Buffer(bits);

    for (let i = 0; i < 50; i++) {
        bits = Buffer.concat([new Buffer([0]), bits]);
    }

    // Construct uint8array from binary strings
    let id_array = [];
    for (i = 0; i < 8; i++) {
        let tmp_x = "";
        for (j = 0; j < 8; j++) {
            tmp_x += bits[i * 8 + j];
        }
        id_array.push(parseInt(tmp_x, 2));
    }


    // var checksum = crypto2.createHash('sha256').update(new Buffer(id_array)).digest();
    const checksum = await crypto.subtle.digest('SHA-256', new Buffer(id_array)),
        subscriptionKey = multihash.encode(Buffer.from(checksum), 'sha2-256');
    console.log("SubscriptionKey1: ", bs58.encode(subscriptionKey))
    return bs58.encode(subscriptionKey);
}


exports.signIt = (privateKey, serializedMessage) => {
    return new Promise((resolve, reject) => {
        privateKey.sign(serializedMessage, (err, signature) => {
            if (!err) {
                resolve(signature);
            } else {
                reject(err);
            }
        });
    });
}


exports.uuidv4 = () => {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    )
}