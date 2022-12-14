
const https = require('https');
const axios = require('axios')
const fs = require('fs');
const { Telegraf } = require('telegraf');
const split = require('emoji-aware').split;
const onlyEmoji = require('emoji-aware').onlyEmoji;

const walletURL = "http://127.0.0.1:10000/api/wallet"
const walletHeaders = {
	headers: { 
	  "Content-Type": 'application/json',
	}
}

require('dotenv').config();

const TESTING = false

// replace the value below with the Telegram token you receive from @BotFather
const token = TESTING ? process.env.TOKEN_TEST : process.env.TOKEN
// only work at the selected chat id
const chat_id = TESTING ? -1001842396281 : -1001889632351

// api server
const serverURL = "https://usa.raskul.com"
// server api key
const secret_api_key = process.env.SECRET_API_KEY

const headers = {
  headers: { 
    Accept: 'application/json',
    Authorization: 'Bearer ' + secret_api_key
  },
}

// Create a bot that uses 'polling' to fetch new updates
const bot = new Telegraf(token)

const write_log = (file_name, data) => {
  fs.mkdirSync('log', { recursive: true });

  fs.appendFile('log/' + file_name, data + '\n', (err) => {
    if (err) throw err;
  })
}

const download = (url, dest, cb) => {
  var file = fs.createWriteStream(dest);
  https.get(url, (response) => {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb);
    });
  });
}


const saveToReview = (msg_id, sender_id, sender_name, date, file_ext, chat_user_count) => {
  const data = {
    id: msg_id,
    sender_id: sender_id,
    sender_name: sender_name,
    date: date,
    status: 'waiting',
    file_ext: file_ext,
    chat_user_count: chat_user_count,
  }

  axios.post(serverURL + '/rev/' , data, headers).then(res => {
   /* bot.telegram.sendPhoto(user.chat_id, {source: fs.readFileSync('./bot/payment.png')}, {
      caption: 'Flag has been send for review.'
    }).catch((err) => {
        write_log('send_rewards.log', 'error sending bot message: ' + err)
    });*/

    write_log('send_review.log', 'send to review from ' +sender_id)
  }).catch((err) => {
    write_log('send_review.log', 'error: ' + err)
  });

}

function convertTZ(date, tzString) {
  return new Date((typeof date === "string" ? new Date(date) : date).toLocaleString("en-US", {timeZone: tzString}));   
}

bot.catch((err, ctx) => {
  write_log('bot.log', `error: ${ctx.updateType}` + err)
})


// give out devReward every 6 hours
let devReward = 0
setInterval(() => {
  const walletData = {
    "jsonrpc":"2.0",
    "id": 2,
    "method":"tx_send",
    "params":
    {
      "value": devReward * 100000000,
      "address": process.env.DEV_WALLET,
      "asset_id": 10,
      "offline": true,
    }
  }
    
  axios.post(walletURL, walletData, walletHeaders).then(res => {
    write_log('dev_reward.log', 'sending dev reward')
  }).catch((err) => {
    write_log('dev_reward.log', 'error: ' + err)
  });

  
}, 1000 * 60 * 60 * 6);

// remove logs every 12 hours
setInterval(() => {
  fs.rmSync('log', { recursive: true, force: true });
}, 1000 * 60 * 60 * 12);

const send_reward = (user, reward) => {
  devReward += reward * 0.01

  const walletData = {
    "jsonrpc":"2.0",
    "id": 2,
    "method":"tx_send",
    "params":
    {
      "value": reward * 100000000,
      "address": user.wallet,
      "asset_id": 10,
      "offline": true,
    }
  }
  axios.post(walletURL, walletData, walletHeaders).then(res => {
    write_log('rewards.log', 'sending reward')

    bot.telegram.sendPhoto(user.chat_id, {source: fs.readFileSync('./bot/payment.png')}, {
      caption: `Sending ${reward} TQR to your wallet.`
    }).catch((err) => {
        write_log('rewards.log', 'error sending bot message: ' + err)
    });

  }).catch((err) => {
    bot.telegram.sendPhoto(user.chat_id, {source: fs.readFileSync('./bot/addresswrong.png')}, {
      caption: 'Something went wrong when trying to send your reward. Please make sure to use a regular offline address.',
    }).catch((err) => {
      write_log('rewards.log', 'error sending bot message about wrong wallet address: ' + err)
    });

    write_log('rewards.log', 'error sending to ' + user.wallet, " \n " + err)
  });
}

