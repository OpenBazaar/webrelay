Sending messages via the relay server
=========================
This document explains how to send messages via the webrelay to a recipient on the OpenBazaar network.

Before begining you will need to compile https://github.com/OpenBazaar/openbazaar-go/blob/master/pb/protos/message.proto to javascript.

The following are the steps needed to send a message:

1) Create the `pb.Envelope` protobuf object.
```proto
message Envelope {
    Message message = 1;
    bytes pubkey    = 2;
    bytes signature = 3;
}
```
`pubkey` is the serialized libp2p pubkey key that corresponds to your node's PeerID.

`signature` is a signature produced by signing the serialized `message` with the node's private key which corresponds to the PeerID.

`message` is a `pb.Message` object in this format:
```proto
message Message {
    MessageType messageType     = 1;
    google.protobuf.Any payload = 2;
}
```
`messageType` may be one of the following:
```proto
enum MessageType {
        PING                     = 0;
        CHAT                     = 1;
        FOLLOW                   = 2;
        UNFOLLOW                 = 3;
        ORDER                    = 4;
        ORDER_REJECT             = 5;
        ORDER_CANCEL             = 6;
        ORDER_CONFIRMATION       = 7;
        ORDER_FULFILLMENT        = 8;
        ORDER_COMPLETION         = 9;
        DISPUTE_OPEN             = 10;
        DISPUTE_UPDATE           = 11;
        DISPUTE_CLOSE            = 12;
        REFUND                   = 13;
        OFFLINE_ACK              = 14;
        OFFLINE_RELAY            = 15;
        MODERATOR_ADD            = 16;
        MODERATOR_REMOVE         = 17;
        STORE                    = 18;
        BLOCK                    = 19;
        VENDOR_FINALIZED_PAYMENT = 20;
        ERROR                    = 500;
}
```

Whereas the `payload` is a protobuf `Any` object which has the following format:
```proto
message Any {
  string type_url = 1;
  bytes value = 2;
}
```
Where `type_url` must be set to "type.googleapis.com/{protobuf object name}" and `value` is a serialized protobuf object.

For example if sending a `Chat` message the `type_url` would be "type.googleapis.com/Chat" and the `value` would be the serialization of
```proto
message Chat  {
    string messageId                    = 1;
    string subject                      = 2;
    string message                      = 3;
    google.protobuf.Timestamp timestamp = 4;
    Flag flag                           = 5;

    enum Flag {
        MESSAGE = 0;
        TYPING  = 1;
        READ    = 2;
    }
}
```

The protobuf library will usually have a function to create an `Any` object.

The following is an example of creating a a chat message in Go:

```go
  // First we create the `pb.Chat` object
  chatMessage := "hey you bastard"
  subject := ""
  
  // The chat message contains a timestamp. This must be in the protobuf `Timestamp` format.
  timestamp, _ := ptypes.TimestampProto(time.Now())

  // The messageID is derived from the message data. In this case it's the hash of the message,
  // subject, and timestamp which is then multihash encoded.
  idBytes := sha256.Sum256([]byte(chatMessage + subject + ptypes.TimestampString(timestamp)))
  encoded, _ := mh.Encode(idBytes[:], mh.SHA2_256)
  msgId, _ := mh.Cast(encoded)
  
  chatPb := &pb.Chat{
    MessageId: msgId.B58String(),
    Subject:   subject,
    Message:   chatMessage,
    Timestamp: timestamp,
    Flag:      pb.Chat_MESSAGE,
  }
  
  
  // Now we wrap it in a `pb.Message` object
  payload, _ := ptypes.MarshalAny(chatMessage)
  m := pb.Message{
    MessageType: pb.Message_CHAT,
    Payload:     payload,
  }
  
  
  // Now we wrap it in the envelop object
  pubKeyBytes, _ := n.IpfsNode.PrivateKey.GetPublic().Bytes()
	
  // Use the protobuf serialize function to convert the object to a serialized byte array
  serializedMessage, _ := proto.Marshal(m)
	
  // Sign the serializedMessage with the private key
  signature, _ := n.IpfsNode.PrivateKey.Sign(serializedMessage)
	
  // Create the envelope
  env := pb.Envelope{
    Message: m, 
    Pubkey: pubKeyBytes, 
    Signature: signature,
  }
```
  
  2. Encrypt the serialized envelope using the recipient's public key. For this you will need to use an `nacl` library. NOTE for
  this you will need the recipient's public key. We will have to create a server endpoint to get the pubkey. Technically I think the
  gateway already has one but we may need to improve it for this purpose. The public key is also found inside a listing so if you're
  looking at a listing you should already have it. 
  
  ```go
  // Serialize the envelope
  serializedEnvelope, _ := proto.Marshal(&env)
  
  // Get the public key
  recipientPublicKey := getPublicKeyFromGatewayOrListing()

  // Generate an ephemeral key pair
  ephemPub, ephemPriv, _ := box.GenerateKey(rand.Reader)
  
  // Convert recipient's key into curve25519
  pk, _ := recipientPublicKey.ToCurve25519()
  
  // Encrypt with nacl
  
  // Nonce must be a random 24 bytes
  var nonce [24]byte
  n := make([]byte, 24)
  rand.Read(n)
  for i := 0; i < 24; i++ {
    nonce[i] = n[i]
  }
  
  // Encrypt
  ciphertext := box.Seal(ciphertext, serializedEnvelope, &nonce, pk, ephemPriv)
  
  // Prepend the ephemeral public key to the ciphertext
  ciphertext = append(ephemPub[:], ciphertext...)
  
  // Prepend nonce to the ephemPubkey+ciphertext
  ciphertext = append(nonce[:], ciphertext...)

  // Base64 encode
  encodedCipherText := base64.StdEncoding.EncodeToString(ciphertext)
  ```
  
  3. Create a `EncryptedMessage` JSON object to send to the webrelay server
  ```go
  type EncryptedMessage struct {
    Message   string `json:"encryptedMessage"`
    Recipient string `json:"recipient"`
  }
```
`Message` is the base64 `encodedCipherText` from the example above
`Recipient` is the PeerID of the recipient
	



