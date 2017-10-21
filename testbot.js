var request = require('request');
var RtmClient = require('@slack/client').RtmClient;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;

var bot_token = process.env.SLACK_BOT_TOKEN || '';

const HEALTH_CHECK_LOCATION = 'https://jenkinsci.wedeploy.io/counts'

var rtm = new RtmClient(bot_token);

let channel;

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  for (const c of rtmStartData.channels) {
	  if (c.is_member && (c.name ==='general' || c.name === 'random')) { channel = c.id }
  }
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
});

// you need to wait for the client to fully connect before you can send messages
rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
  rtm.sendMessage('Hello!', channel);
});

// New stuff
rtm.on(RTM_EVENTS.MESSAGE, function handleRtmMessage(message) {
  console.log('Message:', message); //this is no doubt the lamest possible message handler, but you get the idea

  if(checkIfForBot(message)){
    // We know this is probably addressing Cid now.
    // Check for the type of action to take
    var output;
    switch(checkForCommand(message)) {
      case 'jenkinsHealthCheck':
        output = getJenkinsSlavesHealth(message);
        break;
      case 'sayHello':
        output = getHello(message);
        break;
      default:
        output = getHelpMessage();
    }

    if (output !== undefined) {
      rtm.sendMessage(output, message.channel);
    } else {
      rtm.sendMessage('Technical Issues, please stand by.', message.channel);
    }
  }

});

function checkIfForBot(input) {
  return input.text.toLowerCase().includes('cid');
}

function checkForCommand(message) {
  var command = message.text.toLowerCase();
  if (command.includes('jenkins slave status')) {
    return 'jenkinsHealthCheck';
  } else if (command.includes('hello')) {
    return 'sayHello';
  } else {
    return 'help';
  }
}

function getHello(messObj) {
  var result = 'Hello <@' + messObj.user + '>!'
  return result
}

function getHelpMessage() {
  var result = 'I didn\'t understand what you said\nHere are some of the ' +
              'things that I can do:\n----------------------\nJenkins Slave ' +
              'Status: Check on the ' +
              'health of the Jenkins Cluster\n\n Or you can always just ' +
              'say "Hello!"';
  return result;
}

function getJenkinsSlavesHealth(message) {
  request(HEALTH_CHECK_LOCATION, (err, res, body) => {
    var result;
    if (res.statusCode === 200 && !err) {
      let slaveStatusObject = JSON.parse(body);
      console.log('Response: ', slaveStatusObject);
      result = 'There are currently ' + slaveStatusObject['offline_slave_count'] +
              ' slaves offline. The master with the most offline slaves is ' +
              getMostOfflineSlaves(slaveStatusObject) + '.';
    } else {
      result = 'HTTP Error: ' + res.statusCode + ' occurred.';
    }

    rtm.sendMessage(result, message.channel);

  });
  return 'One moment...';
}

function getMostOfflineSlaves(slaves) {
  var maxNow = slaves['test-1-1'];
  var maxHostNow = 'test-1-1';
  for (var key in slaves) {
    if (slaves.hasOwnProperty(key) && key !== 'offline_slave_count') {
      if (slaves[key] > maxNow) {
        maxNow = slaves[key];
        maxHostNow = key;
      }
    }
  }
  return maxHostNow;
}


rtm.start();
