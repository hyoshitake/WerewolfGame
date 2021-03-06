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

function test()
{
  isAliveWolf("a", "a", "U1c98ac328ef63b46e2eb7c4a08260b1d", "", "");
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
    functionList.gameStart = function(key, postMsg, lineUserId, roomId, replyToken){gameStart(key, postMsg, lineUserId, roomId, replyToken);}
    functionList.gameEnd = function(key, postMsg, lineUserId, roomId, replyToken){gameEnd(key, postMsg, lineUserId, roomId, replyToken);}
    functionList.joinGame = function(key, postMsg, lineUserId, roomId, replyToken){joinGame(key, postMsg, lineUserId, roomId, replyToken);}
    functionList.completePreparationGame = function(key, postMsg, lineUserId, roomId, replyToken){completePreparationGame(key, postMsg, lineUserId, roomId, replyToken);}
    functionList.killVillager = function(key, postMsg, lineUserId, roomId, replyToken){
      //村人を殺す
      killVillager(key, postMsg, lineUserId, roomId, replyToken);

      //生存村人数を数える
      if(countAliveVillager(key, postMsg, lineUserId, roomId, replyToken) <= 1)
      {
        //一人しか村人が残っていないので狼勝利
        winWolf(key, postMsg, lineUserId, roomId, replyToken)
      }else{
        //まだ村人が生き残っているので昼になる
        goToNoon(key, postMsg, lineUserId, roomId, replyToken)
      }
    }
    functionList.voting = function(key, postMsg, lineUserId, roomId, replyToken){

      //投票する
      if(!voting(key, postMsg, lineUserId, roomId, replyToken))
      {
        //投票失敗
        return false;
      }
      
      //全員投票したのか確認する
      if(!isAllVote(key, postMsg, lineUserId, roomId, replyToken))
      {
        //全員投票していない
        return false;
      }

      //全員投票したので処刑する
      killfromVillager(key, postMsg, lineUserId, roomId, replyToken);

      //狼さんの生存状態を確認する
      if(isAliveWolf(key, postMsg, lineUserId, roomId, replyToken))
      {
        //生きているので、夜になって狼さんが行動します
        goToNight(key, postMsg, lineUserId, roomId, replyToken)
      }else{
        //たおした。村人の勝利
        winVillager(key, postMsg, lineUserId, roomId, replyToken)
      }
      
    }

    functionList.abstention = function(key, postMsg, lineUserId, roomId, replyToken){

      //投票する
      if(!abstention(key, postMsg, lineUserId, roomId, replyToken))
      {
        //投票失敗
        return false;
      }
      
      //全員投票したのか確認する
      if(!isAllVote(key, postMsg, lineUserId, roomId, replyToken))
      {
        //全員投票していない
        return false;
      }

      //全員投票したので処刑する
      killfromVillager(key, postMsg, lineUserId, roomId, replyToken);

      //狼さんの生存状態を確認する
      if(isAliveWolf(key, postMsg, lineUserId, roomId, replyToken))
      {
        //生きているので、夜になって狼さんが行動します
        goToNight(key, postMsg, lineUserId, roomId, replyToken)
      }else{
        //たおした。村人の勝利
        winVillager(key, postMsg, lineUserId, roomId, replyToken)
      }
      
    }

    //次の行動に応じた関数を実行する
    functionList[action.value](action.key, postMsg, lineUserId, roomId, replyToken);
  }
}

//夜にします。
function goToNight(key, postMsg, lineUserId, roomId, replyToken)
{
    //現在のゲームIDを取得する
  var gameId = getNowPlayGameIdByUserId(lineUserId, null);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return false;
  }

  var replyText = "夜になりました。\r\n狼は「〇〇を殺します」と個別ラインで発言してください。";
  var pushRoomId = getGameRoomId(gameId);
  debug(postMsg, lineUserId, pushRoomId, MSG_SEND, replyText);
  pushMessage(pushRoomId, replyText);

  //夜にします
  setGameState(gameId, GAME_STATE.NIGHT);
}

