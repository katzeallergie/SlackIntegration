# Slack-GitHub Issue Integration

SlackワークフローからGitHub Issueを作成し、自動的にプロジェクトボードに追加するための Supabase Edge Function です。

## 機能

- Slackワークフローからの要求でGitHub Issueを作成
- 作成したIssueを指定したGitHubプロジェクトに自動追加
- プロジェクトボード上で自動的に"Icebox"ステータスに設定

## セットアップ

### 1. 環境変数の設定

Supabaseダッシュボードで以下の環境変数を設定してください：

- `GITHUB_TOKEN`: GitHubのPersonal Access Token（`repo`と`project`スコープが必要） 
- `GITHUB_OWNER`: GitHubのオーガナイゼーション名またはユーザー名
- `GITHUB_REPO`: 対象のリポジトリ名
- `GITHUB_PROJECT_NUMBER`: プロジェクト番号（プロジェクトURLから取得可能）

### 2. GitHubの設定

1. Personal Access Tokenの作成
   - GitHubの設定 > Developer settings > Personal access tokens > Tokens (classic)
   - 必要なスコープ: `repo`, `project`

2. プロジェクトボードの設定
   - "Status"フィールドが存在することを確認
   - "Icebox"オプションが存在することを確認

### 3. デプロイ

```bash
supabase functions deploy create-github-issue --project-ref daczfsmydgjtcyopaicj 
```

## Slackワークフローの設定

1. 新規ワークフローの作成
2. 「アプリを追加」から「HTTPリクエストを送信」を選択
3. 以下の設定を行う：
   - URL: `https://daczfsmydgjtcyopaicj.functions.supabase.co/create-github-issue`
   - メソッド: `POST`
   - ヘッダー:
     ```
     Authorization: Bearer [SUPABASE_ANON_KEY]
     Content-Type: application/json
     ```
   - ボディ:
     ```json
     {
       "title": "Issue Title",
       "body": "Issue description",
       "labels": ["bug"]
     }
     ```

## APIリファレンス

### リクエスト

```bash
curl -i --location --request POST 'https://[PROJECT_REF].functions.supabase.co/create-github-issue' \
  --header 'Authorization: Bearer [SUPABASE_ANON_KEY]' \
  --header 'Content-Type: application/json' \
  --data '{
    "title": "Issue Title",
    "body": "Issue description",
    "labels": ["bug"]
  }'
```

### レスポンス

成功時:
```json
{
  "success": true,
  "data": {
    "issue_url": "https://github.com/owner/repo/issues/1",
    "issue_number": 1,
    "project_url": "https://github.com/orgs/owner/projects/123"
  }
}
```

エラー時:
```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

