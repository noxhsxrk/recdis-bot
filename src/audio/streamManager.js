const { EndBehaviorType } = require("@discordjs/voice");
const prism = require("prism-media");
const fs = require("fs");
const path = require("path");

const RECORDINGS_DIR = path.join(__dirname, "..", "..", "recordings_ramdisk");

let activeSession = null;

function initSession(connection) {
  if (activeSession) {
    throw new Error("A recording session is already active.");
  }

  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }

  activeSession = {
    globalStartTime: Date.now(),
    connection: connection,
    chunks: [],
    activeStreams: [],
    recordingUsers: new Set(),
    speakingListener: null
  };

  const receiver = connection.receiver;

  activeSession.speakingListener = (userId) => {
    if (!activeSession) return;
    handleUserStream(receiver, userId);
  };

  receiver.speaking.on("start", activeSession.speakingListener);

  console.log(
    `[StreamManager] Session started at ${activeSession.globalStartTime}`,
  );
}

function handleUserStream(receiver, userId) {
  if (activeSession.recordingUsers.has(userId)) return;
  activeSession.recordingUsers.add(userId);

  const timestamp = Date.now();
  const startTimeOffset = timestamp - activeSession.globalStartTime;
  const filename = `user_${userId}_${timestamp}.pcm`;
  const filePath = path.join(RECORDINGS_DIR, filename);

  const audioStream = receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 1000,
    },
  });

  const pcmStream = audioStream.pipe(
    new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }),
  );

  const writeStream = fs.createWriteStream(filePath);
  pcmStream.pipe(writeStream);

  activeSession.activeStreams.push(writeStream);

  const chunkMeta = {
    userId,
    startTimeOffset,
    filePath,
  };
  activeSession.chunks.push(chunkMeta);

  writeStream.on("finish", () => {
    if (!activeSession) return;
    activeSession.recordingUsers.delete(userId);
    const index = activeSession.activeStreams.indexOf(writeStream);
    if (index !== -1) {
      activeSession.activeStreams.splice(index, 1);
    }
  });
}

function endSession() {
  if (!activeSession) {
    throw new Error("No active recording session.");
  }

  for (const writeStream of activeSession.activeStreams) {
    if (!writeStream.closed) {
      writeStream.end();
    }
  }

  if (activeSession.connection && activeSession.speakingListener) {
    activeSession.connection.receiver.speaking.removeListener("start", activeSession.speakingListener);
  }

  const sessionData = {
    globalStartTime: activeSession.globalStartTime,
    chunks: activeSession.chunks,
  };

  activeSession = null;
  return sessionData;
}

function getActiveSession() {
  return activeSession;
}

module.exports = {
  initSession,
  endSession,
  getActiveSession,
};
