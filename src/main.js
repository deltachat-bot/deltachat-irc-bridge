const DeltaChat = require('deltachat-node')
const C = require('deltachat-node/constants')
const dc = new DeltaChat()
const path = require('path')
const { fileSave } = require('./file')

// Config
const { DC_Account, IRC_Connection, fileUploadNeedsVerifiedUser } = require('../data/config.json')
// ======

// Channel & nickname storage/managers
const channel = require('./channels')()
const nicks = require('./nicknames')()

// IRC
const IRCClient = require('./irc')
/** @type {IRCClient} ircClient */
var ircClient
//DeltaChat

function DCsendMessage(chat, text) {
    dc.sendMessage(chat.getId(), text)
}

//dc.on('ALL', console.log.bind(null,'core |'))

const tellIRCgroupMemberlistChange = (channel, email, isLeave=false) => {
    //TODO make this an option in the config (if false return)
    const name = nicks.email2Nick(email)
    ircClient.sendAction(channel, `${name}[dc] ${isLeave?'left':'joined'} the room`)
}

const LeaveGroup = function (sender, channelID){
    const chatId = channel.getDCGroup(channelID)
    tellIRCgroupMemberlistChange(channelID, sender.getAddress(), true)
}

dc.on('DC_EVENT_CHAT_MODIFIED', (chatId)=>{
    if(!dc.isContactInChat(chatId, C.DC_CONTACT_ID_SELF)) return;
    const chat = dc.getChat(chatId)
    if( dc.getChatContacts(chatId).length === 1){
        const channelID = channel.getIRCChannel(chatId)
        console.log(`Last member left group: ${chatId} ${channelID}`)
        
        channel.removeChannel(channelID)
        ircClient.leaveChannel(channelID)
        dc.deleteChat(chatId)
        console.log(`Group removed`)
}
})

