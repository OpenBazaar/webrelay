package main

type AuthMessage struct {
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
