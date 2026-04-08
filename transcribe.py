import sys
import sys
import os
import json
import subprocess
import mlx_whisper

if len(sys.argv) < 3:
    print("STT_ERROR: Missing task JSON path or language")
    sys.exit(1)

task_json_path = sys.argv[1]
language = sys.argv[2]

try:
    with open(task_json_path, 'r', encoding='utf-8') as f:
        task_data = json.load(f)

    chunks = task_data.get("chunks", [])
    members = task_data.get("members", [])
    
    member_map = { str(m.get("id")): m.get("name") for m in members }

    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "local_whisper_model")
    repo_or_dir = model_path if os.path.isdir(model_path) else "mlx-community/whisper-large-v3-turbo"

    results = []

    for chunk in chunks:
        user_id = str(chunk.get("userId"))
        offset = chunk.get("startTimeOffset", 0)
        pcm_path = chunk.get("filePath")
        
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
            
        res = mlx_whisper.transcribe(
            wav_path,
            path_or_hf_repo=repo_or_dir,
            language=language
        )
        
        text = res.get("text", "").strip()

        os.remove(wav_path)
        
        if text:
            name = member_map.get(user_id, f"User {user_id}")
            results.append({
                "offset": offset,
                "name": name,
                "text": text
            })

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
