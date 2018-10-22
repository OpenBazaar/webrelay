Receiving messages from the relay server
===============================
Immediately after authenticating with the web relay server it will send the client all outstanding messages that the client has
not acked. Further, whenever the relay server receives a new message from the OpenBazaar network addressed to the client's subscription key
it will forward it to the client over the socket. 

The format of the message coming over the wire is:

```go
type EncryptedMessage struct {
	ID        string `json:"id"`
	Message   string `json:"encryptedMessage"`
}
```

To ack the message you send back:
```go
type AckMessage struct {
	MessageID string `json:"messageID"`
}
```
TODO: make the field name more descriptive

The encrypted message is base64 encoded ciphertext. NOTE that due to the way we calculate the subscription key from the prefix of the peerID, multiple users
may share the same subscription key. This means that the message may not be intended for you. To tell if the message is for you, you must attempt decryption using
your private key. If it decrypts, it's for you. If not, it's not for you. You should ACK messages that are not for you so that the relay stops
sending them to you.

To decrypt the message (in go):
```go
  // Convert base64 to bytes
  ciphertext, _ := base64.StdEncoding.DecodeString(encryptedMessage.message)
  
  // Convert identity private key to curve25519 private key
  curve25519Privkey := privKey.ToCurve25519()
  var plaintext []byte

  // Grab the nonce from the begining of the ciphertext
  n := ciphertext[:NonceBytes]
  
  // The ephemeral public key follows the nonce
  ephemPubkeyBytes := ciphertext[NonceBytes : NonceBytes+EphemeralPublicKeyBytes]
  
  // The actual encrypted message follows the ephemeral public key
  ct := ciphertext[NonceBytes+EphemeralPublicKeyBytes:]

  // Convert to array (this is a go thing)
  var ephemPubkey [32]byte
  for i := 0; i < 32; i++ {
    ephemPubkey[i] = ephemPubkeyBytes[i]
  }

  // Same here
  var nonce [24]byte
  for i := 0; i < 24; i++ {
    nonce[i] = n[i]
  }

  // Decrypt
  plaintext, success := box.Open(plaintext, ct, &nonce, &ephemPubkey, curve25519Privkey)
  if !success {
    // The message isn't for you (or something borked somewhere)
    return
  }

  // Unmarshal plaintext into an envelope
  env := pb.Envelope{}
  proto.Unmarshal(plaintext, &env)
  
  // Serialize the message for signature validation
  serializedMessage, _ := proto.Marshal(env.Message)
  
  // Unmarshall the public key from the envelope
  pubkey, _ := libp2p.UnmarshalPublicKey(env.Pubkey)
	
  // Use the public key to verify the signature in the envelope
  valid, err := pubkey.Verify(serializedMessage, env.Signature)
  if err != nil || !valid {
    // The signature wasn't valid meaning someone may be trying to forge the message. Discard it.
    return
  }

  // Extract recipient peerID from their public key so you know who sent the message
  id, _ := peer.IDFromPublicKey(pubkey)
	
  // Party because it worked
```

