const multihash = require('multihashes'),
    pbUtility = require("./pbUtility"),
    nacl = require("tweetnacl"),
    naclUtil = require("tweetnacl-util"),
    { hmac, keys } = require('libp2p-crypto'),
    ed2curve = require("ed2curve"),
    cryptoUtility = require("./cryptoUtility"),
    request = require("./request"),
    dom = require("./dom"),
    socket = require("./socket");


const generateEncryptedCiphertext = async (recipientPublicKeyB64, chatMessage, seed, subject = "") => {
    const dateNow = new Date(),
        // The messageID is derived from the message data. In this cse its the hash of the message,
        // subject and timestamp which is then multihash encoded.
        combinationString = `${chatMessage}${subject}${dateNow.toISOString()}`,
        combinationHash = await cryptoUtility.generateHash(combinationString),
        encoded = multihash.encode(Buffer.from(combinationHash), 0x12),

        // Generate and return chat protobuf
        payload = pbUtility.makeChatPB(encoded, subject, chatMessage, dateNow),

        // Now we wrap it in a pb.Message object.
        message = pbUtility.setChatMessagePayload(payload),

        // Use the protobuf serialize function to convert the object to a serialized byte array
        serializedMessage = message.serializeBinary(),

        // Generate private key form user's seed
        edd2519PrivateKey = await cryptoUtility.identityKeyFromSeed(seed),

        // Sign the message
        signature = await cryptoUtility.signIt(edd2519PrivateKey, serializedMessage),

        // Create the envelope
        serializedEnvelope = pbUtility.makeEnvelope(message, edd2519PrivateKey.public.bytes, signature),

        // Decode Recipient's public key
        recipientPublicKey = naclUtil.decodeBase64(recipientPublicKeyB64),

        // Generate ephemeral key pair
        ephemeralKeyPair = nacl.box.keyPair(),
        pub = keys.unmarshalPublicKey(recipientPublicKey),
        cPubkey = ed2curve.convertPublicKey(pub._key),

        // Encrypt with NACL
        nonce = nacl.randomBytes(24),

        // Encrypt the serialized envelope using the recipient's public key.
        cipherText = nacl.box(serializedEnvelope, nonce, cPubkey, ephemeralKeyPair.secretKey),

        // Prepend the ephemeral public key to the ciphertext
        // Prepend nonce to the ephemPubkey+ciphertext
        combined = [...nonce, ...ephemeralKeyPair.publicKey, ...cipherText],

        // Base64Encode
        encodedCipherText = naclUtil.encodeBase64(combined);

    return encodedCipherText;
};




exports.sendChatMessage = async () => {
    dom.triggerSendMessageLoader();

    const recipientPeerID = document.getElementById("recipientPeerID").value,
        chatMessage = document.getElementById("chatMessage").value,
        mnemonicSeed = document.getElementById("userMnemonicSeed").value,
        messageID = cryptoUtility.uuidv4(),
        recipientPublicKeyB64 = await request.getRecipientPublicKeyB64(recipientPeerID);
    if (recipientPublicKeyB64) {
        try {
            const encryptedMessage = await generateEncryptedCiphertext(recipientPublicKeyB64, chatMessage, mnemonicSeed);

            formattedMessage = {
                    encryptedMessage: encryptedMessage,
                    recipient: recipientPeerID
                },

                // Generate the authentication message and send it to the relay.
                typedMessage = {
                    Type: "EncryptedMessage",
                    Data: formattedMessage
                }

            socket.forwardMessageToWebRelay(JSON.stringify(typedMessage));
            dom.sendMessageResponse(`Success: Sent!`, "success");
        } catch (e) {
            console.error(e)
        }
    }
};