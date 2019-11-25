const myProtos = require("../../protobufs/message_pb"),
    google_protobuf_any_pb = require('google-protobuf/google/protobuf/any_pb.js'),
    multihash = require('multihashes'),
    google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb.js');

/*
 * This is a placeholder for creating the envelope.
 */
exports.makeEnvelope = (message, pubKey, sig) => {
    const envelope = new myProtos.Envelope();
    envelope.setMessage(message);
    envelope.setPubkey(pubKey);
    envelope.setSignature(sig);
    const serializedEnvelope = envelope.serializeBinary();
    return serializedEnvelope;
};

// Generate and return chat protobuf
exports.makeChatPB = (encodedMessage, subject, chatMessage, dateNow) => {
    // Create the Chat PB
    const chatPb = new myProtos.Chat(),
        b58MsgID = multihash.toB58String(encodedMessage),
        // The chat message contains a timestamp. This must be in the protobuf 'Timestamp' format.
        timestamp = new google_protobuf_timestamp_pb.Timestamp();

    timestamp.fromDate(dateNow);
    chatPb.setMessageid(multihash.toB58String(encodedMessage));
    chatPb.setSubject(subject);
    chatPb.setMessage(chatMessage);
    chatPb.setTimestamp(timestamp);
    chatPb.setFlag(myProtos.Chat.Flag.MESSAGE);

    const payload = chatPb.serializeBinary();

    return payload;
};

exports.setChatMessagePayload = (payload) => {
    any = new google_protobuf_any_pb.Any();
    any.setTypeUrl('type.googleapis.com/Chat');
    any.setValue(payload);

    const message = new myProtos.Message();
    message.setMessagetype(myProtos.Message.MessageType.CHAT);
    message.setPayload(any);
    return message;
}