# 🎙️ RecDis-Bot (Multi-track Audio Recorder)

A privacy-focused Discord bot built with Node.js that joins a voice channel, records audio from multiple meeting participants into isolated tracks, and automatically compiles them into a single timeline-accurate MP3 file when the meeting concludes.

Designed specifically for generating **Meeting Notes** or providing high-quality conversational audio for downstream Speech-to-Text (Transcription) AI services.

## ✨ Features

- 🎧 **Multi-Track Processing:** Captures each speaker's RTP packets individually so that the voices never clip or muffle each other before the mixdown.
- ⏱️ **Automatic Timeline Alignment:** Tracks the precise millisecond offsets of when each user spoke. The FFmpeg mixer adds automatic delays to align all speech bursts perfectly.
- 🛡️ **Privacy Hardened:** 
  - Writes raw recording buffers (`.pcm`) natively to `tmpfs` (RAM disk), meaning audio is never persistently written to physical disk storage pending mixing.
  - No database needed; metadata is strictly kept in memory.
  - Automatically deletes all temporary tracks the moment mixing is completed.
- 🚀 **Server Efficiency:** Purely decoupled `opusscript` decoding safely bypasses native compilation errors on Apple Silicon / ARM servers.

## 🛠 Prerequisites

- Node.js 18.0.0 or newer
- A Discord Application Token with `Server Members` Intent enabled
- `ffmpeg` (Handled via the `ffmpeg-static` NPM package; no system installations required).

> **Note on RAM Disk (tmpfs)**
> For the highest level of privacy and zero disk wear on concurrent chunking, it's advised to mount the output target as `tmpfs` before running:
> ```bash
> sudo mount -t tmpfs -o size=2G myramdisk ./recordings_ramdisk
> ```

## 📦 Installation

1. **Clone the repository**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Environment:**
   Create a `.env` file at the root of the project with the following:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   ```

## 🎮 Usage

Start the bot:
```bash
node src/index.js
```

1. **Invite the bot** to your Discord server using the OAuth2 URL generated in your Developer Portal (scopes: `bot`, `applications.commands`).
2. Join a Voice Channel.
3. Type `/record` into any text channel to summon the bot into your voice channel and immediately begin capturing meeting audio.
4. When the meeting concludes, type `/stop`.
5. The bot will disconnect, compute the offset alignments, execute FFmpeg mixing, and directly send the final mixed `.mp3` file into your chat.

## 🗂 Project Structure
- `src/index.js`: Bot gateway initialization and slash command loader.
- `src/commands/`: Executable Discord Slash configurations (`/record`, `/stop`).
- `src/audio/streamManager.js`: Voice packet capturing, opus decoding, duplicate prevention, and real-time chunk alignment logic.
- `src/audio/mixer.js`: `child_process` wrapper interacting with `ffmpeg-static` to seamlessly stitch `.pcm` tracks.
- `src/utils/cleanup.js`: Privacy layer ensuring temporary storage sweep.

## 📜 License
ISC License
