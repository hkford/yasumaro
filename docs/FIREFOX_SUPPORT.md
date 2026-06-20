# Firefox対応アーキテクチャの概要

本書では、Yasumaro拡張機能においてFirefoxをサポートするために実施したアーキテクチャの変更点と実装の詳細についてまとめます。

## 背景
Yasumaroは当初、ChromeのManifest V3環境向けに設計されていました。Firefoxでの動作を実現するため、APIの差異（特に `offscreen` APIの欠如）や、より厳格なデータシリアライズ要件に対応するための構造的な変更を行いました。

## 主な変更点

### 1. 統合ブラウザAPIの導入
- **WebExtensions Polyfill**: `webextension-polyfill` を導入し、ChromeとFirefoxの両方で共通のPromiseベースのAPI（`browser` 名前空間）を使用できるようにしました。
- **名前空間の移行**: すべての `chrome.*` 呼び出しを `browser.*` に書き換え、クロスブラウザ互換性を確保しました。

### 2. SQLiteおよびAIルーティングのフォールバック
FirefoxのManifest V3実装では、現時点で `chrome.offscreen` APIがサポートされていない（または挙動が異なる）ため、以下の対策を講じました。
- **ダイレクトルーティング**: Firefox環境では、`SqliteClient` および `LocalAIClient` が `browser.runtime.sendMessage` を介さず、バックグラウンドスクリプト内でオフスクリーン向けメッセージハンドラーを直接呼び出すように変更しました。
- **メッセージループの防止**: Service Worker間の通信に `sendMessage` を使用しないことで、再帰的なメッセージループやブラウザのクラッシュを回避しました。

### 3. DataCloneErrorおよびシリアライズの修正
Firefoxのメッセージパッシングおよびストレージにおける構造化複製アルゴリズム（Structured Cloning）は、Chromeよりも厳格です。
- **楽観的ロック（Optimistic Lock）の修正**: `withOptimisticLock` が更新関数（`updateFn`）の結果を `await` していなかった問題を修正しました。これにより、Promiseオブジェクトがそのまま `browser.storage.local.set` に渡されて `DataCloneError` が発生する事象を解消しました。
- **ペイロードのクリーンアップ**: ダッシュボード、ポップアップ、バックグラウンド間でやり取りされるすべてのデータがJSONシリアライズ可能であることを確認しました。

### 4. 厳格な型安全性の確保
Firefoxへの移行に合わせ、コードベース全体の型安全性を強化しました。
- **`any` キャストの排除**: `service-worker.ts` や `sqliteClient.ts` などのコアモジュールから `as any` や `as unknown` キャストを完全に排除しました。
- **具体的なインターフェースの定義**: メッセージのペイロードやストレージレコードに対して、ジェネリックなオブジェクトではなく厳格なTypeScriptインターフェースを定義しました。

### 5. ビルド設定の更新
- **WXT設定**: `wxt.config.ts` を更新し、Firefox固有のマニフェスト設定（Gecko ID `browser_specific_settings` など）を追加しました。
- **ビルドスクリプト**: `package.json` に `build:firefox` および `dev:firefox` スクリプトを追加し、ビルドプロセスを簡略化しました。

## 検証結果
以下の手段により、Firefoxでの正常動作を確認しています。
1. Vitestによる自動テストスイート（5,800件以上のテストがパス）。
2. `tsc --noEmit` による型チェックのパス。
3. Firefox上でのダッシュボード表示および「今すぐ記録」ボタンの動作確認。

## Firefox での使い方

- [Firefox での拡張機能の読み込み方](https://dev.classmethod.jp/articles/201909-chrome-extension-on-firefox/)
- [Firefox で一時的な拡張機能を読み込むパス](about:debugging#/runtime/this-firefox)