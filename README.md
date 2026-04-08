# 🎙️ RecDis-Bot — Local AI Meeting Recorder

A privacy-focused Discord bot built with Node.js that records multi-track audio from voice channels, transcribes speech using **Apple's MLX Whisper** (Neural Engine), and generates structured meeting notes via a **local Ollama LLM** — all 100% on-device. No audio or text ever leaves your Mac.

## ✨ Features

- 🎧 **Multi-Track Recording:** Captures each speaker's RTP packets individually so voices never clip or muffle each other before mixdown.
- ⏱️ **Automatic Timeline Alignment:** Tracks precise millisecond offsets of when each user spoke. FFmpeg adds delays to align all speech bursts perfectly.
- 🧠 **Local AI Transcription (MLX Whisper):** Uses Apple's Neural Engine via the `mlx-whisper` Python library — fast, private, no API keys.
- 🗣️ **Real-time Diarization (Speaker ID):** Accurately tags individual transcription lines with the speaker's mapped name based on their isolated Discord audio track.
- 📝 **AI Meeting Summary (Ollama):** Sends the transcript to a locally-running Ollama model and posts structured notes (main topics, decisions, action items) directly into Discord.
- 🛡️ **Privacy Hardened:**
  - Raw `.pcm` buffers are written to `tmpfs` (RAM disk) — never persistently stored on disk.
  - No database; all session metadata is in-memory only.
  - Temp files are automatically deleted the moment mixing completes.
- 🚀 **Apple Silicon Optimised:** Uses `opusscript` for safe ARM-compatible Opus decoding and MLX for hardware-accelerated inference.

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
```bash
ollama pull llama3.2
```

### 3. Install
Run the automated Makefile installer. This will set up the Python environment, install NPM packages, download the 1.5GB MLX model automatically (via a fast mirror), and set up the `recdis-bot` system command.
```bash
make install
```


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
5. The bot will:
   - `[1/3]` Mix all tracks into a timeline-accurate MP3
   - `[2/3]` Transcribe audio locally via MLX Whisper on the Neural Engine
   - `[3/3]` Generate structured meeting notes via Ollama
   - Post the summary text directly into the Discord chat, and attach the MP3, `_transcript.txt`, and `_summary.md` files. All files are simultaneously saved to `~/Downloads`.

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
