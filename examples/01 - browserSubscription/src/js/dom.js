const socketCtrl = require("./socket"),
    cryptoUtility = require("./cryptoUtility"),
    bip39 = require("bip39");

// Set initial page values and hook up click event for subscribe button
exports.initializePage = async () => {
    // On startup initialize a random mnemonic seed
    const mnemonicSeed = bip39.generateMnemonic(),
        // Generate private key from user's given mnemonic seed
        edd2519PrivateKey = await cryptoUtility.identityKeyFromSeed(mnemonicSeed),
        // Derive PeerId from generated private key
        { peerID } = await cryptoUtility.identityFromKey(edd2519PrivateKey.bytes);

    // Assign peerID to user input
    document.getElementById("userPeerID").value = peerID;
    // Hook up HTML Button to initialize socket connection
    document.getElementById("subscribeButton").addEventListener("click", socketCtrl.initializeSocketConnection);
    document.getElementById("tryAgainButton").addEventListener("click", this.resetToFirstStep);
    
}

exports.transitionFromFirstStep = () => {
    document.getElementById("firstSubscriptionStep").style.display = "none";
    document.getElementById("loadingStep").style.display = "block";
}

exports.transitionToSecondStep = () => {
    document.getElementById("loadingStep").style.display = "none";
    document.getElementById("secondSubscriptionStep").style.display = "block";
}

exports.resetToFirstStep = () => {
    document.getElementById("secondSubscriptionStep").style.display = "none";
    document.getElementById("firstSubscriptionStep").style.display = "block";
}