from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    database_url: str = 'sqlite:///./data/archive.db'
    object_storage_mode: str = 'local'
    object_storage_root: str = './data/objects'
    object_storage_endpoint: str = ''
    object_storage_public_endpoint: str = ''
    object_storage_access_key: str = 'minioadmin'
    object_storage_secret_key: str = 'minioadmin'
    object_storage_bucket: str = 'memory-museum'
    object_storage_region: str = 'us-east-1'
    max_upload_bytes: int = 150 * 1024 * 1024
    curator_provider: str = 'deterministic'
    curator_base_url: str = ''
    curator_api_key: str = ''
    curator_model: str = ''
    public_app_origin: str = 'http://localhost:3104'

    @property
    def object_root_path(self) -> Path:
        return Path(self.object_storage_root).resolve()


settings = Settings()
