package main

import (
	"github.com/OpenBazaar/openbazaar-go/mobile"
	"net/http"
	"github.com/gorilla/websocket"
	"log"
	"gx/ipfs/QmZoWKhxUmZ2seW4BzX6fJkNR8hh9PsGModr7q171yq2SS/go-libp2p-peer"
	"sync"
	"encoding/json"
	"gx/ipfs/QmaPbCnUMBohSGo3KnxEa2bHqyJVVeEEcwtqJAYxerieBo/go-libp2p-crypto"
	"time"
	"encoding/hex"
	"crypto/rand"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}


type RelayProtocol struct {
	node *mobile.Node
	connectedNodes map[peer.ID][]*websocket.Conn
	lock sync.RWMutex
}

func StartRelayProtocol(n *mobile.Node) (error) {
	rp := &RelayProtocol{
		node: n,
		connectedNodes: make(map[peer.ID][]*websocket.Conn),
		lock: sync.RWMutex{},
	}
	http.HandleFunc("/", rp.handleNewConnection)
	return http.ListenAndServe(":8080", nil)
}

// Run authentication protocol
func (rp *RelayProtocol) handleNewConnection(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Print("upgrade:", err)
		return
	}
	defer c.Close()

	// The first message should be an AuthRequest message
	// We'll set up a timer, if we don't get one within 30
	// seconds we'll disconnect from this client.
	authChan := make(chan struct{})
	var authRequestMessage []byte
	go func() {
		_, authRequestMessage, err = c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			return
		}
		authChan <- struct{}{}
	}()

	ticker := time.NewTicker(time.Second * 30)
authLoop:
	for {
		select {
		case <-authChan:
			break authLoop
		case <-ticker.C:
			ticker.Stop()
			log.Println("peer timed out on connection")
			return
		}
	}
	ticker.Stop()

	// Unmarshall message
	authReq := new(AuthRequest)
	err = json.Unmarshal(authRequestMessage, authReq)
	if err != nil {
		c.WriteMessage(1, []byte(`{"error": "invalid auth message"}`))
		log.Println("invalid auth message:", err)
		return
	}

	// Decode the public key. Make sure it's properly formatted.
	pubKeyBytes, err := hex.DecodeString(authReq.Pubkey)
	if err != nil {
		c.WriteMessage(1, []byte(`{"error": "invalid pubkey"}`))
		log.Println("invalid pubkey:", err)
		return
	}
	pubKey, err := crypto.UnmarshalPublicKey(pubKeyBytes)
	if err != nil {
		c.WriteMessage(1, []byte(`{"error": "invalid pubkey"}`))
		log.Println("invalid pubkey:", err)
		return
	}

	// Create a peerID object from the pubkey
	pid, err := peer.IDFromPublicKey(pubKey)
	if err != nil {
		c.WriteMessage(1, []byte(`{"error": "invalid pubkey"}`))
		log.Println("invalid pubkey:", err)
		return
	}

	// Make sure the pubkey object matches the peerID they sent us
	// The reason the peerID is even needed here is because we'll eventually
	// have two peer ID types. We'll need to handle testing both ID types here.
	if pid.Pretty() != authReq.PeerID {
		c.WriteMessage(1, []byte(`{"error": "invalid peerID"}`))
		log.Println("invalid peerID:", err)
		return
	}

	// Create the challenge nonce
	nonce := make([]byte, 32)
	rand.Read(nonce)
	nonceHex := hex.EncodeToString(nonce)

	// Print it out for now to make it easy to debug
	log.Println(nonceHex)

	// Encrypt the nonce with the pubkey
	enc, err := encryptCurve25519(pubKey, nonce)
	if err != nil {
		c.WriteMessage(1, []byte(`{"error": "encryption error"}`))
		log.Println("encryption error:", err)
		return
	}

	// Send the challenge
	authResp := &AuthResponse{
		Challenge: hex.EncodeToString(enc),
	}
	resp, err := json.MarshalIndent(authResp, "", "    ")
	if err != nil {
		c.WriteMessage(1, []byte(`{"error": "internal error"}`))
		log.Println("json error:", err)
		return
	}
	c.WriteMessage(1, resp)

	// Wait for the challenge response. Again let's timeout after 30 seconds.
	respChan := make(chan struct{})
	var challengeResponseMessage []byte
	go func() {
		_, challengeResponseMessage, err = c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			return
		}
		respChan <- struct{}{}
	}()
	ticker = time.NewTicker(time.Second * 30)
challengeLoop:
	for {
		select {
		case <-respChan:
			break challengeLoop
		case <-ticker.C:
			ticker.Stop()
			log.Printf("peer %s timed out during auth\n", pid.Pretty())
			return
		}
	}
	ticker.Stop()

	// Unmarshal the response
	chalResp := new(ChallengeResponse)
	err = json.Unmarshal(challengeResponseMessage, chalResp)
	if err != nil {
		c.WriteMessage(1, []byte(`{"error": "invalid challenge response"}`))
		log.Println("invalid challenge response:", err)
		return
	}

	// Make sure the nonce he sent us matches our nonce
	if chalResp.Nonce != nonceHex {
		c.WriteMessage(1, []byte(`{"auth": false}`))
		log.Printf("invalid challenge from peer %s\n", pid.Pretty())
		return
	}

	rp.lock.Lock()
	conns, _ := rp.connectedNodes[pid]
	conns = append(conns, c)
	rp.connectedNodes[pid] = conns
	rp.lock.Unlock()

	defer func() {
		rp.lock.Lock()
		_, ok := rp.connectedNodes[pid]
		if ok {
			delete(rp.connectedNodes, pid)
		}
		rp.lock.Unlock()
	}()

	log.Printf("New connected peer %s\n", pid.Pretty())
	c.WriteMessage(1, []byte(`{"auth": true}`))

	// TODO: load messages from db and send back to client

	for {
		// TODO: just echoing for now
		mt, message, err := c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			break
		}
		log.Printf("recv: %s", message)
		err = c.WriteMessage(mt, message)
		if err != nil {
			log.Println("write:", err)
			break
		}
	}
}