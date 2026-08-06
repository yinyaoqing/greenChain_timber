import uuid
from unittest.mock import MagicMock

import pytest

import app.services.chain_service as chain_service
from app.core.settings import get_settings


class FakeConn:
    """記錄 execute/fetchrow 呼叫的假連線."""

    def __init__(self, plot_row):
        self.plot_row = plot_row
        self.executed: list[tuple] = []

    async def fetchrow(self, sql, *args):
        return self.plot_row

    async def execute(self, sql, *args):
        self.executed.append((sql.strip().split()[0].lower(), args))


class FakePool:
    def __init__(self, conn):
        self._conn = conn

    def acquire(self):
        pool_conn = self._conn

        class _Ctx:
            async def __aenter__(self):
                return pool_conn

            async def __aexit__(self, *a):
                return False

        return _Ctx()


PLOT_ID = uuid.uuid4()
PLOT_ROW = {"geo_hash": "ab" * 32, "species": "taiwania", "co2e_tons": 357.3476}


@pytest.fixture
def chain_env(monkeypatch):
    monkeypatch.setenv("MINTER_PRIVATE_KEY", "0x" + "11" * 32)
    monkeypatch.setenv("NFT_CONTRACT_ADDRESS", "0x" + "22" * 20)
    get_settings.cache_clear()
    yield
    monkeypatch.delenv("MINTER_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("NFT_CONTRACT_ADDRESS", raising=False)
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def fast_backoff(monkeypatch):
    monkeypatch.setattr(chain_service, "BACKOFF_SECONDS", [0, 0, 0])


async def test_success_first_try_writes_on_chain(chain_env, monkeypatch):
    conn = FakeConn(PLOT_ROW)
    result = {"tx_hash": "0xdead", "token_id": 7, "contract_address": "0x" + "22" * 20}
    mint = MagicMock(return_value=result)
    monkeypatch.setattr(chain_service, "_mint_fn", mint)

    await chain_service.mint_and_record(FakePool(conn), PLOT_ID)

    assert mint.call_count == 1
    verbs = [v for v, _ in conn.executed]
    assert "insert" in verbs  # chain_records upsert
    assert "update" in verbs  # status -> on_chain
    # mint 參數正確編碼
    kwargs = mint.call_args.kwargs
    assert kwargs["geo_hash_hex"] == "ab" * 32
    assert kwargs["carbon_kg_value"] == 357348
    assert kwargs["species_code"] == 1


async def test_retries_then_succeeds(chain_env, monkeypatch):
    conn = FakeConn(PLOT_ROW)
    mint = MagicMock(
        side_effect=[
            chain_service.ChainMintError("rpc down"),
            {"tx_hash": "0xbeef", "token_id": 8, "contract_address": "0x" + "22" * 20},
        ]
    )
    monkeypatch.setattr(chain_service, "_mint_fn", mint)

    await chain_service.mint_and_record(FakePool(conn), PLOT_ID)

    assert mint.call_count == 2
    verbs = [v for v, _ in conn.executed]
    assert "update" in verbs  # 最終成功


async def test_three_failures_stay_pending_no_raise(chain_env, monkeypatch):
    conn = FakeConn(PLOT_ROW)
    mint = MagicMock(side_effect=chain_service.ChainMintError("always down"))
    monkeypatch.setattr(chain_service, "_mint_fn", mint)

    await chain_service.mint_and_record(FakePool(conn), PLOT_ID)  # 不得拋例外

    assert mint.call_count == 3
    # 三次失敗各 upsert 一次 retry_count/last_error；無 status update
    verbs = [v for v, _ in conn.executed]
    assert verbs.count("insert") == 3
    assert "update" not in verbs


async def test_chain_not_configured_skips(monkeypatch):
    get_settings.cache_clear()  # conftest 環境無私鑰 -> chain_configured False
    conn = FakeConn(PLOT_ROW)
    mint = MagicMock()
    monkeypatch.setattr(chain_service, "_mint_fn", mint)

    await chain_service.mint_and_record(FakePool(conn), PLOT_ID)

    assert mint.call_count == 0
    assert conn.executed == []


async def test_plot_not_pending_skips(chain_env, monkeypatch):
    conn = FakeConn(None)  # 查無 chain_pending 的 plot
    mint = MagicMock()
    monkeypatch.setattr(chain_service, "_mint_fn", mint)

    await chain_service.mint_and_record(FakePool(conn), PLOT_ID)

    assert mint.call_count == 0