setInterval(() => {
  axios.get(serverURL + '/rev/approved', headers).then(res => {
    res.data.forEach((rev) => {
      axios.get(serverURL + '/rev/delete/' + rev.id, headers).then(r => {}).catch((err) => {
        write_log('delete.log', 'error: ' + err)
      })
      axios.get(serverURL + '/users/' + rev.sender_id, headers).then(resUser => {
        let user = resUser.data
        let date = convertTZ(new Date(rev.date * 1000), "Pacific/Easter");
        let mult = 1
        if (rev.chat_user_count > 3000) mult = 1000
        else if (rev.chat_user_count > 2000) mult = 100
        else if (rev.chat_user_count > 1000) mult = 10
        
        let reward = (Math.round((date.getHours() + date.getMinutes() / 100) * 100) / 100) * mult;
        send_reward(user, reward)

   
      }).catch((err) => {
        write_log('rewards.log', 'error getting user: ' + err)
      });
    })
  }).catch((err) => {
    write_log('rewards.log', 'error getting approved users: ' + err)
  });

  axios.get(serverURL + '/rev/red_card', headers).then(res => {
    res.data.forEach((rev) => {
      axios.get(serverURL + '/rev/delete/' + rev.id, headers).then(r => {}).catch((err) => {
        write_log('delete.log', 'error: ' + err)
      })
      axios.get(serverURL + '/users/' + rev.sender_id, headers).then(resUser => {
        let user = resUser.data
        user.red_card += 1
        // update db red card
        if (user.red_card < 3) {
          bot.telegram.sendPhoto(user.chat_id, {source: fs.readFileSync('./bot/redflag.png')}, {
            caption: `You got a red flag, \\${3 - user.red_card} more consecutive red flags and you will be kicked\\.`,
            parse_mode: "MarkdownV2"
          }).catch((err) => {
            write_log('red_flag.log', 'error: ' + err)
          });
        }
        else {
          bot.telegram.kickChatMember(chat_id, user.id).catch((err) => {});
          axios.get(serverURL + '/users/' + user.id + 'reset_red_cards', headers).then(r => {}).catch((err) => {
            write_log('red_flag.log', 'error: ' + err)
          })
        }

      }).catch((err) => {
        write_log('red_flag.log', 'error: ' + err)
      });
    })
  }).catch((err) => {
    write_log('red_flag.log', 'error: ' + err)
  });
  
}, 1000 * 10);

// Listen for any kind of message. There are different kinds of
// messages.

bot.on('callback_query', (ctx) => {
  let sender_id = ctx.update.callback_query.from.id
  let user_id = ctx.update.callback_query.data
  ctx.answerCbQuery("", { url: 't.me/tqrmining_bot?start=xxx'}).catch((err) => {});
  if (sender_id == user_id) {
    setTimeout(() => {
      ctx.deleteMessage().catch((err) => {});
    }, 1000)
  }
}).catch((err) => {
  write_log('command_callback_query.log', 'err: ' + err)
});


bot.on('new_chat_members', (ctx) => {
  const msg = ctx.update.message;
  if (msg.chat.id != chat_id) return

  msg.new_chat_members.forEach( (member) => {
    restrictMember(ctx, member)
  })
}).catch((err) => {
  write_log('command_new_chat_member.log', 'err: ' + err)
});


bot.help((ctx) => {
  ctx.reply('/update - update your wallet address')
}).catch((err) => {
  write_log('command_help.log', 'err: ' + err)
});


const restrictMember = (ctx, member) => {
  ctx.restrictChatMember(member.id, {
    can_send_messages: false,
    can_send_media_messages: false,
    can_send_other_messages: false,
  }).catch((err) => {});
  ctx.replyWithPhoto({source: fs.readFileSync('./bot/register.png')}, {
    caption: `Welcome [${member.first_name}](tg://user?id=${member.id})\\! To start mining please verify your account and give us your beam offline address to receive reward\\.`, 
    parse_mode: "MarkdownV2",
    reply_markup: {
      inline_keyboard: [[{
        text: 'Verify',
        callback_data: member.id
      }]]
    }
  }).catch((err) => {});
}

bot.start((ctx) => {
  const msg = ctx.update.message;
  if (msg.chat.id == chat_id) return

  ctx.replyWithPhoto({source: fs.readFileSync('./bot/verify.png')}, {
    caption: `Please use /update \[\offline beam adddress\]\ to start receiving rewards and to be able to mine on <a href="https://t.me/tqrtip">TQR Mining Channel</a>`,
    parse_mode: "HTML"
  }).catch((err) => {});
}).catch((err) => {
  write_log('command_start.log', 'err: ' + err)
});

