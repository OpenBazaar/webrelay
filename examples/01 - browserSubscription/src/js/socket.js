const subscription = require("./subscription"),
    dom = require("./dom");

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
        peerID = document.getElementById("userPeerID").value,
        socket = new WebSocket(webrelayHost);


    // On successful connection to webrelay socket server
    socket.addEventListener('open', async (event) => {
        // Mark connection as established
        socketConnected = true;
        subscription.subscribeToWebrelay(peerID, socket);
    });

    // Listen for messages from the server
    socket.addEventListener('message', (event) => {
        dom.transitionToSecondStep();
        subscription.successfullySubscribedToWebrelay();
    });

    // On socket connection closed
    socket.addEventListener('close', (event) => {
        dom.transitionToSecondStep();
        subscription.webrelayConnectionClosed(socketConnected);
    });
}