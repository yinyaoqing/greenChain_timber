-- 展示資料名稱整理（T4.4）。名稱僅存 DB，鏈上只有 geoHash，改名不影響 AT-6。
-- 「延文實驗林場 A 區」(token #1) 為主展示資料，不改。
update forest_plots set name = '太平山示範林 B 區' where name = 'M3 上鏈驗證區';
update forest_plots set name = '棲蘭示範林 C 區'   where name = 'AT-5 重試演練區';
-- 使用者測試建立的林區（Step 1 清點後代入實際名稱執行）：
update forest_plots set name = '頭城示範林 D 區' where name = '測試林區';
