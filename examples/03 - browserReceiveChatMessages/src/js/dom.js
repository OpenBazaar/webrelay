const socketCtrl = require("./socket"),
    cryptoUtility = require("./cryptoUtility"),
    chat = require("./chat"),
    bip39 = require("bip39");

// Set initial page values and hook up click event for subscribe button
exports.initializePage = async () => {

    // On startup initialize a random mnemonic seed
    const mnemonic = "gravity extra brisk opinion wrap cigar lazy energy bottom law file cigar",
    // const mnemonicSeed = "disease also cute tent viable suspect fox plate dune grab wise night",
        // Generate private key from user's given mnemonic seed
        edd2519PrivateKey = await cryptoUtility.identityKeyFromSeed(mnemonic),
        // Derive PeerId from generated private key
        { peerID } = await cryptoUtility.identityFromKey(edd2519PrivateKey);

        // await cryptoUtility.generateSubscriptionKey("QmZ82fcRdXRqm4HNgaHxyux5bE7siHWGJkaZZx5DDZkMRD")
    // Assign peerID and mnemonic seed to user input
    document.getElementById("userPeerID").value = peerID;
    document.getElementById("userMnemonicSeed").value = mnemonic;
    // Hook up HTML Button to initialize socket connection
    document.getElementById("subscribeButton").addEventListener("click", socketCtrl.initializeSocketConnection);
    document.getElementById("tryAgainButton").addEventListener("click", this.resetToFirstStep);
    document.getElementById("sendMessageButton").addEventListener("click", chat.sendChatMessage);
    
}

exports.transitionFromFirstStep = () => {
    document.getElementById("firstSubscriptionStep").style.display = "none";
    document.getElementById("loadingStep").style.display = "block";
}

exports.transitionToSecondStep = () => {
    document.getElementById("loadingStep").style.display = "none";
    document.getElementById("secondSubscriptionStep").style.display = "block";
}

exports.displayError = () => {
    document.getElementById("loadingStep").style.display = "none";
    document.getElementById("errorOccurred").style.display = "block";
}

exports.resetToFirstStep = () => {
    document.getElementById("errorOccurred").style.display = "none";
    document.getElementById("firstSubscriptionStep").style.display = "block";
}

exports.sendMessageResponse = (message, messageType) => {
    document.getElementById("sendMessageLoader").style.display = "none";
    document.getElementById("sendMessageResponse").className = `${messageType}MessageContainer`;
    document.getElementById("sendMessageResponse").innerHTML = message;
}

exports.triggerSendMessageLoader = () => {
    document.getElementById("sendMessageLoader").style.display = "initial";
    document.getElementById("sendMessageResponse").className = "";
    document.getElementById("sendMessageResponse").innerHTML = "";
}