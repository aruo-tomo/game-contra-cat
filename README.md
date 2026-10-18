# 喵斗羅 Contra-Cat

以貓重製《魂斗羅》。兩隻怪貓突擊隊（01 火斑、02 大口）打醒被赤鼠帝國洗腦嘅全城貓。

- `game/`：瀏覽器遊戲（HTML5 Canvas，原生 JS ES modules，冇 build step）
- `gdd/`：遊戲設計文件（`index.src.html` 係原稿，`index.html` 由佢加地圖生成）
- `gen/`：Codex 圖像生成（`jobs.py` 係 prompt 清單，`run_jobs.py` 平行生成，`raw/` 係原圖）
- `tools/`：`crop_chars.py`（裁原始設計圖）、`process_sprites.py`（去背、切格、出 manifest）、`stage_map.mjs`（第一關地圖 SVG）
- 關卡：`game/src/level1.js`、`level2.js`、`level3.js`、`level4.js`（幾何、spawn 腳本、背景，各自 export 一個 `STAGEn`，`vertical: true` 係向上爬）；各關新敵人同 Boss 喺 `enemies2.js`、`enemies3.js`、`enemies4.js`
- `tests/`：Playwright 測試

## 本地執行

```sh
cd game && python3 -m http.server 8765
# 打開 http://localhost:8765/index.html
```

ES modules 要經 HTTP 載入，直接開檔案唔得。

語言：右下「語言」揀中文／EN，或者喺網址加 `?lang=en`（畀外國朋友用）。

關卡：每過一關可以撳「下一關」直接打落去（第二關寵物醫院走廊、第三關大魚缸瀑布、第四關寵物醫院地庫），過咗嘅關卡會喺標題畫面「關卡」度揀得返；網址加 `?stage=2`／`?stage=3`／`?stage=4` 可以直接由嗰關開始。第三關係向上爬嘅直向關卡，有兩段潛水（撳跳＝向上划，留意氧氣條）。開場漫畫第一次開波先播，標題畫面「睇故事」可以重睇。

## 測試

需要 Node 同 Playwright（`npm i -g playwright`），先開咗上面嘅 server：

```sh
node tests/e2e.cjs        # 操作、武器、Boss、雙人、手掣、觸控等 26 項
node tests/polish.cjs     # coyote time、跳掣緩衝、瞄準姿勢、hit-stop、評級、選項等 14 項
node tests/autoaim.cjs     # 飛天罐唔扣血、自動瞄準、手機自動射
node tests/skills.cjs      # 必殺準備提示、三眼光炮射穿全畫面、大口噴彈貫穿
node tests/grip.cjs        # 主角畫成揸住當前武器、換槍換圖、子彈由槍口出、受傷衝刺翻滾收槍
node tests/story.cjs       # 英文版、開場漫畫（6 格、第二次開波跳過、睇故事掣）、語言切換
node tests/enemies.cjs     # 機槍兵、投彈兵、狙擊兵、衝鋒兵、撲人尖叫貓、盤旋插落蝙蝠貓
node tests/stage4.cjs      # 第四關：輸送帶、蒸汽、培養缸、催眠（左右調轉）、火焰鼠、電磁鼠、蜘蛛仔、升降機、鑽頭工兵、蜘蛛機甲三個階段
node tests/stage3.cjs      # 第三關：直向鏡頭、游水同氧氣、泡泡、水流、魚缸頭貓、河豚水雷、潛水鼠、電鰻、滾罐頭鼠、海盜船長貓、機械錦鯉三個階段
node tests/stage2.cjs      # 第二關：接關、揀關、護士鼠、盾牌鼠、噴霧鼠、伊莉莎伯圈貓、天花鼠、激光閘、牆身激光、升降機、病床車、護士長、手術機械人
node tests/autoplay.cjs 1 4 [auto] [關卡]   # 機械人自動通關（人數、加速倍數、auto＝只行同跳、第幾關），輸出每段用時同受傷次數
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

