import { WebSocketServer } from "ws";

var listenerCoreSocket;

// Dummy listenerCore server
const listenerCore = new WebSocketServer({ port:9001 });
listenerCore.on('connection', ws=>{
    listenerCoreSocket = ws;
    ws.on('message', buff=>console.log('(listenerCore)', buff.toString()));
});

// Abstract mocks for listenerCore; export them to the node console and run the server in VSCode debug
const sendText = (text, user = 'islammedmykindle')=>listenerCoreSocket.send(JSON.stringify({ channel:'islammedmykindle', user, text}));
const sendRedeem = (rewardTitle, userName = 'islammedmykindle', userDisplayName)=>listenerCoreSocket.send(JSON.stringify({rewardTitle, userName, displayName: userDisplayName || userName, rewardCost: 150}));

export {sendText, sendRedeem};