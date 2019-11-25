const userID = Math.random().toString(36).substring(7),
    cryptoUtility = require("./cryptoUtility");

// Generate subscription key and forward it to the server
exports.subscribeToWebrelay = async (peerID, socket) => {
    // Generate subscription key to be sent to the webrelay
    const subscriptionKey = await cryptoUtility.generateSubscriptionKey(peerID),
        // Format the authMessage for the webrelay
        authMessage = { userID: userID, subscriptionKey: subscriptionKey };

    // Forward message to the webrelay
    socket.send(JSON.stringify({ Type: "SubscriptionMessage", Data: authMessage }))
}

// Remove loading symbol and display server response
exports.successfullySubscribedToWebrelay = () => {
    document.getElementById("serverResponseMessage").className = "successMessageContainer";
    document.getElementById("serverResponseMessage").innerHTML = `Success: ${event.data}`
}

// Remove loading symbol and display error message
exports.webrelayConnectionClosed = (socketConnected) => {
    document.getElementById("serverResponseMessage").className = "errorMessageContainer";
    if (socketConnected) {
        document.getElementById("serverResponseMessage").innerHTML = "Error: Webrelay connection worked but your subscription request was rejected";
    } else {
        document.getElementById("serverResponseMessage").innerHTML = "Error: Failed to connect to your webrelay";
    }
}