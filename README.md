# WerewolfGame
LINEを使って人狼ゲームをします。

## 遊び方
以下のQRコードをLINEで読み込んで友達追加してください。  
5人以上の友達が参加しているルームにBOTを追加して「ゲームを開始します」と発言するとゲームが始まります。
![image](https://user-images.githubusercontent.com/63386751/111076620-638c5e00-8530-11eb-9646-b3b1b83c2c88.png)

## 使用した技術
- DB
  Googleスプレットシートを使っています
[こちら](https://docs.google.com/spreadsheets/d/1mlVonZfEewV6Xn2iI5M-H4QQFfEUwvN3upTSf7hHHI4/edit?usp=sharing)
- LINE Messaging API
- Google Apps Script
  Googleスプレットシートのメニューの「ツール」から「スクリプト エディタ」を選択すると表示できます。

## 実装で⼯夫・苦労した点。
### サーバレス構成にしました
仕様は比較的平易な内容だったので、サーバを立てるよりもサーバレス構成で作ったほうが簡単に実現できると考えました。  
GoogleスプレットシートをDBとすることで、簡単に値を変更しながらデバッグすることができました。

### LINE上で完結できるようにしました。
スマホで人狼ゲームをやると想定する場合にアプリを入れたり、ブラウザにつないだりするよりもLINE上で人狼ゲームができることが最もお手軽と感じたのでLINE Messaging APIを採用しました。

### JavaScriptのMapやReduceを多用しています
十分なメモリサイズもあることから、積極的にMapやReduceを利用しています。有志のブログによると、forEachで処理するよりも性能がいいそうです。  
Googleスプレットシートのアクセスが多いと遅くなりがちらしいので極力1回の取得で済むようにしました。が、ユーザIDとゲームIDを使って処理をしていたので、関数毎に取得してしまった部分はもう少し工夫したかったです。  

### コントローラのような処理を意識しています。
reply関数の中ではアクションに応じて処理が進みますが、極力判定処理は省いてコントローラーのような作りにしています。

### debug処理を意識して追加しています。
googleスプレットシートのdebugシートに処理が記載されるようにしました。受信・送信の内容はわかるようにしています。  
またシステムエラーなどcatchできなかったエラーはGoogle Could console上のログエクスプローラーに表示されるようになっています。メールで通知することも可能なので実運用にも耐えれます。

## 追加で実装した機能があれば、その説明。
### LINE応答のコマンドパターンを自由に追加できるようにしています
Googleスプレットシートのcommandシートに

### 細かいバリデーションを追加しています
- 自分に投票できない
- 自分を殺害できない
- 死亡済みの人に投票・殺害できない
- 
## その他、感想・コメントがあれば。
この課題を通して、LINE Messaging APIとGoogle Apps Scriptに触れることができました。初めて触ってみましたがどちらもドキュメントが充実していて使いやすかったです。  
御社のプラティオで実装できないかと検討しましたが、乱数生成をする情報が載っていなかったので断念しました。

## 参考情報
[【30分でやる】Google Spread Sheetで管理するLINE BOTの作り方](https://qiita.com/WdknWdkn/items/b78ae572e7cb5c9dfdca "【30分でやる】Google Spread Sheetで管理するLINE BOTの作り方")
[Google Apps Script のログ管理を Google Cloud Platform で行なう](https://qiita.com/draqoon/items/f6b850c17853734c98fd "Google Apps Script のログ管理を Google Cloud Platform で行なう")
