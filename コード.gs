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
  var action = findResponseArray(postMsg);

  // 回答の有無に応じて分岐
  if (action === undefined) {
    //回答がない場合は、グループ内の他の会話だと思うので静かにする。
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
  } else {
    //次のアクションがある場合

    //コマンドリストを作って、スプレットシートのアクションに対応するようにする
    var functionList = new Array();
    functionList.gameStart = function(postMsg, lineUserId, roomId, replyToken){gameStart(postMsg, lineUserId, roomId, replyToken);}
    functionList.joinGame = function(postMsg, lineUserId, roomId, replyToken){joinGame(postMsg, lineUserId, roomId, replyToken);}
    functionList.completePreparationGame = function(postMsg, lineUserId, roomId, replyToken){completePreparationGame(postMsg, lineUserId, roomId, replyToken);}
    functionList.voting = function(postMsg, lineUserId, roomId, replyToken){voting(postMsg, lineUserId, roomId, replyToken);}
    functionList.killVillager = function(postMsg, lineUserId, roomId, replyToken){killVillager(postMsg, lineUserId, roomId, replyToken);}
    functionList.gameEnd = function(postMsg, lineUserId, roomId, replyToken){gameEnd(postMsg, lineUserId, roomId, replyToken);}

    //次の行動に応じた関数を実行する
    functionList[action.value](postMsg, lineUserId, roomId, replyToken);
  }
}

//ゲームを開始します
function gameStart(postMsg, lineUserId, roomId, replyToken)
{
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "ゲーム開始");
  
  //実行中のゲームがあるか確認
  if(getNowPlayGameId(roomId) !== undefined)
  {
    //実行中のゲームがあるので通知して終了するか確認する
    var replyText = "実行中のゲームがあります。終了する場合は「ゲームを終了します」と発言してください";
    //メッセージ送信
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    //処理終了
    return null;
  }

  //最大値を取得して追加するので一旦ロックする
  var lock = LockService.getDocumentLock();
  try {
    //ロックを実施する
    lock.waitLock(5000);
   
    //ゲームIDの現在の最大値を取得
    var gameIdMax = maxValueGet(SHEET_NAME_GAME, 1);

    //GAMEシートに追加するデータを作る
    var data = [
      Number(gameIdMax) + 1,      //ゲームID
      roomId,             //ルームID
      GAME_STATE.WAIT_JOIN  //ステータス  
    ]

    //シートに追加
    setData(SHEET_NAME_GAME, data);

    //LINEに応答を返す
    var replyText = "人狼ゲームを開始します。\r\n参加する方は「参加します」と発言してください。\r\n全員参加したら代表者が「揃いました」と発言してください。";
    sendMessage(replyToken, replyText); 
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);
    setGameState(gameId, GAME_STATE.WAIT_JOIN);
  } catch (e) {
    var replyText = "システムエラーのためゲームを開始できませんでした。";
    sendMessage(replyToken, replyText); 
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);
    throw e;
  }　finally　{
    //ロックを開放する
    lock.releaseLock();
  }
}

//実行中のゲームを終了する
function gameEnd(postMsg, lineUserId, roomId, replyToken)
{
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "ゲーム終了");

  //現在のゲームIDを取得する
  var gameId = getNowPlayGameId(roomId);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    var replyText = "ゲームが開始されていません";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);
  }

  //終了する
  setGameState(gameId, GAME_STATE.END);

  var replyText = "ゲームを終了しました。";
  sendMessage(replyToken, replyText); 
  debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);
}

//ゲームに参加します
function joinGame(postMsg, lineUserId, roomId, replyToken)
{
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "ゲームに参加");

  //現在のゲームIDを取得する
  var gameId = getNowPlayGameId(roomId);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return;
  }

  //参加状態を確認する
  if(getUser(gameId, lineUserId) !== undefined)
  {
    //参加済みの場合
    var userName = getUserDisplayName(lineUserId);
    var replyText = userName + " さんは参加済みです。";
    sendMessage(replyToken, replyText); 
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    //処理終了
    return;
  }
  
  //userシートに追加するデータを作る
  var data = [
    gameId,     //ゲームID
    lineUserId, //ユーザID
    "",         //狼or村人
    "",         //投票内容
    "ALIVE"     //状態
  ]

  //シートに追加
  setData(SHEET_NAME_USER, data);

  var userName = getUserDisplayName(lineUserId);
  var replyText = userName + " さんの参加を受け付けました。";
  sendMessage(replyToken, replyText);
  debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);
}