//昼にします。
function goToNoon(key, postMsg, lineUserId, roomId, replyToken)
{
    //現在のゲームIDを取得する
  var gameId = getNowPlayGameIdByUserId(lineUserId, null);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return false;
  }

  var replyText = "昼になりました。狼を探しましょう。\r\n狼を決めたら「〇〇に投票します」と個別トークで発言してください。\r\n棄権する場合は「棄権します」と個別トークで発言してください";
  var pushRoomId = getGameRoomId(gameId);
  debug(postMsg, lineUserId, pushRoomId, MSG_SEND, replyText);
  pushMessage(pushRoomId, replyText);

  //昼にします
  setGameState(gameId, GAME_STATE.NOON);
}

//村人勝利
function winVillager(key, postMsg, lineUserId, roomId, replyToken)
{
  //現在のゲームIDを取得する
  var gameId = getNowPlayGameIdByUserId(lineUserId, null);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return false;
  }

  var replyText = "狼を倒しました。村人の勝利です！";
  var pushRoomId = getGameRoomId(gameId);
  debug(postMsg, lineUserId, pushRoomId, MSG_SEND, replyText);
  pushMessage(pushRoomId, replyText);

  //ゲームを終了する
  setGameState(gameId, GAME_STATE.END);
}

//狼勝利
function winWolf(key, postMsg, lineUserId, roomId, replyToken)
{
  //現在のゲームIDを取得する
  var gameId = getNowPlayGameIdByUserId(lineUserId, null);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return false;
  }

  var replyText = "村人を追い詰めました。狼の勝利です！";
  var pushRoomId = getGameRoomId(gameId);
  debug(postMsg, lineUserId, pushRoomId, MSG_SEND, replyText);
  pushMessage(pushRoomId, replyText);

  //ゲームを終了する
  setGameState(gameId, GAME_STATE.END);
}

//生存している村人数を数える
function countAliveVillager(key, postMsg, lineUserId, roomId, replyToken)
{
  //現在のゲームIDを取得する
  var gameId = getNowPlayGameIdByUserId(lineUserId, null);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return;
  }

  //user情報を取得する
  var users = getUsers(gameId);

  //狼の状態取得して確認する
  return users.filter(user => user.role == "村人" && user.state == "ALIVE").length
}


//ゲームを開始します
function gameStart(key, postMsg, lineUserId, roomId, replyToken)
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
function gameEnd(key, postMsg, lineUserId, roomId, replyToken)
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
function joinGame(key, postMsg, lineUserId, roomId, replyToken)
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
  var state = getGameState(gameId);
  if(getGameState(gameId) != GAME_STATE.WAIT_JOIN)
  {
    sendMessage(replyToken, "途中参加はできません。"); 
    debug(postMsg, lineUserId, roomId, MSG_SEND, "途中参加はできません。");
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
function completePreparationGame(key, postMsg, lineUserId, roomId, replyToken)
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

  //状態が参加町ではない場合
  if(getGameState(gameId) != GAME_STATE.WAIT_JOIN)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return;
  }

  //参加しているユーザを取得
  var users = getUsers(gameId);
  var users_count = users.length;

  //5人集まっていないときはエラーをだす
  if(users_count < 5)
  {
    var replyText = "ゲームを開始するには5人以上集まる必要があります。";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);
    return;
  }

  //ランダムに狼さんを決める
  //
  //乱数の範囲の決め方
  // Math.random() * ( 最大値 - 最小値 ) + 最小値;
  var wolf_index = Math.round(Math.random() * ( users_count - 1 ));

  //役割を設定しながら通知する
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_USER);
  users.forEach( function(user, index){
    if(index == wolf_index)
    {
      //狼の場合
      // rowは0始まり。getRangeは1始まり。
      sheet.getRange(user.row + 1, 3, 1, 1).setValue("狼");
      pushMessage(lineUserId, "あなたは人狼に選ばれました")
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
  var replyText = "ゲームを開始します。\r\n昼になりました。狼を探しましょう。\r\n狼を決めたら「〇〇に投票します」と個別トークで発言してください。\r\n棄権する場合は「棄権します」と個別トークで発言してください";
  sendMessage(replyToken, replyText);
  debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);
}

//投票を受け付けます
function voting(key, postMsg, lineUserId, roomId, replyToken)
{
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "投票");

  //現在のゲームIDを取得する
  var gameId = getNowPlayGameIdByUserId(lineUserId, GAME_STATE.NOON);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return false;
  }

  //状態が昼ではない場合
  if(getGameState(gameId) != GAME_STATE.NOON)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return false;
  }

  //個別トークではない場合
  if(roomId != "")
  {
    var replyText = "投票は個別トークで受け付けます。";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);
    return false;
  }


  //スプレットシートのデータ取得は遅いらしいので、1回で済ませる
  //ユーザ一覧を取得する
  var users = getUsers(gameId);

  //投票対象者名を取得する
  var reg = new RegExp(key)
  var hitarray = reg.exec(postMsg);

  //もしも部分一致がなかったら
  if(hitarray.length < 2){
    throw "システムエラー。投票コマンドに部分一致がありません。key：" + key;
  }

  //処刑する人を取得する
  var killUserName = hitarray[1]; //正規表現の部分一致にヒットすること。

  //処刑する人が存在するか確認する
  var killuser = users.find(user => killUserName == getUserDisplayName(user.userId));
  if(killuser === undefined)
  {
    var replyText = killUserName + " は参加していません";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    //処理終了
    return false;
  }

  //投票者のデータを取得する
  var voteuser = users.find(user => user.userId == lineUserId);

  //投票済みだったらエラーを出す
  if(voteuser.vote != "")
  {
    var replyText = getUserDisplayName(lineUserId) + " は 投票済みです。";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    return false;
  }

  //狼は投票できません
  if(voteuser.role == "狼")
  {
    var replyText = "狼は投票できません。夜になるまで静かにしましょう";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    return false;
  }

  //自分自身には投票できない
  if(voteuser.userId == killuser.userId)
  {
    var replyText = "自分自身には投票できません。";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    return false;
  }

  //死んだ人にも投票できない
  if(killuser.state != "ALIVE")
  {
    var replyText = getUserDisplayName(killuser.userId) + " はすでに死亡しています。";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    return false;
  }

  //投票する
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_USER);
  sheet.getRange(voteuser.row + 1, 4, 1, 1).setValue(killuser.userId);

  var replyText = getUserDisplayName(lineUserId) + " は " + killUserName + " に投票しました";
  sendMessage(replyToken, replyText);
  debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

  return true;
}

