Authenticating with the relay server
===============================

Authenticating with the relay server requires sending it an `AuthMessage` JSON object embedded in a `TypedMessage` which looks like the following:

```Go
type TypedMessage struct{
	Type string
	Data json.RawMessage
}
```

```Go
type AuthMessage struct {
	UserID          string `json:"userID"`
	SubscriptionKey string `json:"subscriptionKey"`
}
```

`UserID` must be a string that is unique for each client. The UserID is used by the relay server to track which clients have
acked a message. For example if client with UserID `ABC` has acked message with ID `123` then the relay server will no longer
return `123` to the client when it connects. For this reason each UserID must be unquie for each user, long enough and random
enough such that it does not collide with any other user's ID, and must remain the same for each user across sessions. For these
reasons it's suggested that you derive the UserID deterministically from the user seed. For example, `PBKDF2(seed)`.

`SubscriptionKey` is derived from the prefix of the user's PeerID. This is used by webrelay to determine *which* messages to
download for each node. The way OpenBazaar offline messages work is they are not addressed directly to the recipient, but 
rather to a prefix of the recipient's PeerID. This is done for privacy reasons as you don't know for sure if a message was intended
for any given PeerID. Further since we're using prefixes this means that there is a (relatively low but not zero) probability that
a user will share a prefix with another user. This means that when downloading offline messsages you *may* get messages that were
intended for another user. The way we rectify this is by attempting decryption. If the message decrypts, it's for you. If it doesn't
it's not for you. 

The `SubscriptionKey` is the key that is derived from the PeerID prefix that the message is actually addressed to. The webrely will index
all messages by subscription key. So to get your messages from the server it needs to know what SubscriptionKey you're interested it.

The process of deriving the subscription key from the PeerID is relatively simple:

1) Convert the PeerID string to a Multihash object
```go
peerIDMultihash, _ := multihash.FromB58String(peerIDstring)
```
2) Decode the Multihash to extract the digest
```go
decoded, _ := multihash.Decode(peerIDMultihash)
digest := decoded.Digest
```
3) Grab the first 8 bytes of the digest byte array
```go
prefix := digest[:8]
```
4) Bit shift the prefix to the right by 48 places.
```go
// If the prefix is:
11111111 10101010 01010101 00001111 11110000 11001100 00110011 10110010

// After the shift you should have:
00000000 00000000 00000000 00000000 00000000 00000000 11111111 10101010

// In Go this is done by first converting the byte array to a uint64
prefix64 := binary.BigEndian.Uint64(prefix)

// Then shifting
shiftedPrefix64 := prefix64>>uint(48)

// Then converting back to a byte array
shiftedBytes := make([]byte, 8)
binary.BigEndian.PutUint64(shiftedBytes, shiftedPrefix64)
```
5) Hash the shifted prefix with SHA256
```go
hashedShiftedPrefix := sha256.Sum256(shiftedBytes)
```
6) Re-encode as a multihash to get your `SubscriptionKey`
```go
SubcriptionKey, _ := multihash.Encode(hashedShiftedPrefix[:], multihash.SHA2_256)
fmt.Println(SubcriptionKey.B58String()) // QmWqVgN2CtEgWgSXTfWHDoEhXXf26oZdfehPsCCWLZ4BB6
```
Test Vector:
```
PeerID:          QmaSAmPPynrWfz1R8XvRm1GX6ghzPze6XSZCov6fWWUzSg
SubscriptionKey: QmaGLQjHHdeZ3wKtKqHS9etMwSUDnckHnAYS6eqvAgp2Hf
```

You have 30 seconds to send the `AuthMessage` object after connecting before the relay will disconnect from you.

Once authenticated the webrelay will return:
```json
{"auth": true}
```


Example Code:

```Go
package main

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	b58 "github.com/mr-tron/base58/base58"
	"github.com/multiformats/go-multihash"
)

func main() {

    peerIDMultihash, _ := multihash.FromB58String("QmaSAmPPynrWfz1R8XvRm1GX6ghzPze6XSZCov6fWWUzSg")

    decoded, _ := multihash.Decode(peerIDMultihash)
    digest := decoded.Digest
    prefix := digest[:8]
    
    prefix64 := binary.BigEndian.Uint64(prefix)

    // Then shifting
    shiftedPrefix64 := prefix64>>uint(48)

    // Then converting back to a byte array
    shiftedBytes := make([]byte, 8)
    binary.BigEndian.PutUint64(shiftedBytes, shiftedPrefix64)

    hashedShiftedPrefix := sha256.Sum256(shiftedBytes)

    SubscriptionKey, _ := multihash.Encode(hashedShiftedPrefix[:], multihash.SHA2_256)

    fmt.Println(b58.Encode([]byte(SubscriptionKey))) //QmaGLQjHHdeZ3wKtKqHS9etMwSUDnckHnAYS6eqvAgp2Hf

}
```
