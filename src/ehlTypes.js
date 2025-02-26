import * as _m0 from "protobufjs/minimal";

function createBaseMsgCreateHashCid() {
  return { creator: "", receiver: "", hashlink: "", vaultid: "" };
}

export const MsgCreateHashCid = {
  encode(message, writer = _m0.Writer.create()) {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.receiver !== "") {
      writer.uint32(18).string(message.receiver);
    }
    if (message.hashlink !== "") {
      writer.uint32(26).string(message.hashlink);
    }
    if (message.vaultid !== "") {
      writer.uint32(34).string(message.vaultid);
    }
    return writer;
  },
  decode(input, length) {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgCreateHashCid();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.creator = reader.string();
          break;
        case 2:
          message.receiver = reader.string();
          break;
        case 3:
          message.hashlink = reader.string();
          break;
        case 4:
          message.vaultid = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object) {
    const message = createBaseMsgCreateHashCid();
    message.creator = object.creator ?? "";
    message.receiver = object.receiver ?? "";
    message.hashlink = object.hashlink ?? "";
    message.vaultid = object.vaultid ?? "";
    return message;
  },
};
