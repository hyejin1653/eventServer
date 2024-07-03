const mysql = require("mysql");
var iniparser = require("iniparser");
var config = iniparser.parseSync("./config.ini");

let configSet = {
  host: config.MYSQL.server,
  port: config.MYSQL.port,
  user: config.MYSQL.user,
  password: config.MYSQL.password, //gc8932 - 118서버
  database: config.MYSQL.database,
  multipleStatements: true, // 다중 쿼리 실행 옵션 활성화
};

//console.log(configSet)

//pool객체 생성
const pool = mysql.createPool(configSet);

//console.log(pool)

//pool에서 connection을 얻기
function getConnection(callback) {
  pool.getConnection(function (err, conn) {
    if (!err) {
      callback(conn);
    } else {
      console.log(err);
    }
  });
}

module.exports = getConnection;
