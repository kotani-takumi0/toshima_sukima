# Technology Stack

## Architecture

モノリシックMVP（Node.js HTTPサーバ + 静的フロントエンド）。
まずは依存を最小化して検証速度を優先し、仕様安定後にDB/認証基盤を分離可能な構造へ拡張する。

## Core Technologies

- **Language**: JavaScript (ES2022)
- **Framework**: 依存なし（Node.js標準HTTP + ブラウザ標準API）
- **Runtime**: Node.js 20+

## Key Libraries

- 現時点は外部ライブラリを使用しない
- フェーズ2以降で必要に応じて `SQLite/Prisma`、`認証基盤`、`テストフレームワーク拡張` を検討

## Development Standards

### Type Safety
MVPではJSDoc型注釈と入力バリデーションで境界を明示する。将来のTypeScript移行を前提に、データ構造名は先に固定する。

### Code Quality

- ドメインロジックを `src/domain` に隔離
- API層は検証・レスポンス整形のみ担当
- 不正入力時は必ず4xxで理由を返す

### Testing

- Node標準の `node:test` を使用
- 重要ロジック（区域判定、報酬バリデーション、応募条件）を優先的に単体テスト

## Development Environment

### Required Tools

- Node.js 20+
- npm 10+

### Common Commands

```bash
# Dev: npm run dev
# Start: npm start
# Test: npm test
```

## Key Technical Decisions

- 依存ゼロ構成で環境差異とセットアップ負荷を最小化
- 豊島区限定判定はサーバ側で強制（フロント入力値を信頼しない）
- 報酬は `cash` / `hospitality` の2種を明示し、必須項目を分岐検証

---
_全依存の列挙ではなく、開発判断に効く技術方針を記録する_
