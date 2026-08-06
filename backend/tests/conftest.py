"""測試共用設定：在 import app 之前塞入假環境變數，避免依賴真實 .env/DB."""

import os

# 指向不存在的 DB：pool 建立失敗 -> app.state.pool = None，單元測試不碰真實 DB
os.environ.setdefault("DATABASE_URL", "postgresql://invalid:invalid@127.0.0.1:1/invalid")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-secret-0123456789abcdefghijklmnopqrstuvwxyz")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
