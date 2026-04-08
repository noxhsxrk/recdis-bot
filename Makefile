# Variables
INSTALL_PATH = /usr/local/bin/recdis-bot
SRC_FILE = $(shell pwd)/src/index.js

.PHONY: install uninstall

install:
	@echo "Setting up recdis-bot..."
	@chmod +x $(SRC_FILE)
	@ln -sf $(SRC_FILE) $(INSTALL_PATH)
	@echo "Successfully installed to $(INSTALL_PATH)"
	@echo "You can now run the bot using the command: recdis-bot"

uninstall:
	@echo "Removing recdis-bot..."
	@rm -f $(INSTALL_PATH)
	@echo "Successfully uninstalled from $(INSTALL_PATH)"
