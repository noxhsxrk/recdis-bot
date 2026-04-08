import sys
import os
import json
import subprocess
import mlx_whisper
import re
import torch
import torchaudio

def is_hallucination(text):
    text = text.strip()
    if not text:
        return False
    if re.search(r'(.{1,15}?)\1{5,}', text):
        return True
    unique_chars = set(text.replace(" ", ""))
    if len(text) > 35 and len(unique_chars) < 5:
        return True
    words = text.split()
    if len(words) > 10:
        unique_words = set(words)
        if len(unique_words) / len(words) < 0.2:
            return True
    return False

if len(sys.argv) < 3:
    print("STT_ERROR: Missing task JSON path or language")
    sys.exit(1)

task_json_path = sys.argv[1]
language = sys.argv[2]

vad_model, utils = torch.hub.load(repo_or_dir='snakers4/silero-vad', model='silero_vad', force_reload=False, trust_repo=True)
(get_speech_timestamps, _, _, _, _) = utils

try:
    with open(task_json_path, 'r', encoding='utf-8') as f:
        task_data = json.load(f)

    chunks = task_data.get("chunks", [])
    members = task_data.get("members", [])
    member_map = { str(m.get("id")): m.get("name") for m in members }

    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "local_whisper_model")
    repo_or_dir = model_path if os.path.isdir(model_path) else "mlx-community/whisper-large-v3-turbo"

    results = []

    for i, chunk in enumerate(chunks):
        user_id = str(chunk.get("userId"))
        offset = chunk.get("startTimeOffset", 0)
        pcm_path = chunk.get("filePath")
        name = member_map.get(user_id, f"User {user_id}")
        
        if not os.path.isfile(pcm_path):
            continue
            
        wav_path = pcm_path + ".wav"
        
        cmd = [
            "ffmpeg", "-y", "-f", "s16le", "-ar", "48000", "-ac", "2",
            "-i", pcm_path,
            "-ar", "16000", "-ac", "1", "-f", "wav", wav_path
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        if not os.path.isfile(wav_path):
            continue

        try:
            wav, sr = torchaudio.load(wav_path)
            speech_timestamps = get_speech_timestamps(wav, vad_model, sampling_rate=16000, threshold=0.3)
            
            if not speech_timestamps:
                os.remove(wav_path)
                continue
            
            print(f"[Transcriber] Track {i+1} for [{name}]: Found {len(speech_timestamps)} speech segments.", file=sys.stderr, flush=True)

            track_text_parts = []
            
            for j, ts in enumerate(speech_timestamps):
                start_sample = ts['start']
                end_sample = ts['end']
                
                padding = int(0.2 * 16000)
                start_sample = max(0, start_sample - padding)
                end_sample = min(wav.shape[1], end_sample + padding)
                
                segment_wav = wav[:, start_sample:end_sample]
                segment_path = f"{wav_path}.seg{j}.wav"
                torchaudio.save(segment_path, segment_wav, 16000)

                res = mlx_whisper.transcribe(
                    segment_path,
                    path_or_hf_repo=repo_or_dir,
                    language=language,
                    condition_on_previous_text=False,
                    no_speech_threshold=0.6,
                    logprob_threshold=-2.0,
                    word_timestamps=True, 
                    compression_ratio_threshold=2.4,
                    initial_prompt="นี่คือการถอดความบทสนทนาภาษาไทยในห้อง Discord",
                    temperature=(0.0, 0.2, 0.4, 0.6, 0.8, 1.0)
                )
                
                text = res.get("text", "").strip()
                os.remove(segment_path)
                
                if text and not is_hallucination(text):
                    track_text_parts.append(text)
                elif text:
                    print(f"[Transcriber] Filtered hallucination in track {i+1} segment {j+1}: \"{text[:50]}...\"", file=sys.stderr, flush=True)

            os.remove(wav_path)
            
            full_track_text = " ".join(track_text_parts).strip()
            if full_track_text:
                results.append({
                    "offset": offset,
                    "name": name,
                    "text": full_track_text
                })

        except Exception as err:
            print(f"[Transcriber Error] Track {i+1} failed: {err}", file=sys.stderr, flush=True)
            if os.path.isfile(wav_path): os.remove(wav_path)

    results.sort(key=lambda x: x["offset"])
    final_output = []
    for r in results:
        final_output.append(f"[{r['name']}]: {r['text']}")
        
    print("\n".join(final_output), flush=True)

except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"STT_ERROR: {str(e)}")
    sys.exit(1)
