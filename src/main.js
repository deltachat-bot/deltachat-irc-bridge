const DeltaChat = require('deltachat-node')
const C = require('deltachat-node/constants')
const dc = new DeltaChat()

// Config
const { DC_Account, IRC_Connection } = require('../data/config.json')
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

const handleDCMessage = (chatId, msgId) => {
    const chat = dc.getChat(chatId)
    const message = dc.getMessage(msgId)
    if (message.isInfo()) return;
    const sender = dc.getContact(message.getFromId())
    if (chat.getType() === C.DC_CHAT_TYPE_GROUP) {
        const name = nicks.email2Nick(sender.getAddress())
        /* irc once ready send msg */
        const groupid = channel.getIRCChannel(message.getChatId())
        if (!groupid) { return }
        ircClient.sendMessage(groupid, `${name}: ${message.getText()}`)

    } else if (chat.getType() === C.DC_CHAT_TYPE_VERIFIED_GROUP) {
        // send warning
        DCsendMessage(chat, 'Bridging to IRC compromises the security of your verfied group, please remove this bot from the group!')
    } else {
        // listen to join command
        const joinRegex = /\/join ([#&][^\x07\x2C\s]{0,199})/
        const nickRegex = /\/nick (.{3,30})/
        const namesRegex = /\/names ([#&][^\x07\x2C\s]{0,199})/
        const topicRegex = /\/topic ([#&][^\x07\x2C\s]{0,199})/
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
                const users = ircClient.getOnlineUsersForChannel(channelID)
                const topic = ircClient.getTopicForChannel(channelID)
                DCsendMessage(chat, `Joined group '${channelID} on freenode'\nTopic:\n${topic}\n\nUsers:\n${users.join(', ')}`)
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
        } else {
            DCsendMessage(chat,
                `Help:\n` +
                `please write '/join #channel' to join #channel on ${IRC_Connection.server}\n` +
                `write /nick [new nickname (3-30 chars long)] to modify the name under which your messages appear on irc`
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

channel.loadChannels()
nicks.load()
// Start DC and IRC client
ircClient = new IRCClient(IRC_Connection, Object.keys(channel.channels))
dc.open(() => {
    if (!dc.isConfigured()) {
        dc.configure({
            addr: DC_Account.address,
            mailPw: DC_Account.password
        })
    }
})

ircClient.on('message', (type, nick, to, text, _message) => {
    const chatId = channel.getDCGroup(to)
    if (!chatId) { return }
    const msg = `${nick}${type !== 'MSG' ? `:${type}` : ''}: ${text}`
    DCsendMessage(dc.getChat(chatId), msg)
})

//TODO wait for config load to finish otherwise it might gets lost/overwritten