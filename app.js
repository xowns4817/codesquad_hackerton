
var express = require('express');
var session = require('express-session');
var MYSQLStore = require('express-mysql-session')(session);
var bodyParser = require('body-parser');
var mysql = require('mysql');
var app = express();
var AWS = require('aws-sdk');
var ec2 = new AWS.EC2();
var s3 = new AWS.S3();
var formidable = require('formidable');

app.use(bodyParser.urlencoded({ extended: false })); // bodyPaser를 연결시킴
app.use(session({
    secret: '!@#FD@$#A2323aaa@@!@#$%',
    resave: false,
    saveUninitialized: true,
    store:new MYSQLStore({

        host: 'ktjinstance.c4qufde8eeuf.ap-northeast-2.rds.amazonaws.com',
        port: 3306,
        user: '*****',
        password: '******',
        database: 'ktjdb'
    })
}));

//디비 설정
var con = mysql.createConnection({
    host     : 'ktjinstance.c4qufde8eeuf.ap-northeast-2.rds.amazonaws.com',
    user     : '*****',
    password : '*****',
    database : 'ktjdb',
    port     : 3306
   });

   //유저 정보 조회
   app.get('/user', function(req, res){

    var id = req.query.id;
    var sql = "SELECT * FROM user_table WHERE authId = ?";

    con.query(sql, [id], function(err, result){

        console.log(result);
        if(err) {
            console.log(err);
        }
        else {
            res.send(result[0]);
        }
    });
   });

   //유저 추가 -> 처음 인증하는 경우
   app.post('/user', function(req, res) {

    var id = req.body.id;
    var displayName = req.body.displayName;
    var email = req.body.email;
    var position = req.body.position;

    var authId = id;
    var sql = 'SELECT * FROM user_table WHERE authId=?';
    con.query(sql, [authId], function(err, results) {
  
      //사용자가 있다면
      if(results.length > 0)  {
        //추가할 필요없음. 이미 유저 존재
        res.send("이미 존재하는 유저라 추가할 필요 없음")
      } else {
        var newuser = {
          'authId':authId,
          'displayName':displayName,
          'email':email,
          'position':position
        }
  
        //사용자가 없다면 -> 사용자 추가
        var sql = 'INSERT INTO user_table SET ?';
        con.query(sql, newuser, function(err, results){
          if(err) {
            console.log(err);
          }
          else {
           res.send("유저 추가 완료");
          }
        })
      }
    })
   });

   //게시물 전체 보기
   app.get('/board', function(req, res){

    var sql = 'SELECT writerId, title, created, content, place, img, meetingTime FROM user_table, board_table where user_table.id = board_table.writerId order by created DESC';
        con.query(sql, function(err, result, fields) {

            console.log(result);    
            if(err) {
                console.log(err);
            }
            else {

                if(result.length == 0) {
                    res.send("리스트가 없습니다.");
                } else {
                res.send(result);
                }
            }
   });
});

//내가 참가한 게시물들
app.get('/join/:userAuthId', function(req, res){

    var userAuthId = req.params.userAuthId;

    var sql = "select userAuthId, title, boardId, created, content, place, img, meetingTime from participate_table JOIN board_table ON participate_table.userAuthId = board_table.writerId where userAuthId = ?;";
    con.query(sql, [userAuthId], function(err, results){

        if(err) {
            console.log(err);
        }
        else {
            res.status(200).send(results);
        }
    })

});

