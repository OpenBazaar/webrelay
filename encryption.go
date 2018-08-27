package main

import (
	"crypto/rand"
	"errors"
	"golang.org/x/crypto/nacl/box"
	"gx/ipfs/QmaPbCnUMBohSGo3KnxEa2bHqyJVVeEEcwtqJAYxerieBo/go-libp2p-crypto"
)

func encryptCurve25519(pubKey crypto.PubKey, plaintext []byte) ([]byte, error) {
	// Cast to ed25519 key
	key, ok := pubKey.(*crypto.Ed25519PublicKey)
	if !ok {
		return nil, errors.New("key is not an ed25519 key")
	}

	// Generated ephemeral key pair
	ephemPub, ephemPriv, err := box.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	// Convert recipient's key into curve25519
	pk, err := key.ToCurve25519()
	if err != nil {
		return nil, err
	}

	// Encrypt with nacl
	var ciphertext []byte
	var nonce [24]byte
	n := make([]byte, 24)
	_, err = rand.Read(n)
	if err != nil {
		return nil, err
	}
	for i := 0; i < 24; i++ {
		nonce[i] = n[i]
	}
	ciphertext = box.Seal(ciphertext, plaintext, &nonce, pk, ephemPriv)

	// Prepend the ephemeral public key
	ciphertext = append(ephemPub[:], ciphertext...)

	// Prepend nonce
	ciphertext = append(nonce[:], ciphertext...)
	return ciphertext, nil
}
