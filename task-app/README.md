# Task

iPhone 向けのシンプルなタスク管理アプリ（カテゴリー・期日・1ヶ月カレンダー・ToDo・音声入力・iPhone/PC 同期）。

## 構成
- `index.html` … アプリ本体（ビルド不要）
- `api/data.js` … 同期用 API（Vercel Functions + Neon Postgres）
- `package.json` … Neon のドライバ
- `manifest.json` / `sw.js` / `icons/` … ホーム画面追加・オフライン用

## Vercel の設定
1. このリポジトリを Vercel で Import（Framework Preset は「Other」）
2. プロジェクトの「Storage」→「Neon」（Free プラン）を作成してこのプロジェクトに Connect
   - 環境変数 `DATABASE_URL` が自動で入ります（テーブルは初回アクセス時に自動作成）
3. Redeploy

## 同期の使い方
- 1台目：「…」→「iPhone・PC の同期」→「新しい同期コードを作る」
- 2台目以降：同じ画面で同期コードを入力して「接続」
- データは同期コードの SHA-256 をキーに保存されます。コードは他人に教えないこと。