//게시물 목록 조회 (전체 목록)
app.get('/board', function(req, res) {

    var sql = "SELECT displayName, board_table.id, title, created, board_ meetingTime, place From user_table, board_table where user_table.authId = board_table.writerId";

    con.query(sql, function(err, result, fields){

        if(err) {
            console.log(err);
        }
        else {

            if(result.length == 0) {
                res.status(200).send("리스트가 없습니다.");
            } else {
                res.writeHead(200);
                res.json(result[0]);
            }
        }
    })
})

  //게시물 생성
  app.post('/board', function(req, res) {

    var writerId = req.body.writerId; // 작성자 id
    var title = req.body.title;
    var content = req.body.content;
    var created = new Date();
    var meetingTime = req.body.meetingTime;
    var img;
    var place = req.body.place;

    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files){ // 사용자가 저장한 파일은 files에 담겨있음

        var params = {
            Bucket: 'code-sqaud',
            Key: files.img.name, // s3에 저장될 파일의 이름
            ACL: 'public-read',
            Body: require('fs').createReadStream(files.img.path) // 전송할 파일의 내용
        }

        s3.upload(params, function(err, data) {

            consolg.log(data);
            if(err) console.log(err);
            else  {
               img = data.Location;
            }
        })
    });

    var sql = 'INSERT INTO board_table (writerId, title, content, created, meetingTime, place, img) VALUES(?, ?, ?, ?, ?, ?, ?)';
    con.query(sql, [writerId, title, content, created, meetingTime, place, img], function(err, result, fields) {

        if(err) {
            console.log(err);
            res.status(500).send('Internal Server Error');
        } else{
                
            res.send("게시물 삽입 완료");
        }
    });
  });

  //게시물 수정
  app.put('/board/:boardId', function(req, res){
  
    console.log("put");
    var board_id = req.params.boardId; 

    var title = req.body.title;
    var created = new Date();
    var content = req.body.content;
    var place = req.body.place;
    var img;
    var meetingTime = req.body.meetingTime;

    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files){ // 사용자가 저장한 파일은 files에 담겨있음

        var params = {
            Bucket: 'code-sqaud',
            Key: files.img.name, // s3에 저장될 파일의 이름
            ACL: 'public-read',
            Body: require('fs').createReadStream(files.userfile.path) // 전송할 파일의 내용
        }

        s3.upload(params, function(err, data){

            consolg.log(data);
            if(err) console.log(err);
            else  {
               img = data.Location;
            }
        })
    });

    //작성자 id로 닉네임 받아옴
    var sql = 'UPDATE board_table SET title=?, content=?, place=?, img=?, meetingTime=? WHERE id =?';
    con.query(sql, [title, content, place, img, meetingTime, android, ios, design, front_end, back_end, board_id], function(err, results, fields){
        if(err) {
            console.log(err);
            res.status(500).send('Internal Server Error');
        } else{
           res.send("수정 완료");
        }
    });
  });

  //게시물 삭제
  app.delete('/board/:boardId', function(req, res){

    var board_id = req.params.board_id;


    var sql = 'DELETE FROM board_table where id=?';

    con.query(sql, [board_id], function(err,results, fields){

        if(err) {
            console.log(err);
        }
        else {
            res.send("게시물 삭제");
        }
    });
  });

  //게시물에 참가함
app.post('/join/:boardId/:positionId', function(req, res) {

    var writer_id = req.body.userAuthId;
    var board_id = req.params.boardId;
    var position_id = req.params.positionId;

    var sql = "INSERT INTO participate_table(userAuthId, boardId, positionId) values (?, ?, ?)";
    con.query(sql, [writer_id, board_id, position_id], function(err, results, fields){

        if(err) {
            console.log(err);
        }
        else {
            res.status(200).send("참가 완료");
        }
});
});
 
//게시물에 참가한 각 파트별 인원
app.get('/participate/count/:boardId/', function(req, res){

    var boardId = parseInt(req.params.boardId;);
    var android, ios, design, frontEnd, backEnd;

    android = ios = design = frontEnd = backEnd = 0; // 각 파트별 인원

    var sql = "SELECT * from participate_table where boardId=?";
    con.query(sql, [boardId], function(err, results, fields){
        
        if(err) {
            console.log(err);
        }
        else {

            for(var i=0; i<results.length; i++) {
                if(results[i].positionId === 1) android++;
                if(results[i].positionId === 2) ios++;
                if(results[i].positionId === 3) design++;
                if(results[i].positionId === 4) frontEnd++;
                if(results[i].positionId === 5) backEnd++;
            }
            
            var part_result = [];
            part_result.push({android: android});
            part_result.push({ios: ios});
            part_result.push({design: design});
            part_result.push( {frontEnd: frontEnd});
            part_result.push({backEnd: backEnd});

           res.send(JSON.stringify({count :part_result}));
        }
    });
});

//게시물에 참가한 각 파트별 닉네임
app.get('/participate/name/:boardId', function(req, res){

    var boardId = parseInt(req.params.boardId);
    var android = [ ];
    var ios = [ ];
    var design = [ ];
    var frontEnd = [ ];
    var backEnd = [ ];
    var name_result = [ ];

     var sql = "SELECT user_table.displayName, participate_table.boardId, participate_table.positionId from user_table JOIN participate_table ON user_table.id = participate_table.userId";
        con.query(sql, [ ], function(err, results, fields){

            for(var i=0; i<results.length; i++) {

             if(results[i].boardId === boardId) { // android

                 if(results[i].positionId === 1) {
                     android.push(results[i].displayName);
                 }
                 else if(results[i].positionId === 2){ // ios
                    ios.push(results[i].displayName);
                 }
                 else if(results[i].positionId === 3){ // design
                    design.push(results[i].displayName);
                 }
                 else if(results[i].positionId === 4){ // frontEnd
                    frontEnd.push(results[i].displayName);
                 }
                 else if(results[i].positionId === 5){ // backEnd
                    backEnd.push(results[i].displayName);
                 }
                }
            } 

            name_result.push({android: android});
            name_result.push({ios: ios});
            name_result.push({design: design});
            name_result.push({frontEnd: frontEnd});
            name_result.push({backEnd: backEnd});
        
            res.send(JSON.stringify({nickName :name_result}));
         });    
})

app.listen(80, function() {
    console.log('Connected 80 port');
});

