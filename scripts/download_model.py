import os
from huggingface_hub import snapshot_download

os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

model_id = "mlx-community/whisper-large-v3-turbo"
local_dir = "local_whisper_model"

print(f"🚀 Updating / Downloading model '{model_id}'...")
print(f"📂 Destination: ./{local_dir}")
print("⏱️  This may take a few minutes if there's a new update...\n")

snapshot_download(
    repo_id=model_id,
    local_dir=local_dir,
    local_dir_use_symlinks=False
)

print("\n✅ Model update complete! All files are saved locally.")
