import json
import logging
import os


class ConfigManager:
    def __init__(self, config_file="translation_configs.json"):
        self.config_file_path = config_file
        self.configs = {}
        self._load_configs()

    def _load_configs(self):
        if os.path.exists(self.config_file_path):
            try:
                with open(self.config_file_path, "r") as f:
                    self.configs = json.load(f)
                logging.info(
                    f"Loaded {len(self.configs)} configuration from {self.config_file_path}"
                )
            except (json.JSONDecodeError, IOError) as e:
                logging.error(f"Error loading config file: {e}")
                self.configs = {}
        else:
            logging.info("Config file not found. Starting with empty configurations")
            self.configs = {}

    def _save_configs(self):
        try:
            with open(self.config_file_path, "w") as f:
                json.dump(self.configs, f, indent=4)
            logging.info(f"Saved configurations to {self.config_file_path}")
        except IOError as e:
            logging.error(f"Error saving config file: {e}")

    def add_config(self, config_data: dict):
        config_name = config_data.get("name")
        if not config_name:
            logging.error("Cannot add config without a name.")
            return False
        if config_name in self.configs:
            logging.error(f"Config '{config_name}' already exists. Use update instead.")
            return False

        self.configs[config_name] = config_data
        self._save_configs()
        return True

    def update_config(self, original_name: str, new_config_data: dict):
        """Updates an existing config, handling renames too"""
        new_name = new_config_data.get("name")
        if not new_name:
            logging.error("Cannot update config without a name.")
            return False

        if original_name != new_name and original_name in self.configs:
            del self.configs[original_name]
        self.configs[new_name] = new_config_data
        self._save_configs()
        return True

    def get_config(self, name: str):
        return self.configs.get(name)

    def get_all_configs(self):
        return self.configs

    def delete_config(self, name: str):
        if name in self.configs:
            del self.configs[name]
            self._save_configs()
            return True
        return False
