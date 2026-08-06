from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    supabase_jwt_secret: str = ""
    supabase_url: str = ""
    cors_origins: str = "http://localhost:3000"

    # 區塊鏈（W3；未設定時上鏈停用、申報流程照常）
    chain_rpc_url: str = "https://rpc-amoy.polygon.technology"
    chain_rpc_url_fallback: str = ""
    minter_private_key: str = ""
    nft_contract_address: str = ""
    chain_id: int = 80002
    admin_token: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def chain_configured(self) -> bool:
        return bool(self.minter_private_key and self.nft_contract_address)


@lru_cache
def get_settings() -> Settings:
    return Settings()
