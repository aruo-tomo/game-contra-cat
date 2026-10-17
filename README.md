# 喵斗羅 Contra-Cat

以貓重製《魂斗羅》。兩隻怪貓突擊隊（01 火斑、02 大口）打醒被赤鼠帝國洗腦嘅全城貓。

- `game/`：瀏覽器遊戲（HTML5 Canvas，原生 JS ES modules，冇 build step）
- `gdd/`：遊戲設計文件（`index.src.html` 係原稿，`index.html` 由佢加地圖生成）
- `gen/`：Codex 圖像生成（`jobs.py` 係 prompt 清單，`run_jobs.py` 平行生成，`raw/` 係原圖）
- `tools/`：`crop_chars.py`（裁原始設計圖）、`process_sprites.py`（去背、切格、出 manifest）、`stage_map.mjs`（第一關地圖 SVG）
- `tests/`：Playwright 測試

## 本地執行

```sh
cd game && python3 -m http.server 8765
# 打開 http://localhost:8765/index.html
```

ES modules 要經 HTTP 載入，直接開檔案唔得。

## 測試

需要 Node 同 Playwright（`npm i -g playwright`），先開咗上面嘅 server：

```sh
node tests/e2e.cjs        # 操作、武器、Boss、雙人、手掣、觸控等 26 項
node tests/polish.cjs     # coyote time、跳掣緩衝、瞄準姿勢、hit-stop、評級、選項等 14 項
node tests/autoaim.cjs     # 飛天罐唔扣血、自動瞄準、手機自動射
node tests/skills.cjs      # 必殺準備提示、三眼光炮射穿全畫面、大口噴彈貫穿
node tests/autoplay.cjs 1 4 [auto]   # 機械人自動通關（人數、加速倍數、auto＝只行同跳），輸出每段用時同受傷次數
```

## 重新生成圖

```sh
codex login --device-auth            # 用 ChatGPT 帳戶登入
cd gen && python3 run_jobs.py name1 name2   # 指定名就重做；唔指定就只做未有嘅
cd .. && python3 tools/process_sprites.py gen game/assets/sprites/gen
```

## 發佈到 GitHub Pages

```sh
sh tools/publish_pages.sh
```

將 `game/` 推去 `gh-pages` 分支，網址係 https://aruo-tomo.github.io/game-contra-cat/ 。第一次要喺 GitHub 嘅 repo Settings → Pages 揀 “Deploy from a branch”，branch 揀 `gh-pages`、資料夾揀 `/ (root)`。

