"""上鏈服務（FR-5.3–5.4）：Web3.py mint + 指數退避重試 + 回寫。

設計：
- mint_plot_sync 為同步阻塞（web3.py），由 mint_and_record 以 asyncio.to_thread 執行
- 上鏈失敗絕不回滾資料庫；林區停留 chain_pending，retry_count/last_error 記錄於 chain_records
- 背景任務不得拋出例外（避免炸掉事件圈）
"""

import asyncio
import logging
import uuid

import asyncpg
from web3 import Web3
from web3.logs import DISCARD

from app.core.settings import get_settings
from app.services.chain_codec import GREEN_ASSET_ABI, SPECIES_CODE, carbon_kg

logger = logging.getLogger(__name__)

BACKOFF_SECONDS = [5, 15, 45]
RECEIPT_TIMEOUT_S = 120

# 單一實例部署：序列化所有 mint 呼叫以避免 nonce 競爭
_mint_lock = asyncio.Lock()


class ChainMintError(Exception):
    pass


class ChainAlreadyMinted(ChainMintError):
    """geoHash 已上鏈但 DB 未回寫——不可重試，需人工對帳."""

    pass


def _connect(rpc_url: str, fallback_url: str) -> Web3:
    """主 RPC 優先，失敗切備援（R2 緩解）."""
    for url in [u for u in (rpc_url, fallback_url) if u]:
        try:
            w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 30}))
            if w3.is_connected():
                return w3
        except Exception:
            logger.warning("RPC 連線失敗，嘗試下一個: %s", url)
    raise ChainMintError("所有 RPC 節點皆無法連線")


def mint_plot_sync(
    *,
    rpc_url: str,
    fallback_url: str,
    private_key: str,
    contract_address: str,
    chain_id: int,
    geo_hash_hex: str,
    carbon_kg_value: int,
    species_code: int,
) -> dict:
    """同步 mint：建交易 -> 簽名 -> 送出 -> 等 receipt -> 解析 PlotMinted 取 tokenId."""
    w3 = _connect(rpc_url, fallback_url)
    account = w3.eth.account.from_key(private_key)
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(contract_address), abi=GREEN_ASSET_ABI
    )

    # 卡死 tx 復原：先查鏈上是否已 mint 過此 geoHash（receipt timeout / process 被 kill 導致
    # DB 未回寫時，避免無窮重試撞 GeoHashAlreadyMinted revert）
    try:
        already_used = contract.functions.geoHashUsed(bytes.fromhex(geo_hash_hex)).call()
    except Exception as exc:
        raise ChainMintError(str(exc)) from exc
    if already_used:
        raise ChainAlreadyMinted(
            "geoHash 已於鏈上 mint 但 DB 無紀錄——需人工對帳"
            "（polygonscan 查 PlotMinted 事件取 token_id 後補寫 chain_records）"
        )

    try:
        fn = contract.functions.mintPlot(
            account.address, bytes.fromhex(geo_hash_hex), carbon_kg_value, species_code
        )
        tx = fn.build_transaction(
            {
                "from": account.address,
                "nonce": w3.eth.get_transaction_count(account.address, "pending"),
                "chainId": chain_id,
            }
        )
        min_tip = w3.to_wei(25, "gwei")
        if "maxPriorityFeePerGas" in tx and tx.get("maxPriorityFeePerGas", 0) < min_tip:
            tx["maxPriorityFeePerGas"] = min_tip
            tx["maxFeePerGas"] = max(tx.get("maxFeePerGas", 0), min_tip * 2)
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=RECEIPT_TIMEOUT_S)
    except ChainMintError:
        raise
    except Exception as exc:  # RPC/nonce/gas/revert 皆轉為 ChainMintError 供重試
        raise ChainMintError(str(exc)) from exc

    if receipt["status"] != 1:
        raise ChainMintError(f"交易 revert：{tx_hash.hex()}")

    token_id = None
    for event in contract.events.PlotMinted().process_receipt(receipt, errors=DISCARD):
        token_id = int(event["args"]["tokenId"])
    if token_id is None:
        raise ChainMintError("receipt 中找不到 PlotMinted 事件")

    return {
        "tx_hash": "0x" + tx_hash.hex().removeprefix("0x"),
        "token_id": token_id,
        "contract_address": Web3.to_checksum_address(contract_address),
    }


