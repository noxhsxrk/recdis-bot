const cp = require("node:child_process");
const ffmpegStatic = require("ffmpeg-static");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const EXPORTS_DIR = path.join(os.homedir(), "Downloads");

function mixdown(sessionData) {
  return new Promise((resolve, reject) => {
    const chunks = sessionData.chunks;

    if (!chunks || chunks.length === 0) {
      return reject(new Error("No audio chunks found in session."));
    }

    if (!fs.existsSync(EXPORTS_DIR)) {
      fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    }

    const outputPath = path.join(
      EXPORTS_DIR,
      `meeting_${sessionData.globalStartTime}.mp3`,
    );

    const args = [];

    chunks.forEach((chunk) => {
      args.push(
        "-f",
        "s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-i",
        chunk.filePath,
      );
    });

    let filterComplex = "";
    const mapLabels = [];

    chunks.forEach((chunk, index) => {
      const delay = chunk.startTimeOffset;

      if (delay > 0) {
        filterComplex += `[${index}:a]adelay=${delay}|${delay}[a${index}];`;
        mapLabels.push(`[a${index}]`);
      } else {
        filterComplex += `[${index}:a]anull[a${index}];`;
        mapLabels.push(`[a${index}]`);
      }
    });

    if (chunks.length > 1) {
      const amixInputs = mapLabels.join("");
      filterComplex += `${amixInputs}amix=inputs=${chunks.length}:dropout_transition=0,volume=${chunks.length}[out]`;
    } else {
      filterComplex += `${mapLabels[0]}anull[out]`;
    }

    args.push(
      "-filter_complex",
      filterComplex,
      "-map",
      "[out]",
      "-y",
      outputPath,
    );

    console.log(`[Mixer] Mixing ${chunks.length} tracks...`);

    const ffmpegProcess = cp.spawn(ffmpegStatic, args);

    ffmpegProcess.on("error", (err) => {
      reject(err);
    });

    // Uncomment for debugging
    // ffmpegProcess.stderr.on('data', (data) => console.log(data.toString()));

    ffmpegProcess.on("close", (code) => {
      if (code === 0) {
        console.log(`[Mixer] Successfully created mixdown at ${outputPath}`);
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });
}

module.exports = {
  mixdown,
};
