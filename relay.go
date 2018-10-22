package main

import (
	"encoding/json"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"sync"
	"time"
	mh "gx/ipfs/QmZyZDi491cCNTLfAhwcaDii2Kg4pwKRkhqQzURGDvY6ua/go-multihash"
	"errors"
	"github.com/OpenBazaar/openbazaar-go/mobile"
	"encoding/base64"
	"context"
	"gx/ipfs/QmcZfnkapfECQGcLZaf9B79NRg7cRa9EnZh4LSbkCzwNvY/go-cid"
	"crypto/sha256"
	"encoding/hex"
	"gx/ipfs/QmZoWKhxUmZ2seW4BzX6fJkNR8hh9PsGModr7q171yq2SS/go-libp2p-peer"
	"github.com/OpenBazaar/openbazaar-go/ipfs"
	"strings"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type RelayProtocol struct {
	node           *mobile.Node
	db             Datastore
	connectedNodes map[string][]*websocket.Conn
	lock           sync.RWMutex
}

func StartRelayProtocol(n *mobile.Node, db Datastore) error {
	rp := &RelayProtocol{
		connectedNodes: make(map[string][]*websocket.Conn),
		lock:           sync.RWMutex{},
		db:             db,
		node:           n,
	}
	go rp.handlePublishes()
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
	incomingMessage := new(TypedMessage)
	err = json.Unmarshal(authRequestMessage, incomingMessage)
	if err != nil {
		c.WriteMessage(1, []byte(`{"error": "invalid incoming message"}`))
		log.Println("invalid incoming message:", err)
		return
	}

	authReq := new(AuthMessage)
	err = json.Unmarshal(incomingMessage.Data, authReq)
	if err != nil {
		c.WriteMessage(1, []byte(`{"error": "invalid auth message"}`))
		log.Println("invalid auth message:", err)
		return
	}
	if authReq.UserID == "" {
		c.WriteMessage(1, []byte(`{"error": "userID required"}`))
		log.Println("received auth message without userID")
		return
	}

	// Decode the subscription key
	subscriptionKey, err := mh.FromB58String(authReq.SubscriptionKey)
	if err != nil {
		c.WriteMessage(1, []byte(`{"error": "subscription key"}`))
		log.Println("invalid subscription key:", err)
		return
	}

	if err := rp.db.AddSubscription(subscriptionKey); err != nil {
		c.WriteMessage(1, []byte(`{"error": "database error"}`))
		log.Println("error saving subscriber to database:", err)
		return
	}

	if err := rp.subscribe(subscriptionKey); err != nil {
		c.WriteMessage(1, []byte(`{"error": "subscribe error"}`))
		log.Println("error subscribing to pubsub:", err)
		return
	}

	rp.lock.Lock()
	conns, _ := rp.connectedNodes[subscriptionKey.B58String()]
	conns = append(conns, c)
	rp.connectedNodes[subscriptionKey.B58String()] = conns
	rp.lock.Unlock()

	defer func(wsConn *websocket.Conn) {
		rp.lock.Lock()
		conns, ok := rp.connectedNodes[subscriptionKey.B58String()]
		// If only one connection, remove it from map
		if ok && len(conns) == 1 {
			delete(rp.connectedNodes, subscriptionKey.B58String())
		} else if ok { // Otherwise just delete the connection from the list
			for i, conn := range conns {
				if conn == wsConn {
					conns[i] = conns[len(conns)-1]
					conns = conns[:len(conns)-1]
					rp.connectedNodes[subscriptionKey.B58String()] = conns
					break
				}
			}
		}
		rp.lock.Unlock()
	}(c)

	log.Printf("New peer subscription: %s\n", subscriptionKey.B58String())
	c.WriteMessage(1, []byte(`{"auth": true}`))

	// Load messages for subscription key
	messages, err := rp.db.GetMessages(authReq.UserID, subscriptionKey)
	if err != nil {
		log.Println("error fetching messages from database: ", err)
	}
	for _, message := range messages {
		formatted, err :=  json.MarshalIndent(message, "", "    ")
		if err != nil {
			log.Println(err)
			continue
		}
		c.WriteMessage(1, formatted)
	}

	for {
		_, message, err := c.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			break
		}
		if err := rp.handleMessage(message, authReq.UserID); err != nil {
			log.Println(err)
		}
	}
}

func (rp *RelayProtocol) handleMessage(m []byte, userID string) error {
	incomingMessage := new(TypedMessage)
	err := json.Unmarshal(m, incomingMessage)
	if err != nil {
		log.Println("invalid incoming message:", err)
		return err
	}

	message, err := unmarshalMessage(incomingMessage.Data)
	if err != nil {
		return err
	}
	switch incomingMessage.Type {
	case "EncryptedMessage":
		em := message.(EncryptedMessage)
		b, err := base64.StdEncoding.DecodeString(em.Message)
		if err != nil {
			return err
		}
		_, err = peer.IDB58Decode(em.Recipient)
		if err != nil {
			return nil
		}
		return rp.node.OpenBazaarNode.SendOfflineRelay(em.Recipient, b)
	case "AckMessage":
		return rp.db.MarkMessageAsRead(message.(AckMessage).MessageID, userID)
	}
	return nil
}

func unmarshalMessage(m []byte) (interface{}, error) {
	formatted := strings.Replace(string(m) , "\n", "", -1)
	var encryptedMessage EncryptedMessage
	if err := json.Unmarshal([]byte(formatted), &encryptedMessage); err == nil {
		return encryptedMessage, nil
	}
	var ack AckMessage
	if err := json.Unmarshal([]byte(formatted), &ack); err == nil {
		return ack, nil
	}
	return nil, errors.New("unknown message type")
}

func (rp *RelayProtocol) handlePublishes() {
	subs, err := rp.db.GetSubscriptions()
	if err != nil {
		log.Fatal(err)
	}
	for _, sub := range subs {
		if err := rp.subscribe(sub); err != nil {
			log.Println(err)
		}
	}
}

func (rp *RelayProtocol) subscribe(sub mh.Multihash) error {
	k, err := cid.Decode(sub.B58String())
	if err != nil {
		return err
	}

	topic := ipfs.MessageTopicPrefix+k.String()

	currentSubscriptions := rp.node.OpenBazaarNode.Pubsub.Subscriber.GetSubscriptions()
	for _, s := range currentSubscriptions {
		if s == topic { // already subscribed
			return nil
		}
	}
	c, err := rp.node.OpenBazaarNode.Pubsub.Subscriber.Subscribe(context.Background(), topic)
	if err != nil {
		return err
	}
	go func(subscriptionKey mh.Multihash, ch <-chan []byte) {
		for {
			data := <- ch
			messageID := sha256.Sum256(data)
			err := rp.db.PutMessage(subscriptionKey, hex.EncodeToString(messageID[:]), data)
			if err != nil {
				log.Println(err)
			}
			nodes, ok := rp.connectedNodes[subscriptionKey.B58String()]
			if ok {
				for _, node := range nodes {
					messageID := sha256.Sum256(data)
					em := EncryptedMessage{
						ID: hex.EncodeToString(messageID[:]),
						Message: base64.StdEncoding.EncodeToString(data),
					}
					out ,err := json.MarshalIndent(em, "", "    ")
					if err != nil {
						log.Println(err)
						continue
					}
					node.WriteMessage(1, out)
				}
			}
		}
	}(sub, c)
	return nil
}