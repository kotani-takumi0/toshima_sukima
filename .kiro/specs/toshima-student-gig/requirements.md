# Requirements Document

## Introduction

本仕様は、豊島区内の高校生・大学生と、豊島区内の個人事業主・地域施設を短時間タスクで結ぶ「学生向け地域スキマバイト」MVPを定義する。
対象は区内限定で、依頼内容は30〜60分の軽作業・支援業務を中心とする。

## Requirements

### Requirement 1: 学生利用資格の厳格化
**Objective:** As a 豊島区内学生, I want 利用条件を明確に満たした状態で登録したい, so that 区外ユーザーが混在しない安全なコミュニティを維持できる

#### Acceptance Criteria
1.1 When 学生が登録申請する, the system shall 学校種別が高校または大学であることを必須検証する
1.2 When 学生が登録申請する, the system shall 学校所在地の区が豊島区である場合のみ登録を許可する
1.3 If 条件を満たさない, then the system shall 理由付きで登録拒否を返す

### Requirement 2: 事業者利用資格の厳格化
**Objective:** As a 豊島区内事業者, I want 区内に限定して依頼投稿したい, so that 地域内の相互扶助に集中できる

#### Acceptance Criteria
2.1 When 事業者が登録申請する, the system shall 事業者区分が個人事業主または地域施設であることを検証する
2.2 When 事業者が登録申請する, the system shall 拠点区が豊島区である場合のみ登録を許可する
2.3 If 条件を満たさない, then the system shall 理由付きで登録拒否を返す

### Requirement 3: 短時間募集の標準化
**Objective:** As a 事業者, I want 募集内容を統一フォーマットで作成したい, so that 学生が短時間で判断できる

#### Acceptance Criteria
3.1 When 募集を作成する, the system shall タイトル、説明、想定時間、カテゴリを必須入力にする
3.2 The system shall 想定時間を15分以上120分以下で受け付ける
3.3 Where 募集が公開される, the system shall カテゴリ、所要時間、報酬情報を一覧表示する

### Requirement 4: 報酬モデルの二系統対応
**Objective:** As a 事業者, I want 現金または非金銭報酬を選びたい, so that 地域特性に合わせたお礼設計ができる

#### Acceptance Criteria
4.1 When 報酬種別がcash, the system shall 金額を必須入力として保持する
4.2 When 報酬種別がhospitality, the system shall おもてなし内容の説明を必須入力として保持する
4.3 If 種別に対応する必須項目が欠落する, then the system shall 募集作成を拒否する

### Requirement 5: 応募と採用フロー
**Objective:** As a 学生, I want 募集に応募して採用可否を確認したい, so that 空き時間に合うタスクへ参加できる

#### Acceptance Criteria
5.1 When 学生が公開中募集に応募する, the system shall 応募を受け付けて応募状態をpendingで保存する
5.2 When 事業者が応募を採用する, the system shall 状態をacceptedへ更新する
5.3 If 既に採用済み枠が埋まっている, then the system shall 追加採用を拒否する

### Requirement 6: 学生向け閲覧導線
**Objective:** As a 学生, I want 豊島区内募集を短時間で見つけたい, so that 空きコマ中に参加判断できる

#### Acceptance Criteria
6.1 When 学生が募集一覧を開く, the system shall 公開中募集のみを表示する
6.2 When 学生がカテゴリを指定する, the system shall 指定カテゴリの募集に絞り込んで表示する
6.3 The system shall 最新作成順で募集を表示する
