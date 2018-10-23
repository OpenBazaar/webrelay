const multihash = require('multihashes'),
    long = require("long"),
    peerID = "QmaSAmPPynrWfz1R8XvRm1GX6ghzPze6XSZCov6fWWUzSg",
    userID = Math.random().toString(36).substring(7),
    host = "ws://localhost:8080";


const connectSocket = (() => {
    const socket = new WebSocket(host);

    async function sha256(buffer) {
        // hash the message
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return Buffer.from(hashBuffer)
    }

    socket.addEventListener('open', (event) => {

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
            shiftedPrefix64Buffer = Buffer.from(shiftedPrefix64.toBytesBE());

        // Hash the buffer
        sha256(shiftedPrefix64Buffer).then((sha) => {
            // Re-encode as a multihash to get your SubscriptionKey
            const subscriptionKey = multihash.toB58String(multihash.encode(sha, "sha2-256")),
                authMessage = { userID: userID, subscriptionKey: subscriptionKey };
            // Send message to the server
            console.log(authMessage)
            socket.send(JSON.stringify(authMessage))
        })

    });

    // Listen for messages from the server
    socket.addEventListener('message', (event) => {
        document.getElementById("serverMessage").innerHTML = `Message from server: ${event.data}`
    });

    socket.addEventListener('error', (event) => {
        // Reconnect to socket on d/c
        setTimeout(() => { connectSocket() }, 500)
    });
})

connectSocket();
