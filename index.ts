// Made by iSlammedMyKindle in 2026!
// Semi-rewrite of the old html page. Re-doing a lot of things so that it's a dedicated script that executes a tts application locally on the machine
// Dependencies: Bun

import { spawn } from "child_process";
import config from "./config.json" with { type: "json" };

var prevAltPlatformUser = "";
let latestMessage: queueEntry | undefined;
let speechInProgress = false;

// Aternate platforms: discord, matrix
const altPlatformReg = /^\[(d|m)\]\[/;

const platforms = {
  d: "discord",
  m: "matrix",
};

//twitchToDiscord: [d][username~123] message

if (!config?.server) {
  throw new Error(
    `No endpoint specified, to use this module, put the connection to the endpint in the config.json (see: config.example.json)`,
  );
}

if (!config.speech_command) {
  throw new Error(
    `No command provided for speech! config.json -> speech_command must have program specified with an absolute path (see: config.example.json)
        espeak is a simple one to configure. To use that one, first install it, then specify the path: "speech_command": { "exe": "espeak" }`,
  );
}

interface listnerCoreDTO {
  event: "message" | "redeem" | "follow" | "sub";
  accepted?: string[];
  rejected?: string[];
  channel: string;
  userDisplayName: string;
  user: string;
  text: string;
  emoteOffsets: { [s: string]: unknown } | ArrayLike<unknown>;
}

interface queueEntry {
  user: string;
  text: string;
  prev?: queueEntry;
  next?: queueEntry;
  isMessageAllEmoji: boolean;
}

interface redeemDTO extends listnerCoreDTO {
  rewardTitle: string;
  rewardCost: number;
}

const ws = new WebSocket(`${config.server}:${config.port}`);
ws.addEventListener("open", () => {
  console.log("Connected to twitchListenerCore");
  ws.send(JSON.stringify(["message", "redeem", "sub", "follow"]));
});

ws.addEventListener("close", () =>
  console.log(`Closing connection to ${config.server}:${config.port}`),
);

ws.addEventListener("message", (evt) => {
  // Parse the data from the data, it's either going to be a redeem or a chat message
  const data = JSON.parse(evt.data) as listnerCoreDTO;
  let resStr = "";
  const prevUser = latestMessage?.prev?.user;
  let isMessageAllEmoji = false;

  if (data.accepted?.length) console.log("Now listening to ", data.accepted);
  if (data.rejected?.length)
    console.error("twitchListenerCore rejected these events:", data.rejected);

  // This is a twitch messsage, if it comes from discord, change the beginning text
  if (data.text) {
    if (data.text.indexOf("!bsr") > -1)
      resStr = data.user + " suggested a new song!";
    else if (data.user == data.channel || data.text[0] == "!") return;

    // 1. transform the emoji list into a flatened array
    // 2. perform in-between substring-ing to grab the parts that aren't emoji
    // 3. instead of saying each emoji, state how many were used
    let finalText = data.text;
    const flatenedEmoteArray = Object.values(data.emoteOffsets).flat();

    if (data.emoteOffsets) {
      let fusedStr = "";

      // Map the values into actual numbers, then sort everything out by lower index
      const sortedIndexes = flatenedEmoteArray
        .map((e) => (e as string).split("-").map((f) => Number(f)))
        .sort((e, f) => (e[0] > f[0] ? 1 : -1));
      console.log(sortedIndexes);

      // Iterate through all emoji to clear them
      for (let i = 0; i < sortedIndexes.length; i++) {
        // Insert the first string
        if (i === 0) {
          fusedStr += finalText.substring(0, sortedIndexes[0][0]);
        }

        // Append the message between the last & first indexes
        if (i !== sortedIndexes.length - 1) {
          fusedStr += finalText.substring(
            sortedIndexes[i][1] + 1,
            sortedIndexes[i + 1][0],
          );
        }

        // We're at the end, just grab the remaining stuff
        else {
          fusedStr += finalText.substring(sortedIndexes[i][1] + 1);
        }
      }

      // Even if the threshold is smaller than 3, we filter anyway to prevent spamming
      isMessageAllEmoji = fusedStr.replaceAll(/ +/g, "").length === 0;

      // Remove all trailing spaces and make this the final change:
      if (flatenedEmoteArray.length > 3)
        finalText =
          fusedStr.replaceAll(/ +/g, " ") +
          "; total emoji: " +
          sortedIndexes.length;
    }

    // Replace any urls with "link" - it's almost full-proof, just doesn't get an edgecase like: https://example.com?a=1 - where the parameter comes without a slash after the main url
    // Nemotron ultra helped with this one
    finalText = finalText.replace(
      /https?:\/\/(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?(?:\?[^\s]*)?/g,
      "hyperlink",
    );

    const altPlatform: RegExpExecArray | null = altPlatformReg.exec(finalText);

    if (altPlatform) {
      try {
        // second index, so "[d][" -> "d"
        const possiblePlatform =
          // @ts-ignore It's freaking out because we're using any string character to parse a potential type... that's ok! Ideally perhaps a map would work better here
          platforms[altPlatform[0][1]] || "unknown platform";
        let altPlatformUser = finalText.substring(
          altPlatform.index + 4,
          finalText.indexOf("~"),
        );

        // String would be blank here
        if (!altPlatformUser) altPlatformUser = "somebody"; // This failed to parse the username, put in a generic name instead

        let lol = false;

        // ttduser can be used to verify if someone is from an alternate platform or not. If someone is trying to fake it, use some tongue & cheek :)
        if (config.ttduser && data.user != config.ttduser) {
          resStr = data.user + ", who tried to be ";
          lol = true;
        }
        resStr +=
          (!lol && prevAltPlatformUser == altPlatformUser
            ? ""
            : altPlatformUser.replaceAll("_", " ") +
              ` from ${possiblePlatform}: `) +
          (lol ? " lol nice try, said: " : "") +
          " " +
          finalText.substring(finalText.indexOf("] ") + 2);

        prevAltPlatformUser = altPlatformUser;
      } catch (e) {
        resStr =
          data.user +
          ", who failed faked being another discord user, so bad to the point I nearly freaken crashed (lmao), said: " +
          finalText;
        console.error(e);
      }
    } else if (!resStr) {
      resStr =
        (prevUser == data.user ? "" : data.user.replaceAll("_", " ") + ": ") +
        finalText;
    }
  }

  // Specific events!
  else
    switch (data.event) {
      case "redeem":
        const redeem = data as redeemDTO;
        resStr = `${redeem.userDisplayName}  redeemed: ${redeem.rewardTitle} for ${redeem.rewardCost} points`;
        break;
      case "sub":
        `${data.userDisplayName} Subscribed to the channel! You are an absolute legend!`;
        break;
      case "follow":
        resStr = `${data.userDisplayName} Followed the channel! Thank you!`;
        break;
    }

  console.log({ message: resStr, data }, data.channel);

  // If the message is all emoji, and the previous one was, prevent anything else from being spammed for now
  if (isMessageAllEmoji && latestMessage?.isMessageAllEmoji) return;

  // If everything looks good...
  // Speak me lad!
  const prevMessage = latestMessage;
  latestMessage = {
    user: data.user,
    text: resStr,
    prev: latestMessage,
    isMessageAllEmoji,
  };

  if (prevMessage) prevMessage.next = latestMessage;

  if (!speechInProgress) speak(latestMessage);
});

/**
 * Speaks using the requested command on the OS. The linkedList item in this chain will be iterated on synchronously to ensure everything can be heard
 * @param entry The node in the linkedList we'll be triggering next
 */
async function speak(entry: queueEntry) {
  if (!speechInProgress) speechInProgress = true;

  await new Promise((res) => {
    spawn(config.speech_command.exe, [
      ...config.speech_command.args,
      `"${entry.text.replaceAll('"', "'")}"`,
    ]).on("close", () => {
      res(undefined);
    });
  });

  // After this one is done, move onto the next:
  if (entry.next) speak(entry.next);
  else speechInProgress = false;
}
