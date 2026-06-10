V1.7 純手動資料版

重點：
- 已移除 Wiki 匯入/爬蟲功能。
- 菇菇改由網站內新增、編輯、刪除。
- 可上傳菇菇圖片，圖片會以 Data URL 存在瀏覽器 localStorage。
- 技能使用圖示按鈕選擇。
- 技能圖示已由你提供的截圖裁切，放在 public/skills/。
- 關卡資料仍在 src/data/stages.json；之後你給我新地圖截圖，我可以生成新的 stages.json 讓你覆蓋。

執行：
npm install
npm run dev

注意：
- 換電腦或清除瀏覽器資料前，請先到「設定」頁下載備份 JSON。
- 匯入備份時，把 JSON 內容貼回設定頁即可。