# 測試注入點：mint_and_record 一律經由 _mint_fn 呼叫
_mint_fn = mint_plot_sync

_FETCH_SQL = """
select p.geo_hash, p.species, ce.co2e_tons
from forest_plots p
join carbon_estimates ce on ce.plot_id = p.id and ce.year_offset = 0
where p.id = $1 and p.status = 'chain_pending'
"""

_UPSERT_SUCCESS_SQL = """
insert into chain_records (
    plot_id, contract_address, token_id, tx_hash, chain_id, minted_at, retry_count, last_error
)
values ($1, $2, $3, $4, $5, now(), $6, null)
on conflict (plot_id) do update set
    contract_address = excluded.contract_address,
    token_id = excluded.token_id,
    tx_hash = excluded.tx_hash,
    chain_id = excluded.chain_id,
    minted_at = excluded.minted_at,
    retry_count = excluded.retry_count,
    last_error = null
"""

_MARK_ON_CHAIN_SQL = "update forest_plots set status = 'on_chain' where id = $1"

_UPSERT_FAILURE_SQL = """
insert into chain_records (plot_id, retry_count, last_error)
values ($1, $2, $3)
on conflict (plot_id) do update set
    retry_count = excluded.retry_count,
    last_error = excluded.last_error
"""


async def mint_and_record(pool: asyncpg.Pool, plot_id: uuid.UUID) -> None:
    """BackgroundTask 入口：mint + 回寫；至多 3 次嘗試、指數退避；永不拋例外."""
    try:
        settings = get_settings()
        if not settings.chain_configured:
            logger.info("chain 未設定，略過上鏈 plot_id=%s（停留 chain_pending）", plot_id)
            return

        async with pool.acquire() as conn:
            row = await conn.fetchrow(_FETCH_SQL, plot_id)
        if row is None:
            logger.info("plot 不存在或非 chain_pending，略過: %s", plot_id)
            return

        async with _mint_lock:
            for attempt in range(3):
                try:
                    result = await asyncio.to_thread(
                        _mint_fn,
                        rpc_url=settings.chain_rpc_url,
                        fallback_url=settings.chain_rpc_url_fallback,
                        private_key=settings.minter_private_key,
                        contract_address=settings.nft_contract_address,
                        chain_id=settings.chain_id,
                        geo_hash_hex=row["geo_hash"],
                        carbon_kg_value=carbon_kg(float(row["co2e_tons"])),
                        species_code=SPECIES_CODE[row["species"]],
                    )
                except ChainAlreadyMinted as exc:
                    logger.error(
                        "mint 偵測到 geoHash 已上鏈但 DB 未回寫 plot=%s error=%s", plot_id, exc
                    )
                    async with pool.acquire() as conn:
                        await conn.execute(
                            _UPSERT_FAILURE_SQL, plot_id, attempt + 1, str(exc)[:500]
                        )
                    return
                except Exception as exc:
                    logger.warning(
                        "mint 失敗 plot=%s attempt=%d error=%s", plot_id, attempt + 1, exc
                    )
                    async with pool.acquire() as conn:
                        await conn.execute(
                            _UPSERT_FAILURE_SQL, plot_id, attempt + 1, str(exc)[:500]
                        )
                    if attempt < 2:
                        await asyncio.sleep(BACKOFF_SECONDS[attempt])
                    continue

                async with pool.acquire() as conn:
                    async with conn.transaction():
                        await conn.execute(
                            _UPSERT_SUCCESS_SQL,
                            plot_id,
                            result["contract_address"],
                            result["token_id"],
                            result["tx_hash"],
                            settings.chain_id,
                            attempt,
                        )
                        await conn.execute(_MARK_ON_CHAIN_SQL, plot_id)
                logger.info(
                    "mint 成功 plot=%s token_id=%s tx=%s",
                    plot_id,
                    result["token_id"],
                    result["tx_hash"],
                )
                return

            logger.error(
                "mint 三次皆失敗，plot=%s 停留 chain_pending（可用 admin retry 補鑄）", plot_id
            )
    except Exception:
        logger.exception("mint_and_record 未預期例外 plot=%s", plot_id)
