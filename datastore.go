package main

import (
	"gx/ipfs/QmZyZDi491cCNTLfAhwcaDii2Kg4pwKRkhqQzURGDvY6ua/go-multihash"
	"errors"
	"encoding/base64"
	"sync"
)

type Datastore interface {
	AddSubscription(mh multihash.Multihash) error

	GetSubscriptions() ([]multihash.Multihash, error)

	PutMessage(subscriptionKey multihash.Multihash, messageID string, message []byte) error

	GetMessages(userID string, subscriptionKey multihash.Multihash) ([]EncryptedMessage, error)

	MarkMessageAsRead(messageID, userID string) error
}

type MockDatastore struct {
	messages map[string]mockEntry
	subscriptionIndex map[string][]string
	subscribers map[string]struct{}
	lock sync.Mutex
}

func NewMockDatastore() *MockDatastore {
	m := &MockDatastore{
		messages: make(map[string]mockEntry),
		subscriptionIndex: make(map[string][]string),
		subscribers: make(map[string]struct{}),
		lock: sync.Mutex{},
	}
	return m
}

type mockEntry struct {
	EncryptedMessage
	seenBy map[string]bool
}

func (m *MockDatastore) AddSubscription(mh multihash.Multihash) error {
	m.lock.Lock()
	defer m.lock.Unlock()
	m.subscribers[mh.B58String()] = struct{}{}
	return nil
}

func (m *MockDatastore) GetSubscriptions() ([]multihash.Multihash, error) {
	m.lock.Lock()
	defer m.lock.Unlock()
	var subs []multihash.Multihash
	for sub := range m.subscribers {
		mh, err := multihash.FromB58String(sub)
		if err != nil {
			continue
		}
		subs = append(subs, mh)
	}
	return subs, nil
}

func (m *MockDatastore) PutMessage(subscriptionKey multihash.Multihash, messageID string, message []byte) error {
	m.lock.Lock()
	defer m.lock.Unlock()
	m.messages[messageID] = mockEntry{
		EncryptedMessage: EncryptedMessage{
			Message: base64.StdEncoding.EncodeToString(message),
			ID: messageID,
		},
		seenBy: make(map[string]bool),
	}
	messages, ok := m.subscriptionIndex[subscriptionKey.B58String()]
	if ok {
		messages = append(messages, messageID)
		m.subscriptionIndex[subscriptionKey.B58String()] = messages
	} else {
		m.subscriptionIndex[subscriptionKey.B58String()] = []string{messageID}
	}
	return nil
}


func (m *MockDatastore) GetMessages(userID string, subscriptionKey multihash.Multihash) ([]EncryptedMessage, error) {
	m.lock.Lock()
	defer m.lock.Unlock()
	var ret []EncryptedMessage
	messages, ok := m.subscriptionIndex[subscriptionKey.B58String()]
	if ok {
		for _, message := range messages {
			entry, ok := m.messages[message]
			if ok && !entry.seenBy[userID] {
				ret = append(ret, entry.EncryptedMessage)
			}

		}
	}
	return ret, nil
}

func (m *MockDatastore) MarkMessageAsRead(messageID, userID string) error {
	m.lock.Lock()
	defer m.lock.Unlock()
	message, ok := m.messages[messageID]
	if !ok {
		return errors.New("message does not exist")
	}
	message.seenBy[userID] = true
	return nil
}
