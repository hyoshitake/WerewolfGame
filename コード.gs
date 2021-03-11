// 利用しているシート
var SHEET_ID = '1mlVonZfEewV6Xn2iI5M-H4QQFfEUwvN3upTSf7hHHI4';
// 利用しているコマンドのシート名
var SHEET_NAME_COMMAND = 'command';
// 利用しているゲームのシート名
var SHEET_NAME_GAME = 'game';
// 利用しているユーザのシート名
var SHEET_NAME_USER = 'user';

// LINE Message API アクセストークン
var ACCESS_TOKEN = 'V+Y9D1EUKUIp6wTPpDHud8q35GfVVasINXllq4F3h71fUVnpjzrNjw20JOWKk6ruZnGjkd1MIXr7+hPqU025aacDMXW1obqGXkDoJZD6IEw/02BWVyz2e0ClNxxhdRdPuq6H+U79SwCQEYo8ffNcOgdB04t89/1O/w1cDnyilFU=';
// 通知URL
var PUSH = "https://api.line.me/v2/bot/message/push";
// リプライ時URL
var REPLY = "https://api.line.me/v2/bot/message/reply";
// プロフィール取得URL
var PROFILE = "https://api.line.me/v2/profile";

//受信フラグ
const MSG_RESERVE = 1;
//送信フラグ
const MSG_SEND = 2;
//ゲーム進捗状態
var GAME_STATE = { 
  WAIT_JOIN : "START",
  NOON : "NOON",
  NIGHT : "NIGHT",
  END : "END"
}

/**
 * doPOST
 * POSTリクエストのハンドリング
 */
function doPost(e) {
  var json = JSON.parse(e.postData.contents);
  reply(json);
}

/** 
 * doGet
 * GETリクエストのハンドリング
 */
function doGet(e) {
    return ContentService.createTextOutput("SUCCESS");
}

/** 
 * reply
 * ユーザからのアクションに返信する
 */
function reply(data) {
  // POST情報から必要データを抽出
  var lineUserId = data.events[0].source.userId;
  var postMsg    = data.events[0].message.text;
  var replyToken = data.events[0].replyToken;
  var roomType   = data.events[0].source.type;
  var roomId     = "";

  if(roomType == 'user')
  {
    //個人ラインの場合はroomIdはない
    roomId = "";
  }
  else if(roomType == "room")
  {
    //トークルームの場合はroomIdがある
    roomId = data.events[0].source.roomId;
  }
  else if(roomType == "group")
  {
    //グループの場合はgroupIdがある
    roomId = data.events[0].source.groupId;
  }

  // 記録用に検索語とuserIdを記録
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "");

  // 検索語に対してのアクションをシートから取得
  var actions = findResponseArray(postMsg);

  // 回答の有無に応じて分岐
  if (actions === undefined) {
    //回答がない場合は、グループ内の他の会話だと思うので静かにする。
    debug(postMsg, lineUserId, roomId, MSG_RESERVE, "無反応");
  } else {
    //うまいやり方がわからなかった。mapから取得すると配列で帰ってくるので先頭だけ取得する
    var action = actions[0];

    //コマンドリストを作って、スプレットシートのアクションに対応するようにする
    var functionList = new Array();
    functionList.gameStart = function(postMsg, lineUserId, roomId, replyToken){gameStart(postMsg, lineUserId, roomId, replyToken);}
    functionList.joinGame = function(postMsg, lineUserId, roomId, replyToken){joinGame(postMsg, lineUserId, roomId, replyToken);}
    functionList.completePreparationGame = function(postMsg, lineUserId, roomId, replyToken){completePreparationGame(postMsg, lineUserId, roomId, replyToken);}
    functionList.voting = function(postMsg, lineUserId, roomId, replyToken){voting(postMsg, lineUserId, roomId, replyToken);}
    functionList.killVillager = function(postMsg, lineUserId, roomId, replyToken){killVillager(postMsg, lineUserId, roomId, replyToken);}
    
    //次の行動に応じた関数を実行する
    functionList[action.value](postMsg, lineUserId, roomId, replyToken);
  }
}

//ゲームを開始します
function gameStart(postMsg, lineUserId, roomId, replyToken)
{
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "ゲーム開始");

  //GAMEシートに追加するデータを作る
  var data = [
    1,      //ゲームID
    roomId, //ルームID
    GAME_STATE.WAIT_JOIN  //ステータス  
  ]

  //シートに追加
  setData(SHEET_NAME_GAME, data);

  //LINEに応答を返す
  var replyText = "人狼ゲームを開始します。\r\n参加する方は「参加します」と発言してください。\r\n全員参加したら代表者が「揃いました」と発言してください。";
  sendMessage(replyToken, replyText);
}

