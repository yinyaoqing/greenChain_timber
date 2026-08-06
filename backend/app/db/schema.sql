-- 綠鏈林匯 schema v1（規格書 §7）。可於 Supabase SQL Editor 或 apply_schema.py 重放。
create extension if not exists postgis;

-- §7.1 核心資料表
create table if not exists forest_plots (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null references auth.users (id),
    name        text not null,
    species     text not null check (species in ('taiwania', 'acacia', 'fraxinus')),
    avg_age     int  not null check (avg_age between 1 and 100),
    density     int  not null check (density between 100 and 10000),
    geom        geometry (Polygon, 4326) not null,
    area_ha     numeric(10, 4) not null,
    geo_hash    char(64) not null unique,
    status      text not null default 'chain_pending'
                check (status in ('active', 'chain_pending', 'on_chain', 'rejected')),
    created_at  timestamptz not null default now()
);

-- FR-3.4：GIST 空間索引
create index if not exists idx_forest_plots_geom on forest_plots using gist (geom);

-- §7.2 估算紀錄（可追溯，G3）
create table if not exists carbon_estimates (
    id              uuid primary key default gen_random_uuid(),
    plot_id         uuid not null references forest_plots (id) on delete cascade,
    formula_version text not null,
    input_snapshot  jsonb not null,
    year_offset     int not null check (year_offset between 0 and 5),
    co2e_tons       numeric(12, 4) not null,
    created_at      timestamptz not null default now(),
    unique (plot_id, year_offset)
);

-- §7.3 鏈上紀錄（W3 使用，先建表）
create table if not exists chain_records (
    id               uuid primary key default gen_random_uuid(),
    plot_id          uuid not null unique references forest_plots (id) on delete cascade,
    contract_address text,
    token_id         bigint,
    tx_hash          text,
    chain_id         int not null default 80002,
    minted_at        timestamptz,
    retry_count      int not null default 0,
    last_error       text
);
