// Made by iSlammedMyKindle in 2026!
// Semi-rewrite of the old html page. Re-doing a lot of things so that it's a dedicated script that executes a tts application locally on the machine
// Dependencies: Bun

import { spawn } from "child_process";
import config from "./config.json";

var prevUser = '';
var discordPrevUser = '';
let latestMessage: queueEntry | undefined;
let speechInProgress = false;


//twitchToDiscord: [d][username~123] message

if (!config?.server) {
    throw new Error(
        `No endpoint specified, to use this module, put the connection to the endpint in the config.json (see: config.example.json)`
    );
}

if (!config.speech_command) {
    throw new Error(
        `No command provided for speech! config.json -> speech_command must have program specified with an absolute path (see: config.example.json)
        espeak is a simple one to configure. To use that one, first install it, then specify the path: "speech_command": { "exe": "espeak" }`
    )
}

interface listnerCoreDTO {
    event: 'message' | 'redeem' | 'follow' | 'sub',
    accepted?: string[],
    rejected?: string[],
    channel: string,
    userDisplayName: string,
    user: string,
    text: string,
}

interface queueEntry {
    text: string,
    prev?: queueEntry,
    next?: queueEntry
}

interface redeemDTO extends listnerCoreDTO {
    rewardTitle: string,
    rewardCost: number
}

const ws = new WebSocket(`${config.server}:${config.port}`);
ws.addEventListener('open', () => {
    console.log("Connected to twitchListenerCore")
    ws.send(JSON.stringify(['message', 'redeem', 'sub', 'follow']));
});

ws.addEventListener('close', () => console.log(`Closing connection to ${config.server}:${config.port}`));

ws.addEventListener('message', evt => {
    // Parse the data from the data, it's either going to be a redeem or a chat message
    const data = JSON.parse(evt.data) as listnerCoreDTO;
    let resStr = '';

    if (data.accepted?.length) console.log('Now listening to ', data.accepted);
    if (data.rejected?.length) console.error('twitchListenerCore rejected these events:', data.rejected);

    // This is a twitch messsage, if it comes from discord, change the beginning text
    if (data.text) {

        if (data.text.indexOf('!bsr') > -1)
            resStr = data.user + ' suggested a new song!';

        else if (data.user == data.channel || data.text[0] == "!") return;

        if (data.text.indexOf("[d][") == 0) {
            try {
                let discordUser = data.text.substring(data.text.indexOf("[d][") + 4, data.text.indexOf('~'));
                if (discordUser === "[d][") discordUser = "somebody"; // This failed to parse the username, put in a generic name instead

                let lol = false;

                // ttduser can be used to verify if someone is from discord or not. If someone is trying to fake it, use some tongue & cheek 8)
                if (config.ttduser && data.user != config.ttduser) {
                    resStr = data.user + ', who tried to be ';
                    lol = true;
                }
                resStr += (!lol && discordPrevUser == discordUser ? '' : (discordUser.replaceAll('_', ' ')) + " from discord ") + (lol ? " lol nice try, said " : "") + ": " + data.text.substring(data.text.indexOf('] ') + 2);

                discordPrevUser = discordUser;
            }
            catch (e) {
                resStr = data.user + ", who failed faked being another discord user, so bad to the point I nearly freaken crashed (lmao), said: " + data.text;
                console.error(e);
            }
        }

        else if (!resStr) {
            resStr = (prevUser == data.user ? '' : data.user.replaceAll('_', ' ') + ": ") + data.text;
            prevUser = data.user;
        }
    }

    // Specific events!
    else switch (data.event) {
        case 'redeem':
            const redeem = data as redeemDTO;
            resStr = `${redeem.userDisplayName}  redeemed: ${redeem.rewardTitle} for ${redeem.rewardCost} points`;
            break;
        case 'sub':
            `${data.userDisplayName} Subscribed to the channel! You are an absolute legend!`
            break;
        case 'follow':
            resStr = `${data.userDisplayName} Followed the channel! Thank you!`;
            break;
    }

    console.log({ "message": resStr, data }, data.channel);

    // Speak me lad!
    const prevMessage = latestMessage
    latestMessage = {
        text: resStr,
        prev: latestMessage
    }

    if (prevMessage)
        prevMessage.next = latestMessage

    if (!speechInProgress)
        speak(latestMessage);

});

/**
 * Speaks using the requested command on the OS. The linkedList item in this chain will be iterated on synchronously to ensure everything can be heard
 * @param entry The node in the linkedList we'll be triggering next
 */
async function speak(entry: queueEntry) {
    if (!speechInProgress) speechInProgress = true;

    await new Promise((res) => {
        spawn(config.speech_command.exe, [...config.speech_command.args, entry.text]).on('close', () => {
            res(undefined);
        });
    });

    // After this one is done, move onto the next:
    if (entry.next)
        speak(entry.next);
    else speechInProgress = false;
}