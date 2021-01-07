const { 
    mongouri,
    rest_application_ID,
    bootpay_private_key
 } = require('./config.json');
const RestClient = require('@bootpay/server-rest-client').RestClient;
const axios = require('axios');

// 1. mongoose 모듈 가져오기
const mongoose = require('mongoose');
// 2. testDB 세팅
mongoose.connect(mongouri);
// 3. 연결된 testDB 사용
const db = mongoose.connection;
// 4. 연결 실패
db.on('error', function(){
    console.log('Connection Failed!');
});
// 5. 연결 성공
db.once('open', function() {
    console.log('Connected!');
});

// 6. Schema 생성. (혹시 스키마에 대한 개념이 없다면, 입력될 데이터의 타입이 정의된 DB 설계도 라고 생각하면 됩니다.)
const user = mongoose.Schema({
    bot_id: String,
    userid: String,
    usercode: String,
    username: String,
    guild_id: String,
    guild_name: String,
    start_date: Date,
    end_date: Date,
    trial: Boolean,
    enable: Boolean,
    billing_info: Array,
    channels: Array
});

// 7. 정의된 스키마를 객체처럼 사용할 수 있도록 model() 함수로 컴파일
const User = mongoose.model('user', user);
const billing_day = 1;

Date.prototype.yyyymmdd = function() {
    var mm = this.getMonth() + 1;
    var dd = this.getDate();
  
    return [this.getFullYear(),
            (mm>9 ? '' : '0') + mm,
            (dd>9 ? '' : '0') + dd
           ].join('');
};
Date.prototype.hhmmss = function() {
    var hh = this.getHours();
    var mm = this.getMinutes();
    var ss = this.getSeconds();
  
    return [(hh>9 ? '' : '0') + hh,
            (mm>9 ? '' : '0') + mm,
            (ss>9 ? '' : '0') + ss,
           ].join('');
};
Date.prototype.yyyymmddhhmmss = function() {
    return this.yyyymmdd() + this.hhmmss();
};  

const task = ()=>{
    const now = new Date();
    RestClient.setConfig(
        rest_application_ID,
        bootpay_private_key
    );

    if(true || now.getDate() === billing_day){

        RestClient.getAccessToken().then(function (response) {
            if (response.status === 200) {
                const { token } = response.data;

                User.find({enable: true},(err, userList)=>{

                    userList.forEach((data)=>{
                        const { billing_info, bot_id, userid } = data;
                        const order_id = `${bot_id}-${userid}-${now.yyyymmddhhmmss()}`;

                        RestClient.requestSubscribeBillingPayment({
                            billingKey: billing_info[0], // 빌링키
                            itemName: billing_info[1], // 정기결제 아이템명
                            price: parseInt(billing_info[3]), // 결제 금액
                            orderId: order_id, // 유니크한 주문번호
                        }).then(function (res) {
                            if (res.status === 200) {
                                const { status } = res.data;
                                const enable = (status === 1);
                                User.updateOne(data, { $set: { enable: enable } },(err, resultData)=>{
                                    if(err){
                                        console.log(err);
                                    }else{
                                        console.log(resultData);
                                    }
                                });
                            }else{
                                User.updateOne(data, { $set: { enable: false } },(err, resultData)=>{
                                    if(err){
                                        console.log(err);
                                    }else{
                                        console.log(resultData);
                                    }
                                });
                            }
                        }).catch((reason)=>{
                            User.updateOne(data, { $set: { enable: false } },(err, resultData)=>{
                                if(err){
                                    console.log(err);
                                }else{
                                    console.log(resultData);
                                }
                            });
                        });
                    });
                });
            }
        }).catch(console.error);
    }

    User.find({trial:true, enable: false},(err, data)=>{ 
        data.forEach((element)=>{
            if(now > element['end_date']){
                User.updateOne(data, { $set: { channels: channels } },(err, resultData)=>{
                    if(err){
                        console.log(err);
                    }else{
                        console.log(resultData);
                    }
                });
            }
        });
    });
}
task();