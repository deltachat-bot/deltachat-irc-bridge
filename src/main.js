const DeltaChat = require('deltachat-node')
const C = require('deltachat-node/constants')
const dc = new DeltaChat()

const {readFileSync, writeFile} = require('fs')
const { join } = require('path')

const { EventEmitter } = require('events')

// Config

const {DC_Account, IRC_Connection} = require('../data/config.json')

// ======

// Channel
const channel = {

    channels:{},
    
    loadChannels: function (){
        try {
            this.channels = require(join(__dirname, '..', 'data', 'channels.json'))
        } catch (error) {
            this.channels = {}
        }
    },
    saveChannels: async function(){
        writeFile(
            join(__dirname, '..', 'data', 'channels.json'),
            JSON.stringify(this.channels), ()=>{}
        )
    },
    addChannel: function (ircChannelID, dcGroupID){
        console.log(ircChannelID, dcGroupID);
        
        this.channels[ircChannelID] = dcGroupID
        this.saveChannels()
    },
    getIRCChannel: function (dcGroupID){
        return Object.keys(this.channels).find(ircChannelID => this.channels[ircChannelID] === dcGroupID);
    },
    getDCGroup: function (ircChannelID){
        return this.channels[ircChannelID]
    },
}

//Nicknames:

const nicks = {
    nicknames:{},
    load: function(){
        try {
            this.nicknames = require(join(__dirname, '..', 'data', 'nicknames.json'))
        } catch (error) {
            this.nicknames = {}
        }
    },
    save:function(){
        writeFile(
            join(__dirname, '..', 'data', 'nicknames.json'),
            JSON.stringify(this.nicknames), ()=>{}
        )
    },
    setNick: function(email, nickname){
        this.nicknames[email] = nickname
        this.save()
    },
    getNick:function(email){
        return this.nicknames[email]
    }
}

// IRC
const irc = require('irc-upd');

class IRCClient extends EventEmitter{
    constructor(opt,channels){
        super()
        this.pin = opt.password
        this.client = new irc.Client(opt.server, opt.nick, {
            userName: 'dc-irc',
            realName: 'DeltaChat IRC bridge',
            password:opt.password,
            //secure:opt.secure,
            autoRejoin:true,
            encoding:'utf-8',
            //sasl:true,
            stripColors:true,
        })
        this.client.on('registered', () => {
            this.client.connect();
            this.joinChannels(channels)
            this.emit('ready')
        })
        this.attachListeners()
    }

    joinChannels(channels){
        channels.forEach((channel)=>{
            this.client.join(`${channel}`)
        })
    }

    attachListeners(){
        this.client.on('message#', (nick, to, text, message)=>this.emit('message', 'MSG', nick, to, text, message))
        this.client.on('notice', (nick, to, text, message)=>this.emit('message', 'NOTICE', nick, to, text, message))
        this.client.on('action', (nick, to, text, message)=>this.emit('message', 'ACTION', nick, to, text, message))
        this.client.addListener('error', function(message) {
            console.log('error: ', message);
        });
    }
    
    sendMessage(channel, text){
        this.client.say(channel, text)
    }
}
/** @type {IRCClient} ircClient */
var ircClient
//DeltaChat

function DCsendMessage(chat, text){
    dc.sendMessage(chat.getId(), text)
}

//dc.on('ALL', console.log.bind(null,'core |'))

function email2Nick(address){
    return nicks.getNick(address) || address.substring(0, address.indexOf("@"))
}

const handleDCMessage = (chatId, msgId) => {
    const chat = dc.getChat(chatId)
    const message = dc.getMessage(msgId)
    if(message.isInfo())return;
    const sender = dc.getContact(message.getFromId())
    if(chat.getType() === C.DC_CHAT_TYPE_GROUP){
        const name = email2Nick(sender.getAddress())
        /* irc once ready send msg */
        const groupid = channel.getIRCChannel(message.getChatId())
        //console.log(message.getChatId());
        if(!groupid){return}
        ircClient.sendMessage(groupid, `${name}: ${message.getText()}`)
        
    } else if(chat.getType() === C.DC_CHAT_TYPE_VERIFIED_GROUP){
        // send warning
        DCsendMessage(chat, 'Bridging to IRC compromises the security of your verfied group, please remove this bot from the group!')
    } else {
        // listen to join command
        const joinRegex = /\/join ([#&][^\x07\x2C\s]{0,199})/
        const nickRegex = /\/nick (.{3,30})/
        if(message.getText().match(joinRegex)){
            const channelID = joinRegex.exec(message.getText())[1]
            //console.log('join', channelID)
            var groupId = channel.getDCGroup(channelID)
            //console.log(channel.getDCGroup(channelID))
            
            if(!groupId){
                groupId = dc.createUnverifiedGroupChat(`${channelID} on freenode`)
                //console.log('l', groupId)
                channel.addChannel(channelID, groupId)
                ircClient.joinChannels([channelID])
                DCsendMessage(chat, `Group created`)
                DCsendMessage(dc.getChat(groupId), `Bridge established - linked to ${channelID}`)
            }
            if(!dc.isContactInChat(groupId, sender.getId())){
                dc.addContactToChat(groupId, sender.getId())
                DCsendMessage(chat, `Group joined - write something on the IRC channel and you should see it poping up`)
            }
        } else if(message.getText().match(nickRegex)) {
            const newNick = nickRegex.exec(message.getText())[1]
            const email = sender.getAddress()
            const currentNick = `${nicks.getNick(email)}`
            nicks.setNick(email, newNick)
            DCsendMessage(chat, `Changed your display name from ${currentNick} to ${nicks.getNick(email)}. (only applies to new msgs)`)
        } else {
            DCsendMessage(chat, 
                `Help:\n`+
                `please write '/join #channel' to join #channel on ${IRC_Connection.server}\n`+
                `write /nick [new nickname (3-30 chars long)] to modify the name under which your messages appear on irc`
            )
        }
        
    }
    dc.markNoticedChat(chatId)
}
dc.on('DC_EVENT_MSGS_CHANGED', (chatId, msgId) => {
    const message = dc.getMessage(msgId)
    if(message && message.isDeadDrop()){
        handleDCMessage(dc.createChatByMessageId(msgId), msgId)
    }
})


dc.on('DC_EVENT_INCOMING_MSG', handleDCMessage)

channel.loadChannels()
nicks.load()
ircClient = new IRCClient(IRC_Connection, Object.keys(channel.channels))
dc.open(() => {
    if (!dc.isConfigured()) {
        dc.configure({
        addr: DC_Account.address,
        mailPw: DC_Account.password
        })
    }
})

ircClient.on('message', (type, nick, to, text, _message)=>{
    const chatId = channel.getDCGroup(to)
    if(!chatId){return}
    const msg = `${nick}${type!=='MSG'?`:${type}`:''}: ${text}`
    DCsendMessage(dc.getChat(chatId), msg)
})

//TODO wait for config load to finish otherwise it might gets lost/overwritten