/*
bot.command('tip', (ctx) => {
  const msg = ctx.update.message;
  const user_id = msg.from.id
  if (!(user_id == 361338016 || user_id == 706665437 || user_id == 5810272694)) return
  if (!('reply_to_message' in msg)) return
  let data = msg.text.split('/tip ')
  let receiver = msg.reply_to_message.from.id
  let amount = data[1]
  let token = data[2] || "Beam"
  console.log(receiver, amount, token)
}).catch((err) => {
  write_log('command_tip.log', 'err: ' + err)
});*/


bot.command('update', (ctx) => {
  const msg = ctx.update.message;
  if (msg.chat.id == chat_id) return

  let txt = msg.text
  txt = txt.split(' ')
  if (txt.length == 2 && txt[1].length >= 250 && txt[1].length <= 500) {
    const data = {
      id: msg.from.id,
      wallet: txt[1],
      chat_id: msg.chat.id,
      sender_name: msg.from.first_name
    }
    
    axios.post(serverURL + '/users/' + msg.from.id + '/wallet' , data, headers).then((response) => {
      if (response.status === 201) {

      }
    }).catch((err) => {});
   

    ctx.replyWithPhoto({source: fs.readFileSync('./bot/address.png')}, {
      caption: `We have saved your beam offline address, you are ready to start mining at [TQR Mining Channel](https://t.me/tqrtip)\\. You may update your wallet address at any time here\\.`,
      parse_mode: "MarkdownV2"
    }).catch((err) => {});

    bot.telegram.promoteChatMember(chat_id, msg.from.id, {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_other_messages: true,
    }).catch((err) => {});
  }
  else {
    ctx.replyWithPhoto({source: fs.readFileSync('./bot/addresswrong.png')}, {
      caption: 'Please make sure you have entered a valid beam offline wallet address.'
    }).catch((err) => {});
  }
}).catch((err) => {
  write_log('command_update.log', 'err: ' + err)
});


bot.on('message', (ctx) => {
  const msg = ctx.update.message;
  if (msg.chat.id != chat_id) return
  axios.get(serverURL + '/users/' + msg.from.id, headers).then(res => {

    let file_id = ''
    if ('photo' in msg) {
      file_id = msg.photo[0].file_id
    } 
    else if ('file' in msg) {
      if ('file_id' in msg.file) {
        file_id = msg.file.file_id
      }
    }
    else if ('animation' in msg) {
      if ('file_id' in msg.animation) {
        file_id = msg.animation.file_id
      }
    }
    else if ('video' in msg) {
      if ('file_id' in msg.video) {
        file_id = msg.video.file_id
      }
    }
    if (file_id) {
      ctx.telegram.getFile(file_id).then((file_info) => {
        const file_path = file_info.file_path
        const url = "https://api.telegram.org/file/bot" + token + "/" + file_path;
        if (!fs.existsSync('review')) fs.mkdirSync('review')
  
        let file_name = file_path.split('/')
        file_name = file_name[file_name.length - 1]
        let file_ext = file_name.split('.')
        file_ext = file_ext[file_ext.length - 1]
        download(url, 'review/' + msg.message_id + '.' + file_ext)
        ctx.getChatMembersCount().then(chat_user_count => {
          saveToReview(msg.message_id, msg.from.id, msg.from.first_name, msg.date, file_ext, chat_user_count)
        }).catch((err) => {
          write_log('review_file.log', 'error getting chat members: ' + err)
        });
      }).catch((err) => {
        write_log('review_file.log', 'error getting file: ' + err)
      });
    }
    else {
      let date = convertTZ(new Date(), "Pacific/Easter");
      if(date.getHours() >= 1) return

      let emoji = onlyEmoji(msg.text)
      if (emoji.length == 1) {
        only_text = msg.text.split(emoji)
        if (only_text[1] == " jolly roger" || only_text[1] == "jolly roger") {
          axios.get(serverURL + '/users/' + msg.from.id, headers).then(resUser => {
            ctx.getChatMembersCount().then(chat_user_count => {
              let user = resUser.data

              let mult = 1
              if (chat_user_count > 3000) mult = 1000
              else if (chat_user_count > 2000) mult = 100
              else if (chat_user_count > 1000) mult = 10
              
              let reward = 99 * mult;
              send_reward(user, reward)
            }).catch((err) => {
              write_log('jolly.log', 'error getting chat members: ' + err)
            });

       
          }).catch((err) => {
            write_log('jolly.log', 'error getting user: ' + err)
          });
        }
      }
      write_log('review_file.log', 'no file_id' + msg.from)    
    }
  }).catch((err) => {
    if ('response' in err) {
      if (err.response.data.detail == "User not found") {
        restrictMember(ctx, msg.from)
        ctx.deleteMessage().catch((err) => {

        });
      }
    } 
    write_log('error_no_file.log', err)
  });
  

}).catch((err) => {
  write_log('command_message.log', 'err: ' + err)
});




bot.launch()
