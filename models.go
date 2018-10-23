package main

import "encoding/json"

type TypedMessage struct{
	Type string
	Data json.RawMessage
}

type SubscribeMessage struct {
	UserID          string `json:"userID"`
	SubscriptionKey string `json:"subscriptionKey"`
}

type EncryptedMessage struct {
	ID        string `json:"id"`
	Message   string `json:"encryptedMessage"`
	Recipient string `json:"recipient"`
}

type AckMessage struct {
	MessageID string `json:"messageID"`
}
