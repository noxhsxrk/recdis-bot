NVM_BIN  := $(shell ls -d $(HOME)/.nvm/versions/node/*/bin 2>/dev/null | sort -rV | head -1)
NPM      := $(NVM_BIN)/npm
NODE     := $(NVM_BIN)/node

INSTALL_PATH = /usr/local/bin/recdis-bot
SRC_FILE     = $(shell pwd)/src/index.js
VENV_DIR     = $(shell pwd)/venv
VENV_PYTHON  = $(VENV_DIR)/bin/python

.PHONY: setup setup-python start ramdisk install uninstall help update-model

## Show available targets
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  setup         Full first-time setup (npm + python venv)"
	@echo "  setup-python  Create venv and install mlx-whisper"
	@echo "  update-model  Update MLX whisper model to latest version"
	@echo "  start         Start the Discord bot"
	@echo "  ramdisk       Mount recordings_ramdisk as tmpfs (requires sudo)"
	@echo "  install       Install bot as a system command (recdis-bot)"
	@echo "  uninstall     Remove the system command"

## Update MLX Whisper model to latest version
update-model:
	@$(VENV_PYTHON) scripts/download_model.py


## Full first-time setup
setup: install setup-python
	@echo "Setup complete. Run 'make start' to launch the bot."

## Create Python venv and install mlx-whisper
setup-python:
	@echo "Setting up Python virtual environment..."
	@python3 -m venv $(VENV_DIR)
	@$(VENV_PYTHON) -m pip install --upgrade pip -q
	@$(VENV_PYTHON) -m pip install mlx-whisper hf_transfer -q
	@echo "Python worker ready at $(VENV_PYTHON)"

## Start the bot (requires Ollama to be running)
start:
	@echo "Starting RecDis-Bot..."
	@env PATH="$(NVM_BIN):$(PATH)" $(NODE) src/index.js

## Mount recordings_ramdisk as tmpfs for zero-disk audio buffering
ramdisk:
	@echo "Mounting recordings_ramdisk as tmpfs (2 GB)..."
	@mkdir -p recordings_ramdisk
	@sudo mount -t tmpfs -o size=2G tmpfs ./recordings_ramdisk
	@echo "RAM disk mounted at ./recordings_ramdisk"

## Install bot binary, env, and preload models
install: setup-python update-model
	@echo "Installing recdis-bot NPM packages..."
	@env PATH="$(NVM_BIN):$(PATH)" $(NPM) install
	@chmod +x $(SRC_FILE)
	@sudo ln -sf $(SRC_FILE) $(INSTALL_PATH)
	@echo "✅ Installed to $(INSTALL_PATH). Run with: recdis-bot"

## Remove system command
uninstall:
	@echo "Removing recdis-bot..."
	@rm -f $(INSTALL_PATH)
	@echo "Uninstalled from $(INSTALL_PATH)"
