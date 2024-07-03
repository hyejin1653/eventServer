const express = require("express");
const SSE = require("sse");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const { PolyUtil } = require("node-geometry-library");

const connection = require("./modules/db");

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let totalData,
  aisData = [];
let eventInterval;
let startDt,
  endDt,
  speed = 1;

function getDataArr(data) {
  var dataArr = [];
  for (var r = 0; r < data.length; r++) {
    let lng = parseFloat(data[r][0]);
    let lat = parseFloat(data[r][1]);
    dataArr.push({ lat, lng });
  }
  return dataArr;
}

function setTime(baseDt) {
  let tDate = new Date(baseDt);

  tDate.setSeconds(tDate.getSeconds() + Number(speed));

  let year = tDate.getFullYear();
  let month = ("0" + (tDate.getMonth() + 1)).slice(-2);
  let date = ("0" + tDate.getDate()).slice(-2);

  // current hours
  let hours =
    tDate.getHours().toString().length == 1
      ? "0" + tDate.getHours().toString()
      : tDate.getHours();
  // current minutes
  let minutes =
    tDate.getMinutes().toString().length == 1
      ? "0" + tDate.getMinutes().toString()
      : tDate.getMinutes();
  // current seconds
  let seconds =
    tDate.getSeconds().toString().length == 1
      ? "0" + tDate.getSeconds().toString()
      : tDate.getSeconds();

  return (
    year +
    "-" +
    month +
    "-" +
    date +
    " " +
    hours +
    ":" +
    minutes +
    ":" +
    seconds
  );
}

function eventsHandler(request, response, next) {
  const headers = {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  };
  response.writeHead(200, headers);

  let cnt = 0;
  eventInterval = setInterval(() => {
    let resultData = [];
    let sendData = [];
    let aisSend = [];
    let result;
    console.log(totalData.length);
    if (totalData.length > 0) {
      result = totalData.splice(cnt, 10);
      sendData = [];
    }

    //real data

    for (let point of points) {
      console.log(point);
      let box = getDataArr(point.points);

      //real
      for (let r of result) {
        let lat = r.lat;
        let lng = r.lon;
        if (PolyUtil.containsLocation({ lat, lng }, box)) {
          r.areaNm = point.text;
          sendData.push(r);
        }
      }

      //ais data
      if (aisData != undefined && aisData.length > 0) {
        let aisDt = aisData
          .filter((item) => {
            return item.register_dt == startDt;
          })
          .map((data) => {
            return data;
          });

        for (let ais of aisDt) {
          let lat = ais.lat;
          let lng = ais.lon;
          if (PolyUtil.containsLocation({ lat, lng }, box)) {
            ais.areaNm = point.text;
            aisSend.push(ais);
          }
        }
      }
    }

    resultData.push(sendData);
    resultData.push(aisSend);

    let obj = { dateTime: startDt, data: resultData };

    const data = `data: ${JSON.stringify(obj)}\n\n`;

    //console.log(startDt, data);
    response.write(data);
    startDt = setTime(startDt);
    cnt += 10;
  }, 1000);
}

async function selectQuery() {
  var sql = ` SELECT routesign_cd, routesign_nm, real_lat as lat, real_lon as lon, insert_dt
                FROM m03_realtime_routesign
                LIMIT 100000 `;

  return new Promise((resolve, reject) => {
    connection(async (conn) => {
      await conn.query(sql, (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
      conn.release();
    });
  });
}

async function selectAISQuery() {
  console.log(startDt, endDt);
  var sql = ` SELECT bs_id, la AS lat, lo AS lon, 
                        REPLACE(register_dt, '.', '') AS register_dt
                FROM m03_ais_info
                WHERE REPLACE(register_dt, '.', '') between '${startDt}' AND '${endDt}' `;

  return new Promise((resolve, reject) => {
    connection(async (conn) => {
      await conn.query(sql, (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
      conn.release();
    });
  });
}

app.post("/getReplayData", async (req, res, next) => {
  console.log("리플레이 데이터");
  startDt = req.body.startDt;
  endDt = req.body.endDt;
  points = JSON.parse(req.body.points);
  speed = req.body.speed;

  totalData = await selectQuery();
  aisData = await selectAISQuery();

  res.send("OK");
});
app.get("/stopSSE", (req, res, next) => {
  console.log("종료");
  clearInterval(eventInterval);
  eventInterval = null;
  res.send("end");
});
app.get("/events", eventsHandler);

app.listen(9009, () => {
  console.log("connect");
});