//準備が整ったら狼と村人をランダムに決めます
function completePreparationGame(postMsg, lineUserId, roomId, replyToken)
{
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "ゲーム準備OK");

  //現在のゲームIDを取得する
  var gameId = getNowPlayGameId(roomId);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return;
  }

  //参加しているユーザを取得
  var users = getUsers(gameId);
  var users_count = users.length;

  //ランダムに狼さんを決める
  //
  //乱数の範囲の決め方
  // Math.random() * ( 最大値 - 最小値 ) + 最小値;
  wolf_index = Math.round(Math.random() * ( users_count - 1 ));

  //役割を設定しながら通知する
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_USER);
  users.forEach( function(user, index){
    if(index == wolf_index)
    {
      //狼の場合
      // rowは0始まり。getRangeは1始まり。
      sheet.getRange(user.row + 1, 3, 1, 1).setValue("狼");
      pushMessage(lineUserId, "あなたは狼になりました。")
    }
    else{
      //村人の場合
      // rowは0始まり。getRangeは1始まり。
      sheet.getRange(user.row + 1, 3, 1, 1).setValue("村人");
      pushMessage(lineUserId, "あなたは村人になりました。")
    }
  });

  //通知が終わったので昼にしてゲームを開始する
  setGameState(gameId, GAME_STATE.NOON);
  var replyText = "ゲームを開始します。";
  sendMessage(replyToken, replyText);
  var replyText = "昼になりました。狼を探しましょう。\r\n狼を決めたら「〇〇に投票します」と発言してください。";
  sendMessage(replyToken, replyText);
  debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);
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

//ゲームの状態を変更します
function setGameState(gameId, state)
{
  var gameIds = getDataColunm(SHEET_NAME_GAME, 1);

  //変更対象の行数を取得します
  var rowidx = gameIds.indexOf(gameId);

  if(rowidx < 0)
  {
    throw "システムエラー。指定したゲームIDが存在しない。gameId:" + gameId
  }
  
  //値をセットします
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_GAME);

  //indexOfは0始まりだが、指定するのは1始まり
  //そして、ヘッダ行があるのでさらにプラス1。
  sheet.getRange(rowidx+2, 3, 1, 1).setValue(state);
}

//自分のデータを取得する
function getUser(gameId, lineUserId) {
  return getUsers(gameId).find(user => user.userId == lineUserId);
}

// 参加中のユーザ一覧を取得する
function getUsers(gameId) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_USER);
  var data = sheet.getDataRange().getValues().map(function(row, index) { return {
    gameId: row[0],
    userId: row[1],
    role : row[2]	,
    vote : row[3],
    state : row[4],
    row : index
    };
  });

  return data.filter((user) => user.gameId === gameId);
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

//シートから1行Arrayで取得
function getDataColunm(sheet_name, column) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheet_name);

  //ヘッダ行を除く2行目から指定列の全データを取得する
  return sheet.getRange(2, column, sheet.getLastRow()).getValues().flat();
}

//特定列の最大値を取得
function maxValueGet(sheet_name, column)
{
  //データ取得
  var data = getDataColunm(sheet_name, column);

  //降順にソート
  var arraySortedDesc = data.sort(function(a,b){return b-a});

  //最大値を返却
  return arraySortedDesc[0];
}

//シートに1行追加
function setData(sheet_name, data) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheet_name);
  sheet.appendRow(data);
}

//ルームが現在プレイ中のgameIdを取得する
function getNowPlayGameId(roomId)
{
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_GAME);
  var data = sheet.getDataRange().getValues();

  var datamap = data.map(function(row) { return {gameId: row[0], roomId: row[1], status: row[2]}; });

  //終了していないゲームを取得する
  var gamerow = datamap.filter((row) => row.roomId == roomId && row.status != GAME_STATE.END);

  //もしも2つ以上あればおかしい
  if(gamerow.length > 1)
  {
    throw "システムエラーです。１つのルームに2つ以上のゲームが実行中です。roomId:" + roomId;
  }

  //もしも存在しなければ
  if(gamerow.length == 0)
  {
    return undefined;
  }

  return gamerow[0].gameId;
}

// 単語が一致したセルの回答を配列で返す
function findResponseArray(word) {

  var reg = new RegExp('^' + word + '$');
  var commandlist = getDataWithoutHeader(SHEET_NAME_COMMAND);
  return commandlist.find(command => reg.test(command.key));
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

function pushMessage(lineUserId, message) {  
  // リクエストヘッダ
  var headers = {
    "Content-Type" : "application/json; charset=UTF-8",
    "Authorization" : "Bearer " + ACCESS_TOKEN
  };
  // POSTオプション作成
  var options = {
    "method" : "POST",
    "headers" : headers,
    "payload" : JSON.stringify({
      "to": lineUserId,
      "messages":[
        {
          "type":"text",
          "text":message
        }
    ]})
  };

  return UrlFetchApp.fetch(PUSH, options);
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
