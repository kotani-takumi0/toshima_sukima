# Project Structure

## Organization Philosophy

機能境界を優先するレイヤード構成（Domain / Application / Interface）。
画面とAPIの両方で同一ドメインルールを参照できるよう、業務ロジックを中央集約する。

## Directory Patterns

### Domain Layer
**Location**: `/src/domain/`  
**Purpose**: 募集、応募、ユーザー資格判定などの業務ルール  
**Example**: 区内判定、対象属性判定、報酬バリデーション

### API Layer
**Location**: `/src/server/`  
**Purpose**: HTTPルーティング、入力検証、エラーレスポンス  
**Example**: `POST /api/students`、`POST /api/gigs/:id/apply`

### Frontend Layer
**Location**: `/public/`  
**Purpose**: 募集閲覧・応募・登録のUI  
**Example**: 学生登録フォーム、募集カード一覧、応募導線

### Test Layer
**Location**: `/tests/`  
**Purpose**: ドメインルールの回帰防止  
**Example**: 区域チェック、報酬型チェック、応募条件

## Naming Conventions

- **Files**: `kebab-case.js`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Domain IDs**: `prefix_連番`（例: `stu_1`, `gig_2`）

## Import Organization

```javascript
// Node built-in
const { createServer } = require('node:http');

// Domain/Application
const { createGig } = require('../domain/gig-service');

// Local
const { parseJsonBody } = require('./http-utils');
```

**Path Aliases**:
- 現時点では未使用（相対パスを採用）

## Code Organization Principles

- ルーティング層で業務ロジックを直接記述しない
- 画面は表示責務、整合性は常にサーバ側で保証
- 1ファイル1責務を維持し、密結合を避ける

---
_ファイル一覧ではなく、追加実装時に守る設計パターンを記録する_