//ゲームに参加します
function joinGame(postMsg, lineUserId, roomId, replyToken)
{
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "ゲームに参加");
}

//準備が整ったら狼と村人をランダムに決めます
function completePreparationGame(postMsg, lineUserId, roomId, replyToken)
{
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "ゲーム準備OK");
}

//投票を受け付けます
function voting(postMsg, lineUserId, roomId, replyToken)
{
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "投票");
}

//村人を襲います
function killVillager(postMsg, lineUserId, roomId, replyToken)
{
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "村人を襲う");
}

// SSからヘッダーを除くデータを取得
function getDataWithoutHeader(sheet_name) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheet_name);
  var lastrow = sheet.getLastRow();
  var lastcol = sheet.getLastColumn();
  var data = sheet.getRange(2, 1, lastrow -1, lastcol).getValues();

  return data.map(function(row) { return {key: row[0], value: row[1], type: row[2]}; });
}

//シートから全データをmapで取得
function getData(sheet_name) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheet_name);
  var data = sheet.getDataRange().getValues();

  return data.map(function(row) { return {key: row[0], value: row[1], type: row[2]}; });
}

//シートに1行追加
function setData(sheet_name, data) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheet_name);
  sheet.appendRow(data);
}

// 単語が一致したセルの回答を配列で返す
function findResponseArray(word) {

  return getDataWithoutHeader(SHEET_NAME_COMMAND).map(function(row) {
    // 値が入っているか
    if (row.value) {
      //単語が一致するか
      if (row.key == word){
        return row;
      }
    }
  });
}

// 画像形式でAPI送信
function sendMessageImage(replyToken, imageUrl) {
  // replyするメッセージの定義
  var postData = {
    "replyToken" : replyToken,
    "messages" : [
      {
        "type": "image",
        "originalContentUrl": imageUrl
      }
    ]
  };
  return postMessage(postData);
}

// LINE messaging apiにJSON形式でデータをPOST
function sendMessage(replyToken, replyText) {  
  // replyするメッセージの定義
  var postData = {
    "replyToken" : replyToken,
    "messages" : [
      {
        "type" : "text",
        "text" : replyText
      }
    ]
  };
  return postMessage(postData);
}

// LINE messaging apiにJSON形式で確認をPOST
function sendMayBe(replyToken, mayBeWord) {  
  // replyするメッセージの定義
  var postData = {
    "replyToken" : replyToken,
    "messages" : [
      {
        "type" : "template",
        "altText" : "もしかして検索キーワードは「" + mayBeWord + "」ですか？",
        "template": {
          "type": "confirm",
          "actions": [
            {
                "type":"postback",
                "label":"はい",
                "data":"action=detail",
            },
            {
                "type": "message",
                "label": "いいえ",
                "text": "いいえ、違います。"
            }
          ],
          "text": "答えが見つかりませんでした。もしかして検索キーワードは「" + mayBeWord + "」ですか？"
        }

      }
    ]
  };
  return postMessage(postData);
}

// LINE messaging apiにJSON形式でデータをPOST
function postMessage(postData) {  
  // リクエストヘッダ
  var headers = {
    "Content-Type" : "application/json; charset=UTF-8",
    "Authorization" : "Bearer " + ACCESS_TOKEN
  };
  // POSTオプション作成
  var options = {
    "method" : "POST",
    "headers" : headers,
    "payload" : JSON.stringify(postData)
  };
  return UrlFetchApp.fetch(REPLY, options);      
}

/** ユーザーのアカウント名を取得
 */
function getUserDisplayName(userId) {
  var url = 'https://api.line.me/v2/bot/profile/' + userId;
  var userProfile = UrlFetchApp.fetch(url,{
    'headers': {
      'Authorization' :  'Bearer ' + ACCESS_TOKEN,
    },
  })
  return JSON.parse(userProfile).displayName;
}

// debugシートに値を記載
function debug(text, userId, roomId, msg_flag, action) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('debug');
  var date = new Date();
  var userName = getUserDisplayName(userId);
  var actiontype = msg_flag == MSG_RESERVE ? "受信" : "送信";
  sheet.appendRow([actiontype, userId, userName, roomId, text, Utilities.formatDate( date, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'), action]);
}
