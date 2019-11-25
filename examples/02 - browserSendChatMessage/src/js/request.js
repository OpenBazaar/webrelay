const dom = require("./dom")

// Timeout used for fetch requests
const timeout = (ms, promise) => {
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
            reject(("Request timed out, peerID not found"))
        }, ms)
        promise.then(resolve, reject)
    })
}

exports.getRecipientPublicKeyB64 = async (peerId) => {
    // Get pubkey associated with peerID
    // 1. Get listings.json
    // 2. If listings then grab the first one and get the pubkey
    const domain = `https://gateway.ob1.io/ipns/${peerId}`,
        url = `${domain}/listings.json`;
    let listingsJson;
    try {
        listingsJson = await timeout(20000, fetch(url));
    } catch (err) {
        console.log(err);
        dom.sendMessageResponse(`Error: ${err}`, "error");
        return null;
    }
    // console.log(response)
    listingsJson = await listingsJson.json();


    if (listingsJson[0] && listingsJson[0].slug) {
        const slug = listingsJson[0].slug,
            listingResponse = await fetch(`${domain}/listings/${slug}.json`),
            listingJson = await listingResponse.json(),
            identityKey = listingJson.listing.vendorID.pubkeys.identity;
        return identityKey;
    } else {
        dom.sendMessageResponse(`Error: `, "Recipient needs a listing to derive their public key");
    }


}