function abstention(key, postMsg, lineUserId, roomId, replyToken)
{
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "棄権投票");

  //現在のゲームIDを取得する
  var gameId = getNowPlayGameIdByUserId(lineUserId, GAME_STATE.NOON);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return false;
  }

  //状態が昼ではない場合
  if(getGameState(gameId) != GAME_STATE.NOON)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return false;
  }

  //個別トークではない場合
  if(roomId != "")
  {
    var replyText = "投票は個別トークで受け付けます。";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);
    return false;
  }

  //投票者のデータを取得する
  var users = getUsers(gameId);
  var voteuser = users.find(user => user.userId == lineUserId);

  //投票済みだったらエラーを出す
  if(voteuser.vote != "")
  {
    var replyText = getUserDisplayName(lineUserId) + " は 投票済みです。";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    return false;
  }

  //狼は投票できません
  if(voteuser.role == "狼")
  {
    var replyText = "狼は投票できません。夜になるまで静かにしましょう";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    return false;
  }

  //投票する
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_USER);
  sheet.getRange(voteuser.row + 1, 4, 1, 1).setValue("棄権");

  var replyText = getUserDisplayName(lineUserId) + " は棄権しました";
  sendMessage(replyToken, replyText);
  debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

  return true;
}

//全員投票したのか確認する
function isAllVote(key, postMsg, lineUserId, roomId, replyToken)
{
  //現在のゲームIDを取得する
  var gameId = getNowPlayGameIdByUserId(lineUserId, GAME_STATE.NOON);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return false;
  }

  //状態が昼ではない場合
  if(getGameState(gameId) != GAME_STATE.NOON)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return false;
  }

  //ユーザ一覧を取得する
  var users = getUsers(gameId);

  //他の人は全員投票したのか確認する
  if(users.filter(user => user.vote == "" && user.role != "狼" && user.state == "ALIVE").length > 0)
  {
    //まだ投票していない人がいるので何もしない
    return false;
  }

  //全員投票していたらプッシュ通知をする
  var pushRoomId = getGameRoomId(gameId);
  debug(postMsg, lineUserId, pushRoomId, MSG_SEND, "全員の投票が完了しました");
  pushMessage(pushRoomId, "全員の投票が完了しました");

  return true;
}

