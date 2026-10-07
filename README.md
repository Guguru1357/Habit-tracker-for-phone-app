# Habit-tracker-for-phone-app

個人習慣追蹤 PWA（重訓、鋼琴、日文、保健食品、家務...etc）。純 HTML/CSS/JS，不需要後端、不需要建置，加到手機主畫面後可離線使用。

## 功能

- **今日**：點一下打勾、再點取消；左右箭頭切換日期即可**補登**過去的紀錄
- **習慣**：新增 / 編輯 / 刪除 / 上下排序，每個習慣可選 emoji 與顏色
- **頻率**：每天 / 每週 N 次 / 指定星期幾（非排定日會顯示在「今天休息日」）
- **統計**：目前連續紀錄、最長紀錄、每月完成率、近 20 週 GitHub 風格總覽熱圖、每個習慣的月曆熱圖（點格子也能補登）
- **設定**：淺色 / 深色 / 跟隨系統、JSON 匯出與匯入備份

### 統計規則

| 頻率 | 連續紀錄（streak） | 月完成率 |
| --- | --- | --- |
| 每天 | 連續完成的天數 | 完成天數 ÷ 經過天數 |
| 指定星期 | 連續完成的「排定日」數，非排定日不影響 | 完成的排定日 ÷ 經過的排定日 |
| 每週 N 次 | 連續達標的週數（週一為一週開始） | 完成次數 ÷（N × 經過天數 / 7），上限 100% |

今天（或本週）還沒完成不會讓連續紀錄中斷。完成率從習慣建立日（或最早一筆補登紀錄）開始計算。

## 本機預覽

Service worker 與 ES modules 需要透過 HTTP 開啟（直接雙擊 `index.html` 不行）。在專案資料夾執行任一個：

```bash
python3 -m http.server 8080
# 或
npx http-server -p 8080 -c-1
```

然後打開 <http://localhost:8080>。

**用手機在區網測試**：手機與電腦連同一個 Wi-Fi，打開 `http://<電腦的區網 IP>:8080`。注意：非 HTTPS（localhost 以外）時 service worker 不會啟用，所以離線與「安裝」功能要部署到 GitHub Pages（HTTPS）後才能完整測試。

## 部署到 GitHub Pages

1. 把程式碼合併到 `main` 分支並 push。
2. 到 GitHub repo → **Settings** → **Pages**。
3. **Source** 選 **Deploy from a branch**，Branch 選 `main`、資料夾選 `/ (root)`，按 **Save**。
4. 等 1～2 分鐘，網址會是 `https://<你的帳號>.github.io/Habit-tracker-for-phone-app/`。

所有路徑都是相對路徑，放在子路徑下也能正常運作。

### 加到手機主畫面

- **iPhone**：用 Safari 打開網址 → 分享按鈕 → 「加入主畫面」
- **Android**：用 Chrome 打開 → 選單 → 「安裝應用程式」（或在 App 的「設定」頁按「安裝 App」）

打開過一次之後就可以離線使用。

### 發布更新

修改任何檔案後，**把 `sw.js` 最上面的 `VERSION` 加一**（例如 `'v1'` → `'v2'`）再 push。手機下次開啟 App 時會下載新版並自動重新載入。

## 資料與備份

- 資料存在瀏覽器 `localStorage`（key：`habit-tracker:v1`），只在這台裝置上，不會上傳。
- iOS 上「加到主畫面的 App」和「Safari 分頁」的資料是**分開的**。
- 換手機、清除 Safari 資料前，請到「設定 → 下載備份」匯出 JSON，再到新裝置「從 JSON 匯入」。匯入會**取代**目前資料。

## 檔案結構

```
index.html             頁面骨架、底部分頁列
css/style.css          樣式（手機優先、深色模式）
js/app.js              畫面與互動
js/stats.js            streak / 完成率計算
js/store.js            localStorage 存取、匯入匯出
js/date.js             日期工具（本地時間 YYYY-MM-DD）
sw.js                  service worker（離線快取）
manifest.webmanifest   PWA 設定
icons/                 App 圖示
```
