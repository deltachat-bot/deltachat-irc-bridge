const irc = require('irc-upd');
const { EventEmitter } = require('events')

class IRCClient extends EventEmitter {
    constructor(opt, channels) {
        super()
        this.pin = opt.password
        this.client = new irc.Client(opt.server, opt.nick, {
            userName: 'dc-irc',
            realName: 'DeltaChat IRC bridge',
            password: opt.password,
            //secure:opt.secure,
            autoRejoin: true,
            encoding: 'utf-8',
            //sasl:true,
            stripColors: true,
        })
        this.onlineUsers = {}
        this.channelTopics = {}
        this.client.on('names', (channel, rawUsers)=>{
            const users = Object.keys(rawUsers).map((nick)=>`${rawUsers[nick]}${nick}`) || Object.keys(rawUsers)
            this.onlineUsers[channel] = users.sort((a, b)=> a.toLowerCase().codePointAt(0) - b.toLowerCase().codePointAt(0) )
            this.emit(`names#${channel}`, this.onlineUsers[channel])
        })
        this.client.on('topic', (channel, topic, nick, message)=>{
            this.channelTopics[channel] = `${topic}\n~set by ${nick}`
            this.emit(`topic#${channel}`, this.channelTopics[channel])
        })
        this.client.on('registered', () => {
            this.client.connect();
            this.joinChannels(channels)
            this.emit('ready')
        })
        this.attachListeners()
    }

    joinChannels(channels) {
        channels.forEach((channel) => {
            this.client.join(`${channel}`)
        })
    }

    attachListeners() {
        if(this.unsubscribe)this.unsubscribe()

        const onMsg = (nick, to, text, message) => this.emit('message', 'MSG', nick, to, text, message)
        const onNotice = (nick, to, text, message) => this.emit('message', 'NOTICE', nick, to, text, message)
        const onAction = (nick, to, text, message) => this.emit('message', 'ACTION', nick, to, text, message)
        const onError = function (message) { console.log('error: ', message); }
        this.client.on('message#', onMsg)
        this.client.on('notice', onNotice)
        this.client.on('action', onAction)
        this.client.on('error', onError)

        this.unsubscribe = () => {
            this.client.off('message#', onMsg)
            this.client.off('notice', onNotice)
            this.client.off('action', onAction)
            this.client.off('error', onError)
        }
    }

    sendMessage(channel, text) {
        this.client.say(channel, text)
    }

    getOnlineUsersForChannel(channel){
        return this.onlineUsers[channel]
    }

    getTopicForChannel(channel){
        return this.channelTopics[channel]
    }
}
module.exports = IRCClient