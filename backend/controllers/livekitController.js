const { AccessToken } = require("livekit-server-sdk");

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "devkey";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "secret";

const generateToken = async (req, res) => {
  try {
    const { identity, roomName } = req.body;

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      ttl: "2h",
      name: identity,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateMetadata: true,
      hidden: false,
      recorder: false,
    });

    const token = await at.toJwt();

    return res.json({
      token,
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        {
          urls: [
            "turn:turn.eafo.info:3478?transport=udp",
            "turn:turn.eafo.info:3478?transport=tcp",
          ],
          username: "test",
          credential: "test123",
        },
      ],
    });
  } catch (err) {
    return res.status(500).json({
      message: "Token generation failed",
      error: err.message,
    });
  }
};

module.exports = {
  generateToken,
};
