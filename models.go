package main

type AuthRequest struct {
	PeerID string `json:"peerID"`
	Pubkey string `json:"pubkey"`
}

type AuthResponse struct {
	Challenge string `json:"challenge"`
}

type ChallengeResponse struct {
	Nonce string `json:"nonce"`
}