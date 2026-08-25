from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    supabase_jwt_secret: str = ""
    supabase_url: str = ""
    cors_origins: str = "http://localhost:3000"
    # 正規表示式白名單（補明列清單不足處，如 Vercel Preview 的隨機子網域）；空字串 = 停用
    cors_origin_regex: str = ""

    # 區塊鏈（W3；未設定時上鏈停用、建檔流程照常）
    chain_rpc_url: str = "https://rpc-amoy.polygon.technology"
    chain_rpc_url_fallback: str = ""
    minter_private_key: str = ""
    nft_contract_address: str = ""
    chain_id: int = 80002
    admin_token: str = ""

    # 建置資訊（Render 於部署時自動注入 RENDER_GIT_COMMIT；本機為空）
    render_git_commit: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def build_version(self) -> str:
        """線上跑的是哪一版：Render 注入之 commit SHA 前 7 碼；未注入時回 local"""
        return self.render_git_commit[:7] if self.render_git_commit else "local"

    @property
    def chain_configured(self) -> bool:
        return bool(self.minter_private_key and self.nft_contract_address)


@lru_cache
def get_settings() -> Settings:
    return Settings()
