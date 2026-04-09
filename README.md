# 🎙️ RecDis-Bot — Local AI Meeting Recorder

A privacy-focused Discord bot built with Node.js that records multi-track audio from voice channels, transcribes speech using **Apple's MLX Whisper** (Neural Engine), and generates structured meeting notes via a **local Ollama LLM** — all 100% on-device. No audio or text ever leaves your Mac.

## ✨ Features

- 🎧 **Multi-Track Recording:** Captures each speaker's RTP packets individually so voices never clip or muffle each other before mixdown.
- ⏱️ **Automatic Timeline Alignment:** Tracks precise millisecond offsets of when each user spoke. FFmpeg adds delays to align all speech bursts perfectly.
- 🗣️ **Real-time Diarization (Speaker ID):** Accurately tags individual transcription lines with the speaker's mapped name based on their isolated Discord audio track.
- 🧠 **Local AI Transcription (Thonburian Whisper):** Uses the fine-tuned `distill-thonburian-whisper-large-v3-mlx` — specifically optimized for Thai speech, running on Apple's Neural Engine.
- 🛡️ **Silero VAD (Voice Activity Detection):** Integrated hardware-accelerated speech detection that filters out keyboard clicks and background noise before it hits the AI, preventing "hallucinations."
- 📝 **AI Meeting Summary (Ollama):** Generates structured notes via local Ollama models with a streaming implementation to prevent timeouts on long transcripts.
- ⚡ **Anti-Hallucination Filters:** Advanced heuristics to detect and discard:
  - Infinite word loops or "A.I. stuttering."
  - Non-target language fragments (e.g., random CJK characters from noise).
  - "Prompt Leakage" where the model ignores speech and repeats the system instruction.
- 🛡️ **Privacy Hardened:**
  - Raw `.pcm` buffers are written to `tmpfs` (RAM disk) — never persistently stored on disk.
  - No database; all session metadata is in-memory only.
  - Temp files are automatically deleted the moment transcription completes.
- 🚀 **Apple Silicon Optimised:** Uses MLX for hardware-accelerated inference and CoreAudio-optimized libraries.

## 🛠 Prerequisites

- **Node.js** 18.0.0 or newer
- **Python** 3.9+ (for the MLX Whisper worker)
- **Apple Silicon Mac** (M1/M2/M3/M4) — MLX is Apple Silicon only
- **Ollama** running locally ([ollama.com](https://ollama.com))
- A Discord Application Token with `Server Members` Intent enabled
- `ffmpeg` — handled automatically via the `ffmpeg-static` NPM package

> **Note on RAM Disk (tmpfs)**
> For zero disk wear during recording, mount the recordings directory as `tmpfs` before starting the bot:
> ```bash
> sudo mount -t tmpfs -o size=2G myramdisk ./recordings_ramdisk
> ```
> Or use `make ramdisk` (see below).

## 📦 Installation

### 1. Configure environment
Copy `.env.example` or create `.env` at the project root:
```env
DISCORD_TOKEN=your_bot_token_here

# Whisper language (ISO 639-1 code, default: th)
WHISPER_LANGUAGE=th

# Ollama model name (default: llama3.2)
OLLAMA_MODEL=llama3.2

# User ID to Name mapping for Speaker Identification (Diarization)
MEMBERS_NAMES=[{"id": 123456789, "name": "Alice"}, {"id": 987654321, "name": "Bob"}]
```

### 2. Pull the Ollama model
For best Thai results, we recommend **Qwen 2.5 (7B or 14B)** or **Llama 3.2**:
```bash
ollama pull qwen2.5:7b
# or
ollama pull llama3.2
```

### 3. Install
Run the automated Makefile installer. This will set up the Python environment, install NPM packages, download MLX models, and configure **Silero VAD** dependencies (`torch`, `torchaudio`, `torchcodec`).
```bash
 make install
 ```
 
 > [!TIP]
 > **Slow Download?** If the automated download is stuck or slow, you can use `curl` to download the heavy weights manually to `local_whisper_model/weights.safetensors`:
 > ```bash
 > curl -L -C - -o local_whisper_model/weights.safetensors https://hf-mirror.com/tawankri/distill-thonburian-whisper-large-v3-mlx/resolve/main/weights.safetensors
 > ```


## 🎮 Usage

Start the bot (make sure Ollama is running first):
```bash
node src/index.js
# or
make start
```

1. **Invite the bot** to your server via OAuth2 (scopes: `bot`, `applications.commands`).
2. Join a Voice Channel.
3. Type `/record` — the bot joins and starts capturing per-user audio streams.
4. When the meeting ends, type `/stop`.
5. The bot will execute the 3-stage pipeline:
   - `[1/3]` **Mix down** all tracks into a timeline-accurate MP3.
   - `[2/3]` **Transcribe** audio locally. You can see real-time progress for each participant in your terminal.
   - `[3/3]` **Summarize** via Ollama. 
   - **Note:** To keep the UI responsive, the bot will attach the **MP3 and Raw Transcript** to the chat *immediately* after transcription finishes, even while the AI summary is still being generated.
6. Once complete, the final structured notes (topics, decisions, action items) will be posted. All files are simultaneously saved to `~/Downloads`.

## 🗂 Project Structure

```
recdis-bot/
├── scripts/
│   └── download_model.py      # Model preloader using HF Asian mirror
├── transcribe.py              # Python worker — MLX Whisper transcription
├── src/
│   ├── index.js               # Bot gateway & slash command loader
│   ├── commands/
│   │   ├── record.js          # /record — join VC and start capture
│   │   └── stop.js            # /stop — mix → transcribe → summarise → post
│   ├── audio/
│   │   ├── streamManager.js   # Opus decoding, per-user PCM streams, timeline tracking
│   │   └── mixer.js           # FFmpeg mixdown with adelay timeline alignment
│   ├── ai/
│   │   ├── transcriber.js     # Node wrapper for the Python MLX Whisper worker
│   │   └── summarizer.js      # Ollama client for structured meeting notes
│   └── utils/
│       └── cleanup.js         # Deletes temp PCM files after mixing
├── recordings_ramdisk/        # Temporary PCM storage (mount as tmpfs for full privacy)
└── .env                       # Bot token + AI config
```

## 📜 License
ISC License