//村人が処刑する
function killfromVillager(key, postMsg, lineUserId, roomId, replyToken)
{
  //現在のゲームIDを取得する
  var gameId = getNowPlayGameIdByUserId(lineUserId, GAME_STATE.NOON);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return;
  }

  //状態が昼ではない場合
  var gamestate = getGameState(gameId);
  if(gamestate != GAME_STATE.NOON)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return;
  }

  //ユーザ一覧を取得する
  var users = getUsers(gameId);

  var vote_values = users.reduce((accumulator, user) => {
    //生きている村人の投票を集計する
    if(user.state == "ALIVE" && user.role != "狼")
    {
      accumulator.push(user.vote);
    }
    return accumulator;
  }, []);

  //最も出現回数が多い人が殺される
  var killuserId = mode(vote_values);

  if(killuserId === undefined){
    var message = "棄権者が多いか、最多得点者が複数名いたため処刑されませんでした";
    var pushRoomId = getGameRoomId(gameId);
    debug(postMsg, lineUserId, pushRoomId, MSG_SEND, message);
    pushMessage(pushRoomId, message);

    return;
  }

  var message = getUserDisplayName(killuserId) + " が処刑されました";
  var pushRoomId = getGameRoomId(gameId);
  debug(postMsg, lineUserId, pushRoomId, MSG_SEND, message);
  pushMessage(pushRoomId, message);

  //処刑する
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_USER);
  var killuser = users.find(user => user.userId == killuserId);
  sheet.getRange(killuser.row + 1, 5, 1, 1).setValue("DEATH");
}

//狼が処刑されていないか確認する
function isAliveWolf(key, postMsg, lineUserId, roomId, replyToken)
{
  //現在のゲームIDを取得する
  var gameId = getNowPlayGameIdByUserId(lineUserId, null);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return;
  }

  //user情報を取得する
  var users = getUsers(gameId);

  //狼の状態取得して確認する
  if(users.find(user => user.role == "狼").state == "ALIVE")
  {
    return true;
  }else{
    return false;
  }
}

//村人を襲います
function killVillager(key, postMsg, lineUserId, roomId, replyToken)
{
  debug(postMsg, lineUserId, roomId, MSG_RESERVE, "村人を襲う");

  //現在のゲームIDを取得する
  var gameId = getNowPlayGameIdByUserId(lineUserId, GAME_STATE.NIGHT);

  //ゲームの状態を確認する
  if(gameId === undefined)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return;
  }

  //状態が夜ではない場合
  var gamestate = getGameState(gameId);
  if(gamestate != GAME_STATE.NIGHT)
  {
    debug(postMsg, lineUserId, roomId, MSG_SEND, "無反応");
    return;
  }

  //個別トークではない場合
  if(roomId != "")
  {
    var replyText = "投票は個別トークで受け付けます。";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);
    return false;
  }

  //ユーザ一覧を取得する
  var users = getUsers(gameId);

  //投票者のデータを取得する
  var voteuser = users.find(user => user.userId == lineUserId);

  //投票済みだったらエラーを出す
  if(voteuser.vote != "")
  {
    //連続で書き込んだ場合など。処理をしない。
    return false;
  }

  //狼ではない場合
  if(voteuser.role != "狼")
  {
    var replyText = getUserDisplayName(lineUserId) + " は狼ではありません。";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    //処理終了
    return false;
  }

  //投票対象者名を取得する
  var reg = new RegExp(key)
  var hitarray = reg.exec(postMsg);

  //もしも部分一致がなかったら
  if(hitarray.length < 2){
    throw "システムエラー。投票コマンドに部分一致がありません。key：" + key;
  }

  //処刑する人を取得する
  var killUserName = hitarray[1]; //正規表現の部分一致にヒットすること。

  //処刑する人が存在するか確認する
  var killuser = users.find(user => killUserName == getUserDisplayName(user.userId));
  if(killuser === undefined)
  {
    var replyText = killuserName + " は参加していません";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    //処理終了
    return false;
  }

    //自分自身には投票できない
  if(voteuser.userId == killuser.userId)
  {
    var replyText = "自分自身には殺せません";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    return false;
  }

  //死んだ人にも投票できない
  if(killuser.state != "ALIVE")
  {
    var replyText = getUserDisplayName(killuser.userId) + " はすでに死亡しています。";
    sendMessage(replyToken, replyText);
    debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

    return false;
  }

  var replyText = getUserDisplayName(lineUserId) + " は " + killUserName + " を食べます";
  sendMessage(replyToken, replyText);
  debug(postMsg, lineUserId, roomId, MSG_SEND, replyText);

  //メッセージを返す
  var message = getUserDisplayName(killuser.userId) + " が食べられました";
  var pushRoomId = getGameRoomId(gameId);
  debug(postMsg, lineUserId, pushRoomId, MSG_SEND, message);
  pushMessage(pushRoomId, message);

  //処刑する
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_USER);
  sheet.getRange(killuser.row + 1, 5, 1, 1).setValue("DEATH");

  //昼にする
  setGameState(gameId, GAME_STATE.NOON);

  //投票を初期化する
  users.forEach(function(user){
    sheet.getRange(user.row + 1, 4, 1, 1).clear();
  });
}