const handleDCMessage = (chatId, msgId) => {
    const chat = dc.getChat(chatId)
    const message = dc.getMessage(msgId)
    if (!message || message.isInfo()) return;
    const sender = dc.getContact(message.getFromId())
    if (chat.getType() === C.DC_CHAT_TYPE_GROUP || chat.getType() === C.DC_CHAT_TYPE_VERIFIED_GROUP) {
        const name = nicks.email2Nick(sender.getAddress())
        /* irc once ready send msg */
        const groupid = channel.getIRCChannel(message.getChatId())
        if (!groupid) { return }
        ircClient.sendMessage(groupid, `${name}[dc]: ${message.getText()}`)

        if(message.getFile() !== undefined && message.getFile().length > 0){
            if(fileUploadNeedsVerifiedUser && !sender.isVerified() ){
                ircClient.sendAction(groupid, `${name}[dc] sent file, but this user isn't verified by the bot`)
            } else {
            fileSave(message.getFile(), message.getFilename()).then((link)=>{
                ircClient.sendAction(groupid, `${name}[dc] sent file ${link}`)
            })
        }
        }

    } else {
        // listen to join command
        const joinRegex = /\/join ([#&][^\x07\x2C\s]{0,199})/
        const nickRegex = /\/nick (.{3,30})/
        const namesRegex = /\/names ([#&][^\x07\x2C\s]{0,199})/
        const topicRegex = /\/topic ([#&][^\x07\x2C\s]{0,199})/
        const LeaveRegex = /\/leave ([#&][^\x07\x2C\s]{0,199})/
        if (message.getText().match(joinRegex)) {
            const channelID = joinRegex.exec(message.getText())[1]
            var groupId = channel.getDCGroup(channelID)

            if (!groupId) {
                groupId = dc.createUnverifiedGroupChat(`${channelID} on freenode`)
                channel.addChannel(channelID, groupId)
                ircClient.joinChannels([channelID])
                DCsendMessage(chat, `Group created`)
                DCsendMessage(dc.getChat(groupId), `Bridge established - linked to ${channelID}`)
            }
            if (!dc.isContactInChat(groupId, sender.getId())) {
                dc.addContactToChat(groupId, sender.getId())
                const users = ircClient.getOnlineUsersForChannel(channelID) || []
                const topic = ircClient.getTopicForChannel(channelID)
                DCsendMessage(chat, 
                    `Joined group '${channelID} on freenode'${topic?`\nTopic:\n${topic}`:''}${users && users.length > 0?`\n\nUsers:\n${users.join(', ')}`:''}`
                )
                if(!topic){
                    ircClient.once(`topic#${channelID}`, (topic) => DCsendMessage(chat, `${topic?`\nTopic:\n${topic}`:''}`))
                }
                if(!(users && users.length > 0)){
                    ircClient.once(`names#${channelID}`, (users) => DCsendMessage(chat, `${users && users.length > 0?`\n\nUsers:\n${users.join(', ')}`:''}`))
                }
                tellIRCgroupMemberlistChange(channelID, sender.getAddress(), false)
            }
        } else if (message.getText().match(nickRegex)) {
            const newNick = nickRegex.exec(message.getText())[1]
            const email = sender.getAddress()
            const currentNick = `${nicks.getNick(email)}`
            nicks.setNick(email, newNick)
            DCsendMessage(chat, `Changed your display name from ${currentNick} to ${nicks.getNick(email)}. (only applies to new msgs)`)
        } else if (message.getText().match(namesRegex)) {
            const channelID = namesRegex.exec(message.getText())[1]
            const users = ircClient.getOnlineUsersForChannel(channelID)
            DCsendMessage(chat, `There are currently ${users.length} users connected to ${channelID}:\n${users.join(', ')}`)
        } else if (message.getText().match(topicRegex)) {
            const channelID = topicRegex.exec(message.getText())[1]
            const topic = ircClient.getTopicForChannel(channelID)
            DCsendMessage(chat, `Topic for ${channelID}:\n${topic}`)
        } else if (message.getText().match(LeaveRegex)) {
            const channelID = LeaveRegex.exec(message.getText())[1]
            const channelChatId = channel.getDCGroup(channelID)
            if(dc.isContactInChat(channelChatId, sender.getId())){
                dc.removeContactFromChat(channelChatId, sender.getId())
                LeaveGroup(sender, channelID)
                DCsendMessage(chat, `Left ${channelID}, type '/join ${channelID}' to rejoin`)
            } else {
                DCsendMessage(chat, `Can't leave a channel you're not in (${channelID})`)
            }
            
        } else {
            DCsendMessage(chat,
                `Help:\n` +
                `please write '/join #channel' to join #channel on ${IRC_Connection.server}\n` +
                `write /nick [new nickname (3-30 chars long)] to modify the name under which your messages appear on irc\n`+
                `Also you can use /names #channel and /topic #channel`
            )
        }

    }
    dc.markNoticedChat(chatId)
}
dc.on('DC_EVENT_MSGS_CHANGED', (chatId, msgId) => {
    //handle initial message, that is normaly ignored, because it's a deaddrop 
    const message = dc.getMessage(msgId)
    if (message && message.isDeadDrop()) {
        handleDCMessage(dc.createChatByMessageId(msgId), msgId)
    }
})


dc.on('DC_EVENT_INCOMING_MSG', handleDCMessage)

async function init(){
    await channel.loadChannels()
    await nicks.load()
// Start DC and IRC client
ircClient = new IRCClient(IRC_Connection, Object.keys(channel.channels))
dc.open(path.join(__dirname,'../data/'),() => {
    if (!dc.isConfigured()) {
        dc.configure({
            addr: DC_Account.address,
            mail_pw: DC_Account.password
        })
    }
    const qrcode = require('qrcode-terminal')
    console.log("use this qr code to verify yourself with the bot:")
    qrcode.generate(dc.getSecurejoinQrCode(0), {small: true});
})

ircClient.on('message', (type, nick, to, text, _message) => {
    const chatId = channel.getDCGroup(to)
    if (!chatId) { return }
    const msg = `${nick}${type !== 'MSG' ? `:${type}` : ''}: ${text}`
    DCsendMessage(dc.getChat(chatId), msg)
})
    console.log('init done')
}


init()