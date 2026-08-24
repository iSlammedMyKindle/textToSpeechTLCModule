// Made by iSlammedMyKindle in 2026!
// Semi-rewrite of the old html page. Re-doing a lot of things so that it's a dedicated script that executes a tts application locally on the machine
// Dependencies: Bun

import { spawn } from "child_process";
import config from "./config.json";

var prevAltPlatformUser = '';
let latestMessage: queueEntry | undefined;
let speechInProgress = false;

// Aternate platforms: discord, matrix
const altPlatformReg = /^\[(d|m)\]\[/;

const platforms = {
  "d": "discord",
  "m": "matrix"
}


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
    user: string,
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
    const prevUser = latestMessage?.prev?.user;

    if (data.accepted?.length) console.log('Now listening to ', data.accepted);
    if (data.rejected?.length) console.error('twitchListenerCore rejected these events:', data.rejected);

    // This is a twitch messsage, if it comes from discord, change the beginning text
    if (data.text) {

        if (data.text.indexOf('!bsr') > -1)
            resStr = data.user + ' suggested a new song!';

        else if (data.user == data.channel || data.text[0] == "!") return;

        // TODO: Parse through emoji and sift them out
        // [...]

      const altPlatform: RegExpExecArray | null = altPlatformReg.exec(data.text);

        if (altPlatform) {
          try {
                // second index, so "[d][" -> "d"
                // @ts-ignore It's freaking out because we're using any string character to parse a potential type... that's ok! Ideally perhaps a map would work better here
                const possiblePlatform = platforms[altPlatform[0][1]] || "unknown platform";
                let altPlatformUser = data.text.substring(altPlatform.index + 4, data.text.indexOf('~'));

                // String would be blank here
                if (!altPlatformUser) altPlatformUser = "somebody"; // This failed to parse the username, put in a generic name instead

                let lol = false;

                // ttduser can be used to verify if someone is from an alternate platform or not. If someone is trying to fake it, use some tongue & cheek :)
                if (config.ttduser && data.user != config.ttduser) {
                    resStr = data.user + ', who tried to be ';
                    lol = true;
                }
                resStr += (!lol && prevAltPlatformUser == altPlatformUser ? '' : (altPlatformUser.replaceAll('_', ' ')) + ` from ${possiblePlatform}: `) + (lol ? " lol nice try, said: " : "") + " " + data.text.substring(data.text.indexOf('] ') + 2);

                prevAltPlatformUser = altPlatformUser;
            }
            catch (e) {
                resStr = data.user + ", who failed faked being another discord user, so bad to the point I nearly freaken crashed (lmao), said: " + data.text;
                console.error(e);
            }
        }

        else if (!resStr) {
            resStr = (prevUser == data.user ? '' : data.user.replaceAll('_', ' ') + ": ") + data.text;
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
        user: data.user,
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
        spawn(config.speech_command.exe, [...config.speech_command.args, `"${entry.text.replaceAll('"', '\'')}"`]).on('close', () => {
            res(undefined);
        });
    });

    // After this one is done, move onto the next:
    if (entry.next)
        speak(entry.next);
    else speechInProgress = false;
}
