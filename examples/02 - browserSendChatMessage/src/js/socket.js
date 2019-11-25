const subscription = require("./subscription"),
    dom = require("./dom");

    let socket;

// Initialize connection to webrelay server
exports.initializeSocketConnection = () => {
    // Reset DOM to initial parameters
    dom.resetToFirstStep();
    // Hide mnemonic/host inputs    
    dom.transitionFromFirstStep();

    // Check if socket connected to the inputted server
    let socketConnected = false;

    // Grab host and peerID from input tags
    const webrelayHost = document.getElementById("webrelayHost").value,
        peerID = document.getElementById("userPeerID").value;

        socket = new WebSocket(webrelayHost);

    // On successful connection to webrelay socket server
    socket.addEventListener('open', async (event) => {
        // Mark connection as established
        socketConnected = true;
        subscription.subscribeToWebrelay(peerID, socket);
    });

    // Listen for messages from the server
    socket.addEventListener('message', (event) => {
        console.log(event.data);
        dom.transitionToSecondStep();
        subscription.successfullySubscribedToWebrelay();
    });

    // On socket connection closed
    socket.addEventListener('close', (event) => {
        dom.displayError();
        subscription.webrelayConnectionClosed(socketConnected);
    });
}

exports.forwardMessageToWebRelay = (message) => {
    socket.send(message);
}