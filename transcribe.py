import sys
import os
import json
import subprocess
import mlx_whisper
import re
import torch
import torchaudio

def clean_hallucination(text):
    text = text.strip()
    if not text:
        return ""
    
    if re.search(r'[^\u0E00-\u0E7F\u0020-\u007E\s]', text):
        return ""

    text = re.sub(r'([ก-ฮะ-์])\1{4,}', r'\1\1\1', text)

    match = re.search(r'(.{1,30}?)\1{3,}', text)
    if match:
        pattern = match.group(1).strip()
        start_index = match.start()
        
        if 1 <= len(pattern) <= 6:
            text = text[:start_index + (len(match.group(1)) * 3)]
        else:
            text = text[:start_index + len(match.group(1))]
    
    prompt_keywords = ["ถอดความ", "การประชุม", "ภาษาไทย", "พูดคุย"]
    match_count = sum(1 for kw in prompt_keywords if kw in text)
    if match_count >= 2 and len(text) < 50:
        return ""

    unique_chars = set(text.replace(" ", ""))
    if len(text) > 45 and len(unique_chars) < 5:
        return ""
        
    return text.strip()

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
    repo_or_dir = model_path if os.path.isdir(model_path) else "tawankri/distill-thonburian-whisper-large-v3-mlx"

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
            speech_timestamps = get_speech_timestamps(wav, vad_model, sampling_rate=16000, threshold=0.5)

            speech_timestamps = [ts for ts in speech_timestamps if (ts['end'] - ts['start']) / 16000 >= 0.4]
            
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
                    logprob_threshold=-1.0,
                    word_timestamps=True, 
                    compression_ratio_threshold=2.0,
                    initial_prompt="ถอดความการพูดคุยภาษาไทย",
                    temperature=(0.0, 0.2, 0.4)
                )
                
                text = res.get("text", "").strip()
                os.remove(segment_path)
                
                cleaned_text = clean_hallucination(text)
                if cleaned_text:
                    track_text_parts.append(cleaned_text)
                    if cleaned_text != text:
                         print(f"[Transcriber] Cleaned repetition in track {i+1} segment {j+1}: \"{text[:40]}...\" -> \"{cleaned_text}\"", file=sys.stderr, flush=True)
                elif text:
                    print(f"[Transcriber] Filtered total hallucination in track {i+1} segment {j+1}: \"{text[:50]}...\"", file=sys.stderr, flush=True)

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
