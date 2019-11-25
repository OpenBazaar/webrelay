package main

import (
	"github.com/OpenBazaar/openbazaar-go/mobile"
	"log"
)

func main() {
	node, err := mobile.NewNodeWithConfig(&mobile.NodeConfig{
		DisableWallet:        true,
		DisableExchangerates: true,
		RepoPath:             "/tmp/webrelay",
		UserAgent:            "webrelay:1.0.0",
	}, "", "")
	if err != nil {
		log.Fatal(err)
	}
	node.Start()
	StartRelayProtocol(node, NewMockDatastore())
}