//ゲームの状態を取得します
function getGameState(gameId)
{
  //gameIdが一致する行を検索する
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_GAME);
  var gamerow = sheet.getDataRange().getValues().filter(row => row[0] == gameId).flat();

  //見つからない場合
  if(gamerow === undefined)
  {
    throw "システムエラー。指定したゲームIDが存在しない。gameId:" + gameId
  }
  
  //状態を返答します
  return gamerow[2];
}

//ゲームのroomIdを返します
function getGameRoomId(gameId)
{
  //gameIdが一致する行を検索する
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_GAME);
  var gamerow = sheet.getDataRange().getValues().filter(row => row[0] == gameId).flat();

  //見つからない場合
  if(gamerow === undefined)
  {
    throw "システムエラー。指定したゲームIDが存在しない。gameId:" + gameId
  }
  
  //roomidを返答します
  return gamerow[1];
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

//ユーザIDから今参加しているゲームのIDを返答する
function getNowPlayGameIdByUserId(lineUserId, state)
{
  var gamesheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_GAME);
  var gamedata = gamesheet.getDataRange().getValues();  
  var usersheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME_USER);
  var userdata = usersheet.getDataRange().getValues();

  //自分がのデータを探す
  var alivegamelist = userdata.filter(user => user[1] == lineUserId);

  //自分が生きているゲームで進行中のものがあるか確認する
  var userhitdata = undefined;
  if(state == null)
  {
    //終わっていないものを探す
    userhitdata = alivegamelist.find(user => getGameState(user[0]) != GAME_STATE.END);
  }else{
    //指定した状態のものを探す
    userhitdata = alivegamelist.find(user => getGameState(user[0]) == state);
  }
  
  if(userhitdata === undefined)
  {
    //見つからなかった ->　今は参加していない
    return undefined;
  }else{
    //gameIdを返す
    return userhitdata[0];
  }
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

  var commandlist = getDataWithoutHeader(SHEET_NAME_COMMAND);
  return commandlist.find(function(command){
    var reg = new RegExp('^' + command.key + '$');
    return reg.test(word);
  });
}

//最頻値を求める
function mode(list)
{
  //配列ではない場合
  if(Object.prototype.toString.call(list) !== '[object Array]')
  {
    return undefined;
  }

  //配列の個数が0個の時
  if (list.length === 0){
    return undefined;
  }

  var counter = list.reduce(function(prev, current) {
    prev[current] = (prev[current] || 0) + 1;
    return prev;
  }, {});

  //多い順に並べ替え
  let counter_map = Object.keys(counter).map((e)=>({ key: e, value: counter[e] }));
  counter_map.sort(function(a,b){
    if(a.value < b.value) return 1;
    if(a.value > b.value) return -1;
    return 0;
  });

  //人狼用の処理を入れとく
  //1番と2番が同じだった場合は処刑しない -> undefinedにする。
  //  -> 仕様書「得票数最多のプレイヤーが複数⼈いる場合は、誰も処刑されない。」
  //  -> 仕様書「あるいは棄権と特定プレイヤーが同数で最多得票の場合も、誰も処刑されない。」
  if(counter_map.length > 1)
  {
    if(counter_map[0].value == counter_map[1].value)
    {
      return undefined;
    }
  }

  //棄権が最も多ければ何もしない
  //  -> 仕様書「棄権が最多得票の場合、(中略)誰も処刑されない。」
  if(counter_map[0].key == "棄権")
  {
    return undefined;
  }

  return counter_map[0].key;
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
