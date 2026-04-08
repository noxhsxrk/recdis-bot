const { execFile } = require("node:child_process");
const path = require("node:path");

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const PYTHON_BIN = path.join(PROJECT_ROOT, "venv", "bin", "python");
const WORKER_SCRIPT = path.join(PROJECT_ROOT, "transcribe.py");

const fs = require("node:fs");

/**
 * Transcribes multiple audio chunks using the MLX Whisper Python worker for diarization.
 * @param {Object} taskData - The JSON payload containing chunks and mapping
 * @returns {Promise<string>} The transcribed text with speaker names.
 */
function transcribe(taskData) {
  const language = process.env.WHISPER_LANGUAGE || "th";
  const tempJsonPath = path.join(PROJECT_ROOT, `transcription_task_${Date.now()}.json`);
  
  // Write the precise job to disk for Python to read
  fs.writeFileSync(tempJsonPath, JSON.stringify(taskData), "utf8");

  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_BIN,
      [WORKER_SCRIPT, tempJsonPath, language],
      { maxBuffer: 10 * 1024 * 1024 }, // 10 MB stdout buffer
      (error, stdout, stderr) => {
        // Clean up the temp JSON
        if (fs.existsSync(tempJsonPath)) {
          fs.unlinkSync(tempJsonPath);
        }

        const output = stdout.trim();

        if (error) {
          return reject(
            new Error(`Transcription process failed: ${output || stderr}`)
          );
        }

        if (output.startsWith("STT_ERROR:")) {
          return reject(new Error(output));
        }

        if (!output) {
          return reject(new Error("Transcription returned empty output."));
        }

        resolve(output);
      }
    );
  });
}

module.exports = { transcribe };
